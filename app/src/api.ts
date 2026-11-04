import type { AiResult } from "./types";
import { getDeviceId, type Settings } from "./settings";

export class ApiError extends Error {}

async function call(settings: Settings, path: string, init: RequestInit = {}, timeoutMs = 40_000) {
  if (!settings.apiUrl) throw new ApiError("Server address is not set (Settings ⚙️)");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(settings.apiUrl + path, {
      ...init,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-app-secret": settings.appSecret,
        "x-device-id": await getDeviceId(),
        ...(init.headers ?? {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) throw new ApiError("App secret is wrong (Settings ⚙️)");
      throw new ApiError(data?.error || `Server error ${res.status}`);
    }
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === "AbortError") throw new ApiError("Server took too long to answer");
    throw new ApiError("Could not reach the server");
  } finally {
    clearTimeout(timer);
  }
}

export async function askAi(settings: Settings, query: string, hint?: string): Promise<AiResult> {
  const data = await call(settings, "/api/lookup", { method: "POST", body: JSON.stringify({ query, hint }) });
  if (!data?.result) throw new ApiError("Empty answer from server");
  return data.result as AiResult;
}

/** Checks the address and the secret without using any AI credit. */
export async function checkConnection(settings: Settings): Promise<string> {
  const data = await call(settings, "/api/ping", { method: "GET" }, 15_000);
  const providers: { name: string; keys: number }[] = data?.providers ?? [];
  const withKeys = providers.filter((p) => p.keys > 0).map((p) => `${p.name} (${p.keys})`);
  return withKeys.length ? `Connected ✓  Keys: ${withKeys.join(", ")}` : "Connected ✓  but no API keys are set on the server";
}
