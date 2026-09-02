import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDeliveryProvider } from "@/lib/delivery/providers";
import { applyProviderEvent } from "@/lib/delivery/service";
import { rateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider: code } = await context.params;
  if (!rateLimit({ key: `delivery-webhook:${code}`, limit: 300, windowMs: 60_000 }).ok) return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  const config = await prisma.deliveryProviderConfig.findUnique({ where: { code } });
  if (!config?.enabled) return NextResponse.json({ error: "Provider unavailable" }, { status: 404 });
  let provider;
  try { provider = getDeliveryProvider(code); } catch { return NextResponse.json({ error: "Provider unavailable" }, { status: 404 }); }
  const rawBody = await request.text();
  if (!provider.verifyWebhook(request.headers, rawBody)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  let payload: unknown;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Invalid payload" }, { status: 400 }); }
  try { const result = await applyProviderEvent(config.id, provider.normalizeWebhook(payload), payload); return NextResponse.json({ received: true, ...result }); }
  catch { return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 }); }
}
