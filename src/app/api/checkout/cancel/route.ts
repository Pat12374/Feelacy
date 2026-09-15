import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyOrderCancellation } from "@/lib/security/tokens";

function appUrl(path: string) {
  return new URL(path, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
}

/** Release a RESERVED listing when the buyer cancels Stripe Checkout */
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId");
  const token = req.nextUrl.searchParams.get("token");
  if (!orderId || !verifyOrderCancellation(orderId, token)) {
    return NextResponse.redirect(appUrl("/search"));
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(appUrl("/login"));
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  // Only the purchasing buyer (or admin) may cancel a pending reservation
  const allowed =
    order &&
    (order.buyerId === session.user.id || dbUser?.role === "ADMIN");
  if (!allowed || order.status !== "PENDING") {
    return NextResponse.redirect(appUrl("/search"));
  }

  const listingId = order.items[0]?.listingId;
  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
    }),
    ...(listingId
      ? [
          prisma.listing.updateMany({
            where: { id: listingId, status: "RESERVED" },
            data: { status: "ACTIVE", quantity: { increment: 1 } },
          }),
        ]
      : []),
  ]);

  if (listingId) {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
    });
    if (listing) {
      return NextResponse.redirect(
        appUrl(`/listings/${listing.slug}?cancelled=1`),
      );
    }
  }

  return NextResponse.redirect(appUrl("/search"));
}
