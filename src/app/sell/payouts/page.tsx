import Link from "next/link";
import { requireSeller } from "@/lib/session";
import { createConnectOnboardingLinkAction } from "@/lib/actions/marketplace";
import { isStripeConfigured } from "@/lib/stripe";

export const metadata = { title: "Payouts" };

export default async function SellPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string }>;
}) {
  const { seller } = await requireSeller();
  const sp = await searchParams;
  const stripeReady = isStripeConfigured();

  return (
    <div className="wt-container py-10">
      <h1 className="font-sans text-3xl font-semibold tracking-tight">Payouts</h1>
      <p className="mt-2 max-w-2xl text-[var(--ink-soft)]">
        Connect a Stripe Express account to receive sale proceeds. WineTreff
        commission is taken as an application fee; payment-processing charges
        are deducted from seller proceeds and disclosed separately.
      </p>

      {sp.connected && (
        <p className="mt-4 rounded-xl bg-[rgba(31,92,58,0.12)] px-4 py-3 text-sm text-[var(--ok)]">
          Stripe onboarding returned — status syncs via webhook.
        </p>
      )}

      <div className="mt-8 rounded-2xl border border-[var(--line)] bg-white/50 p-6">
        <p className="text-sm">
          Stripe account:{" "}
          <strong>{seller.stripeAccountId ?? "Not connected"}</strong>
        </p>
        <p className="mt-2 text-sm">
          Onboarding complete:{" "}
          <strong>{seller.stripeOnboardingComplete ? "Yes" : "No"}</strong>
        </p>
        {!stripeReady && (
          <p className="mt-4 text-sm text-[var(--ink-soft)]">
            Stripe keys are not configured. Demo checkout still works and
            records estimated processor fees as actual for local development.
          </p>
        )}
        {stripeReady && (
          <form action={createConnectOnboardingLinkAction} className="mt-5">
            <button type="submit" className="wt-btn wt-btn-primary">
              {seller.stripeAccountId
                ? "Continue Stripe onboarding"
                : "Connect Stripe"}
            </button>
          </form>
        )}
      </div>

      <Link href="/sell" className="mt-8 inline-flex text-sm text-[var(--bottle)]">
        ← Seller home
      </Link>
    </div>
  );
}
