import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Release a RESERVED listing when the buyer cancels Stripe Checkout */
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.redirect(new URL("/search", req.url));
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
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
    return NextResponse.redirect(new URL("/search", req.url));
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
        new URL(`/listings/${listing.slug}?cancelled=1`, req.url),
      );
    }
  }

  return NextResponse.redirect(new URL("/search", req.url));
}
