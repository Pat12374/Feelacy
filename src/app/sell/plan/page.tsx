import Link from "next/link";
import { requireSeller } from "@/lib/session";
import { prisma } from "@/lib/db";
import {
  formatBpsAsPercent,
  formatEur,
} from "@/lib/commerce/fees";
import { changeSellerPlanAction } from "@/lib/actions/marketplace";

export const metadata = { title: "Plan & fees" };

export default async function SellPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const { seller } = await requireSeller();
  const sp = await searchParams;
  const plans = await prisma.sellerPlan.findMany({
    orderBy: { monthlyPriceCents: "asc" },
  });

  return (
    <div className="wt-container py-10">
      <h1 className="font-sans text-3xl font-semibold tracking-tight">Plan &amp; fees</h1>
      <p className="mt-2 max-w-2xl text-[var(--ink-soft)]">
        Hybrid subscription + commission. Payment-processing costs are deducted
        from your proceeds and shown separately from WineBloom commission.
        Buyers never pay marketplace fees.
      </p>
      {sp.upgraded && (
        <p className="mt-4 rounded-xl bg-[rgba(31,92,58,0.12)] px-4 py-3 text-sm text-[var(--ok)]">
          Plan updated.
        </p>
      )}

      <p className="mt-6 text-sm">
        Current: <strong>{seller.plan.name}</strong> ·{" "}
        {formatBpsAsPercent(seller.commissionBps)} commission
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {plans.map((plan) => {
          const active = plan.id === seller.planId;
          return (
            <div
              key={plan.id}
              className="rounded-2xl border border-[var(--line)] bg-white/50 p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl">{plan.name}</h2>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">
                    {plan.description}
                  </p>
                </div>
                {active && (
                  <span className="rounded-full bg-[var(--bottle)] px-3 py-1 text-xs text-[var(--paper)]">
                    Current
                  </span>
                )}
              </div>
              <p className="mt-4 font-display text-3xl">
                {plan.monthlyPriceCents === 0
                  ? "Free"
                  : `${formatEur(plan.monthlyPriceCents)}/mo`}
              </p>
              <p className="mt-1 text-sm">
                {formatBpsAsPercent(plan.defaultCommissionBps)} completed-sale
                commission
                {plan.code === "ENTERPRISE" ? " (negotiated range)" : ""}
              </p>
              {!active && plan.code !== "ENTERPRISE" && (
                <form
                  action={async () => {
                    "use server";
                    await changeSellerPlanAction(plan.code);
                  }}
                  className="mt-5"
                >
                  <button type="submit" className="wt-btn wt-btn-primary">
                    Switch to {plan.name}
                  </button>
                </form>
              )}
              {plan.code === "ENTERPRISE" && !active && (
                <p className="mt-5 text-sm text-[var(--ink-soft)]">
                  Contact WineBloom admin for Enterprise onboarding.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-10 rounded-2xl border border-[var(--line)] bg-[rgba(31,61,50,0.06)] p-6 text-sm">
        <h3 className="font-semibold">Settlement formula</h3>
        <p className="mt-2 text-[var(--ink-soft)]">
          Seller proceeds = (product + shipping + tax collected) − WineBloom
          commission − payment-processing fee. Commission applies to product
          subtotal only. Processor fee estimated at 2.5% + €0.25; actual
          provider charge is recorded after capture.
        </p>
        <Link href="/legal/fees" className="mt-3 inline-flex text-[var(--bottle)]">
          Full fee disclosure →
        </Link>
      </div>

      <Link href="/sell" className="mt-8 inline-flex text-sm text-[var(--bottle)]">
        ← Seller home
      </Link>
    </div>
  );
}
