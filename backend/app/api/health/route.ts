import { configuredProviders } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Shows which providers have keys (counts only, never the keys themselves).
export async function GET() {
  return Response.json({
    ok: true,
    appSecretSet: Boolean(process.env.APP_SECRET),
    providers: configuredProviders(),
  });
}
