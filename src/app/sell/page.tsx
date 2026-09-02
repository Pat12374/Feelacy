import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSeller } from "@/lib/session";
import { prisma } from "@/lib/db";
import {
  formatBpsAsPercent,
  formatEur,
} from "@/lib/commerce/fees";

export async function generateMetadata() {
  const t = await getTranslations("sell");
  return { title: t("console") };
}

export default async function SellHomePage() {
  const t = await getTranslations("sell");
  const { seller } = await requireSeller();
  const [listingCount, paidOrders, recent] = await Promise.all([
    prisma.listing.count({ where: { sellerId: seller.id } }),
    prisma.order.count({ where: { sellerId: seller.id, status: "PAID" } }),
    prisma.order.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { items: true, settlement: true },
    }),
  ]);

  return (
    <div className="wt-container py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--copper)]">
            {t("console")}
          </p>
          <h1 className="font-sans text-4xl font-semibold tracking-tight">{seller.displayName}</h1>
          <p className="mt-2 text-[var(--ink-soft)]">
            {seller.plan.name} · {formatBpsAsPercent(seller.commissionBps)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/sell/listings/new" className="wt-btn wt-btn-primary">
            {t("newListing")}
          </Link>
          <Link href={`/merchants/${seller.slug}`} className="wt-btn wt-btn-secondary">
            {t("publicShop")}
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label={t("listings")} value={String(listingCount)} />
        <Stat label={t("completedSales")} value={String(paidOrders)} />
        <Stat
          label={t("planFee")}
          value={
            seller.plan.monthlyPriceCents === 0
              ? t("free")
              : formatEur(seller.plan.monthlyPriceCents) + "/mo"
          }
        />
      </div>

      <nav className="mt-8 flex flex-wrap gap-2 text-sm">
        {[
          ["/sell/listings", t("listings")],
          ["/sell/orders", t("orders")],
          ["/sell/plan", t("planFees")],
          ["/sell/payouts", t("payouts")],
          ["/sell/express", "WineTreff Express"],
          ["/sell/assistant", "Listing Assistant"],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="wt-btn wt-btn-secondary !py-2">
            {label}
          </Link>
        ))}
      </nav>

      <h2 className="mt-10 font-display text-2xl">{t("recentOrders")}</h2>
      <div className="mt-4 grid gap-3">
        {recent.map((order) => (
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
                <p className="text-sm text-[var(--ink-soft)]">{order.status}</p>
              </div>
              <p className="text-sm">
                {order.settlement?.sellerPayoutCents != null
                  ? formatEur(order.settlement.sellerPayoutCents)
                  : "—"}
              </p>
            </div>
          </Link>
        ))}
        {recent.length === 0 && (
          <p className="text-[var(--ink-soft)]">{t("noOrders")}</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white/45 p-5">
      <p className="text-sm text-[var(--ink-soft)]">{label}</p>
      <p className="mt-1 font-display text-3xl">{value}</p>
    </div>
  );
}
