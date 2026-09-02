import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { runMarketplaceAssistant } from "@/lib/ai/orchestrator";
import { clientIpFromHeaders, rateLimit } from "@/lib/security/rate-limit";

const schema = z.object({ message: z.string().trim().min(2).max(2000), mode: z.enum(["BUYER","SELLER","SUPPORT"]).optional(), conversationId: z.string().optional() });
export async function POST(request: Request) {
  const session = await auth(); if (!session?.user?.id) return NextResponse.json({ error: "Please sign in to use the WineTreff AI Assistant." }, { status: 401 });
  const limited = rateLimit({ key: `assistant:${session.user.id}:${clientIpFromHeaders(request.headers)}`, limit: 30, windowMs: 60_000 }); if (!limited.ok) return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Please enter a valid question." }, { status: 400 });
  if (parsed.data.mode === "SELLER" && !["SELLER","ADMIN"].includes(session.user.role)) return NextResponse.json({ error: "Seller mode requires a seller account." }, { status: 403 });
  return NextResponse.json(await runMarketplaceAssistant({ userId: session.user.id, ...parsed.data }));
}
