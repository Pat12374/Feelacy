import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import {
  formatBpsAsPercent,
  formatEur,
} from "@/lib/commerce/fees";
import {
  moderateListingAction,
  setEnterpriseCommissionAction,
} from "@/lib/actions/marketplace";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();
  const [sellers, listings] = await Promise.all([
    prisma.sellerProfile.findMany({
      include: { plan: true, user: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.listing.findMany({
      orderBy: { updatedAt: "desc" },
      take: 30,
      include: { seller: true },
    }),
  ]);

  return (
    <div className="wt-container py-10">
      <h1 className="font-sans text-4xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-2 text-[var(--ink-soft)]">
        Moderate listings and set Enterprise commission (3.5%–4.5%).
      </p>
      <Link href="/admin/express" className="wt-btn wt-btn-primary mt-5">Open Express monitor</Link>

      <h2 className="mt-10 font-display text-2xl">Sellers</h2>
      <div className="mt-4 grid gap-4">
        {sellers.map((s) => (
          <div
            key={s.id}
            className="rounded-2xl border border-[var(--line)] bg-white/45 p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{s.displayName}</p>
                <p className="text-sm text-[var(--ink-soft)]">
                  {s.user.email} · {s.plan.name} ·{" "}
                  {formatBpsAsPercent(s.commissionBps)}
                </p>
              </div>
              <form action={setEnterpriseCommissionAction} className="flex gap-2">
                <input type="hidden" name="sellerId" value={s.id} />
                <input
                  className="wt-input !w-28"
                  name="commissionBps"
                  type="number"
                  min={350}
                  max={450}
                  defaultValue={s.commissionBps}
                  title="Basis points (350–450)"
                />
                <button type="submit" className="wt-btn wt-btn-secondary !py-2 text-sm">
                  Set Enterprise bps
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-10 font-display text-2xl">Listings</h2>
      <div className="mt-4 grid gap-3">
        {listings.map((l) => (
          <div
            key={l.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white/45 px-5 py-4"
          >
            <div>
              <p className="font-semibold">{l.title}</p>
              <p className="text-sm text-[var(--ink-soft)]">
                {l.seller.displayName} · {l.status} · {formatEur(l.priceCents)}
              </p>
            </div>
            <div className="flex gap-2">
              <form action={moderateListingAction}>
                <input type="hidden" name="listingId" value={l.id} />
                <input type="hidden" name="status" value="ACTIVE" />
                <button type="submit" className="wt-btn wt-btn-secondary !py-2 text-sm">
                  Activate
                </button>
              </form>
              <form action={moderateListingAction}>
                <input type="hidden" name="listingId" value={l.id} />
                <input type="hidden" name="status" value="UNLISTED" />
                <button type="submit" className="wt-btn wt-btn-secondary !py-2 text-sm">
                  Unlist
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
