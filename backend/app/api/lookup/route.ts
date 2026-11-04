import { ask } from "@/lib/providers";
import type { LookupResult } from "@/lib/prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

// Small per-instance memory: repeat questions cost nothing, and one person can't drain the keys.
const cache = new Map<string, { at: number; value: unknown }>();
const CACHE_TTL = 24 * 3600_000;
const hits = new Map<string, number[]>();
const RATE_LIMIT = 40; // requests per minute per device

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const secret = process.env.APP_SECRET;
  if (!secret) return json({ error: "Server is missing APP_SECRET" }, 500);
  if (req.headers.get("x-app-secret") !== secret) return json({ error: "Unauthorized" }, 401);

  const who = req.headers.get("x-device-id") || req.headers.get("x-forwarded-for") || "anon";
  const now = Date.now();
  const recent = (hits.get(who) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= RATE_LIMIT) return json({ error: "Too many requests, wait a minute" }, 429);
  recent.push(now);
  hits.set(who, recent);

  let body: { query?: unknown; hint?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }
  const query = typeof body.query === "string" ? body.query.trim() : "";
  const hint = typeof body.hint === "string" ? body.hint.slice(0, 200) : undefined;
  if (!query) return json({ error: "query is required" }, 400);
  if (query.length > 500) return json({ error: "query is too long (max 500 characters)" }, 400);

  const cacheKey = `${query.toLowerCase()}|${hint ?? ""}`;
  const cached = cache.get(cacheKey);
  if (cached && now - cached.at < CACHE_TTL) return json({ ...(cached.value as object), cached: true });

  try {
    const { result, provider, model } = await ask(query, hint);
    const value: { result: LookupResult; provider: string; model: string } = { result, provider, model };
    cache.set(cacheKey, { at: now, value });
    if (cache.size > 2000) cache.delete(cache.keys().next().value!);
    return json(value);
  } catch (err) {
    console.error("[lookup]", (err as Error).message);
    return json({ error: (err as Error).message }, 502);
  }
}
