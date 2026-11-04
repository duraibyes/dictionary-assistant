// Calls the LLM providers in order, rotating through every key of each provider.
// A key that hits a rate limit or runs out of quota is put on cooldown and the next
// key (or next provider) is tried automatically.

import { SYSTEM_PROMPT, userPrompt, parseResult, type LookupResult } from "./prompt";

export type ProviderName = "gemini" | "openai" | "anthropic" | "openrouter";

interface ProviderConfig {
  name: ProviderName;
  keysEnv: string;
  modelEnv: string;
  defaultModel: string;
}

const PROVIDERS: Record<ProviderName, ProviderConfig> = {
  gemini: { name: "gemini", keysEnv: "GEMINI_API_KEYS", modelEnv: "GEMINI_MODEL", defaultModel: "gemini-flash-latest" },
  openai: { name: "openai", keysEnv: "OPENAI_API_KEYS", modelEnv: "OPENAI_MODEL", defaultModel: "gpt-5.4-mini" },
  anthropic: { name: "anthropic", keysEnv: "ANTHROPIC_API_KEYS", modelEnv: "ANTHROPIC_MODEL", defaultModel: "claude-haiku-5-5" },
  openrouter: { name: "openrouter", keysEnv: "OPENROUTER_API_KEYS", modelEnv: "OPENROUTER_MODEL", defaultModel: "openrouter/free" },
};

const DEFAULT_ORDER: ProviderName[] = ["gemini", "openrouter", "openai", "anthropic"];
const TIMEOUT_MS = 25_000;

/** key -> timestamp until which the key is skipped. Lives as long as the server instance. */
const cooldown = new Map<string, number>();

class ProviderError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function splitKeys(v: string | undefined): string[] {
  return (v ?? "").split(/[,\n]/).map((k) => k.trim()).filter(Boolean);
}

export function providerOrder(): ProviderName[] {
  const fromEnv = (process.env.PROVIDER_ORDER ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is ProviderName => s in PROVIDERS);
  // Providers named in PROVIDER_ORDER go first; any others that have keys follow.
  const rest = DEFAULT_ORDER.filter((p) => !fromEnv.includes(p));
  return [...fromEnv, ...rest];
}

export function configuredProviders(): { name: ProviderName; keys: number; model: string }[] {
  return providerOrder().map((name) => {
    const cfg = PROVIDERS[name];
    return { name, keys: splitKeys(process.env[cfg.keysEnv]).length, model: process.env[cfg.modelEnv] || cfg.defaultModel };
  });
}

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) throw new ProviderError(text.slice(0, 300), res.status);
  return JSON.parse(text);
}

async function callProvider(name: ProviderName, key: string, model: string, query: string, hint?: string): Promise<string> {
  const user = userPrompt(query, hint);
  switch (name) {
    case "gemini": {
      const data = await post(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        { "x-goog-api-key": key },
        {
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { responseMimeType: "application/json" },
        },
      );
      return (data?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p?.text ?? "").join("");
    }
    case "anthropic": {
      const data = await post(
        "https://api.anthropic.com/v1/messages",
        { "x-api-key": key, "anthropic-version": "2023-06-01" },
        { model, max_tokens: 1500, system: SYSTEM_PROMPT, messages: [{ role: "user", content: user }] },
      );
      return (data?.content ?? []).filter((b: any) => b?.type === "text").map((b: any) => b.text).join("");
    }
    case "openai":
    case "openrouter": {
      const url =
        name === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
      const body: Record<string, unknown> = {
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: user },
        ],
      };
      // Not every free OpenRouter model supports JSON mode, so only force it for OpenAI.
      if (name === "openai") body.response_format = { type: "json_object" };
      const headers: Record<string, string> = { authorization: `Bearer ${key}` };
      if (name === "openrouter") headers["x-title"] = "Dictionary Assistant";
      const data = await post(url, headers, body);
      return data?.choices?.[0]?.message?.content ?? "";
    }
  }
}

/** How long to skip a key after a failure, or 0 to just try the next key without parking it. */
function cooldownFor(err: unknown): number {
  if (err instanceof ProviderError) {
    if (err.status === 429) return 60_000; // rate limited: retry in a minute
    if (err.status === 401 || err.status === 402 || err.status === 403) return 6 * 3600_000; // bad key / no credit
    if (err.status === 404 || err.status === 400) return 10 * 60_000; // wrong model name etc.
    if (err.status >= 500) return 15_000;
  }
  return 0; // timeout / bad JSON: try the next key, keep this one available
}

export interface AskOutcome {
  result: LookupResult;
  provider: ProviderName;
  model: string;
}

export async function ask(query: string, hint?: string): Promise<AskOutcome> {
  const errors: string[] = [];
  const now = Date.now();
  for (const name of providerOrder()) {
    const cfg = PROVIDERS[name];
    const model = process.env[cfg.modelEnv] || cfg.defaultModel;
    for (const key of splitKeys(process.env[cfg.keysEnv])) {
      const id = `${name}:${key}`;
      if ((cooldown.get(id) ?? 0) > now) continue;
      try {
        const raw = await callProvider(name, key, model, query, hint);
        const result = parseResult(raw, query);
        cooldown.delete(id);
        return { result, provider: name, model };
      } catch (err) {
        const wait = cooldownFor(err);
        if (wait) cooldown.set(id, Date.now() + wait);
        const status = err instanceof ProviderError ? err.status : "error";
        errors.push(`${name}#${key.slice(-4)} ${status}: ${(err as Error).message.slice(0, 120)}`);
      }
    }
  }
  throw new Error(errors.length ? `All providers failed — ${errors.join(" | ")}` : "No API keys configured");
}

export interface KeyTest {
  provider: ProviderName;
  model: string;
  key: string; // last 4 characters only
  ok: boolean;
  ms: number;
  detail: string;
}

/** Tries every key of every provider once with the same question (ignores cooldowns). */
export async function testAllKeys(query: string): Promise<KeyTest[]> {
  const jobs: Promise<KeyTest>[] = [];
  for (const name of providerOrder()) {
    const cfg = PROVIDERS[name];
    const model = process.env[cfg.modelEnv] || cfg.defaultModel;
    for (const key of splitKeys(process.env[cfg.keysEnv])) {
      jobs.push(
        (async () => {
          const t = Date.now();
          try {
            const r = parseResult(await callProvider(name, key, model, query), query);
            return { provider: name, model, key: "…" + key.slice(-4), ok: true, ms: Date.now() - t,
              detail: `${r.meanings_ta.slice(0, 3).join(", ")} | ${r.pronunciation_ta}` };
          } catch (err) {
            const status = err instanceof ProviderError ? err.status : "error";
            return { provider: name, model, key: "…" + key.slice(-4), ok: false, ms: Date.now() - t,
              detail: `${status}: ${(err as Error).message.slice(0, 200)}` };
          }
        })(),
      );
    }
  }
  return Promise.all(jobs);
}
