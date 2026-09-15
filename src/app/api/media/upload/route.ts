import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSeller } from "@/lib/session";
import { createListingUpload } from "@/lib/media";
import { clientIpFromHeaders, rateLimit } from "@/lib/security/rate-limit";

const requestSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z.number().int().positive().max(8 * 1024 * 1024),
});

export async function POST(request: NextRequest) {
  const { session } = await requireSeller();
  const limited = rateLimit({
    key: `media-upload:${session.user.id}:${clientIpFromHeaders(request.headers)}`,
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many upload requests" }, { status: 429 });
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }
  try {
    return NextResponse.json(await createListingUpload(parsed.data));
  } catch {
    return NextResponse.json({ error: "Media storage unavailable" }, { status: 503 });
  }
}
