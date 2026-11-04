import { configuredProviders } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lets the app check its server address and secret without spending any AI credit.
export async function GET(req: Request) {
  const secret = process.env.APP_SECRET;
  if (!secret) return Response.json({ error: "Server is missing APP_SECRET" }, { status: 500 });
  if (req.headers.get("x-app-secret") !== secret) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ ok: true, providers: configuredProviders().map(({ name, keys }) => ({ name, keys })) });
}
