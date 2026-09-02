import Link from "next/link";
import { requireSeller } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatEur } from "@/lib/commerce/fees";

export const metadata = { title: "Seller orders" };

export default async function SellOrdersPage() {
  const { seller } = await requireSeller();
  const orders = await prisma.order.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "desc" },
    include: { items: true, settlement: true },
  });

  return (
    <div className="wt-container py-10">
      <h1 className="font-sans text-3xl font-semibold tracking-tight">Orders</h1>
      <div className="mt-6 grid gap-3">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/orders/${order.id}`}
            className="rounded-2xl border border-[var(--line)] bg-white/45 px-5 py-4"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-semibold">
                  {order.items.map((i) => i.title).join(", ")}
                </p>
                <p className="text-sm text-[var(--ink-soft)]">
                  {order.status} · {order.createdAt.toLocaleString("de-DE")}
                </p>
              </div>
              <div className="text-right text-sm">
                <p>Buyer paid {formatEur(order.buyerTotalCents)}</p>
                <p className="text-[var(--ink-soft)]">
                  Your net{" "}
                  {order.settlement?.sellerPayoutCents != null
                    ? formatEur(order.settlement.sellerPayoutCents)
                    : "—"}
                </p>
              </div>
            </div>
          </Link>
        ))}
        {orders.length === 0 && (
          <p className="text-[var(--ink-soft)]">No orders yet.</p>
        )}
      </div>
      <Link href="/sell" className="mt-8 inline-flex text-sm text-[var(--bottle)]">
        ← Seller home
      </Link>
    </div>
  );
}
