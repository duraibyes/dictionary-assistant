import { runWithFallback } from "@/lib/providers";
import { parseTutor, toMessages, tutorSystem } from "@/lib/tutor";

export const runtime = "nodejs";
export const maxDuration = 60;

const hits = new Map<string, number[]>();
const RATE_LIMIT = 30; // messages per minute per device

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

// English Teacher: body { history: [{role: "user"|"teacher", text}], topic?: string }
// The last history item must be the learner's new message.
export async function POST(req: Request) {
  const secret = process.env.APP_SECRET;
  if (!secret) return json({ error: "Server is missing APP_SECRET" }, 500);
  if (req.headers.get("x-app-secret") !== secret) return json({ error: "Unauthorized" }, 401);

  const who = req.headers.get("x-device-id") || req.headers.get("x-forwarded-for") || "anon";
  const now = Date.now();
  const recent = (hits.get(who) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= RATE_LIMIT) return json({ error: "Too many messages, wait a minute" }, 429);
  recent.push(now);
  hits.set(who, recent);

  let body: { history?: unknown; topic?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }
  const history = Array.isArray(body.history)
    ? body.history
        .filter((h): h is { role: "user" | "teacher"; text: string } =>
          !!h && (h.role === "user" || h.role === "teacher") && typeof h.text === "string",
        )
    : [];
  const last = history[history.length - 1];
  if (!last || last.role !== "user" || !last.text.trim()) return json({ error: "Send the learner's message last" }, 400);
  const topic = typeof body.topic === "string" ? body.topic.slice(0, 120) : undefined;

  try {
    const { value, provider, model } = await runWithFallback(tutorSystem(topic), toMessages(history), parseTutor);
    return json({ turn: value, provider, model });
  } catch (err) {
    console.error("[chat]", (err as Error).message);
    return json({ error: (err as Error).message }, 502);
  }
}
