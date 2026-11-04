import { testAllKeys } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Browser check that every API key really answers:
//   /api/test?secret=YOUR_APP_SECRET&q=verdict
// Uses one small AI call per key. Keys are shown by their last 4 characters only.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.APP_SECRET;
  if (!secret) return Response.json({ error: "Server is missing APP_SECRET" }, { status: 500 });
  if (url.searchParams.get("secret") !== secret) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const q = (url.searchParams.get("q") || "verdict").slice(0, 100);
  const results = await testAllKeys(q);
  return Response.json({ query: q, allOk: results.every((r) => r.ok), results }, { headers: { "cache-control": "no-store" } });
}
