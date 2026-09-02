import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expired = await prisma.order.findMany({
    where: {
      status: "PENDING",
      reservationExpiresAt: { lt: new Date() },
    },
    include: { items: true },
    take: 100,
  });

  for (const order of expired) {
    const listingId = order.items[0]?.listingId;
    await prisma.$transaction(async (tx) => {
      const cancelled = await tx.order.updateMany({
        where: { id: order.id, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      if (cancelled.count === 1 && listingId) {
        await tx.listing.updateMany({
          where: { id: listingId, status: "RESERVED" },
          data: { status: "ACTIVE", quantity: { increment: 1 } },
        });
      }
    });
  }

  return NextResponse.json({ released: expired.length });
}
