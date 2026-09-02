import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatEur } from "@/lib/commerce/fees";

export async function generateMetadata() {
  const t = await getTranslations("account");
  return { title: t("title") };
}

export default async function AccountPage() {
  const t = await getTranslations("account");
  const session = await requireSession();
  const [user, orders] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      include: { sellerProfile: { include: { plan: true } } },
    }),
    prisma.order.findMany({
      where: { buyerId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { items: true, seller: true },
    }),
  ]);
  if (!user) return null;

  return (
    <div className="wt-container py-10">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--copper)]">
        {t("title")}
      </p>
      <h1 className="mt-2 font-sans text-4xl font-semibold tracking-tight">
        Welcome, {user.name?.trim() || "WineTreff member"}
      </h1>
      <p className="mt-2 text-[var(--ink-soft)]">Your WineTreff profile and marketplace access.</p>

      <section className="mt-8 grid gap-4 rounded-2xl border border-[var(--line)] bg-white/50 p-6 sm:grid-cols-2">
        <div><p className="text-sm text-[var(--ink-soft)]">Name</p><p className="font-semibold">{user.name || "Not provided"}</p></div>
        <div><p className="text-sm text-[var(--ink-soft)]">Email</p><p className="font-semibold">{user.email}</p></div>
        <div><p className="text-sm text-[var(--ink-soft)]">Account role</p><p className="font-semibold">{user.role}</p></div>
        <div><p className="text-sm text-[var(--ink-soft)]">Age eligibility</p><p className={`font-semibold ${user.ageVerifiedAt ? "text-[var(--ok)]" : "text-[var(--danger)]"}`}>{user.ageVerifiedAt ? `Confirmed ${user.ageVerifiedAt.toLocaleDateString()}` : "Action required before buying or selling"}</p></div>
        {user.sellerProfile && <><div><p className="text-sm text-[var(--ink-soft)]">Seller profile</p><p className="font-semibold">{user.sellerProfile.displayName}</p></div><div><p className="text-sm text-[var(--ink-soft)]">Seller plan</p><p className="font-semibold">{user.sellerProfile.plan.name}</p></div></>}
      </section>

      {!user.ageVerifiedAt && <div className="mt-5 rounded-2xl border border-[var(--copper)] bg-[rgba(176,138,90,.12)] p-5"><h2 className="font-display text-xl">Complete the age gate</h2><p className="mt-1 text-sm text-[var(--ink-soft)]">WineTreff requires age confirmation before purchasing alcohol or opening a seller profile.</p><Link href="/age-gate?next=/account" className="wt-btn wt-btn-primary mt-4">Confirm eligibility</Link></div>}

      <div className="mt-8 flex flex-wrap gap-3">
        {user.sellerProfile ? <Link href="/sell/listings/new" className="wt-btn wt-btn-primary">List a product</Link> : <Link href="/sell/onboarding" className="wt-btn wt-btn-primary">Become a seller</Link>}
        <Link href="/search" className="wt-btn wt-btn-secondary">
          Buy a product
        </Link>
        {user.sellerProfile && <Link href="/sell" className="wt-btn wt-btn-secondary">{t("sellerConsole")}</Link>}
      </div>

      <h2 className="mt-12 font-display text-2xl">{t("orders")}</h2>
      <div className="mt-4 grid gap-3">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/orders/${order.id}`}
            className="rounded-2xl border border-[var(--line)] bg-white/45 px-5 py-4 transition hover:bg-white/70"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">
                  {order.items.map((i) => i.title).join(", ")}
                </p>
                <p className="text-sm text-[var(--ink-soft)]">
                  {order.seller.displayName} · {order.status}
                </p>
              </div>
              <p className="font-semibold">{formatEur(order.buyerTotalCents)}</p>
            </div>
          </Link>
        ))}
        {orders.length === 0 && (
          <p className="text-[var(--ink-soft)]">{t("noPurchases")}</p>
        )}
      </div>
    </div>
  );
}
