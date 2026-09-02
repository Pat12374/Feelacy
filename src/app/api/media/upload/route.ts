import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSeller } from "@/lib/session";
import { createListingUpload } from "@/lib/media";

const requestSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z.number().int().positive().max(8 * 1024 * 1024),
});

export async function POST(request: NextRequest) {
  await requireSeller();
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
