import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isProduction } from "@/lib/security/env";
import { formatEur } from "@/lib/commerce/fees";

export const metadata = { title: "Express delivery demo" };

export default async function DeliveryDemoPage() {
  if (isProduction()) notFound();

  const order = await prisma.order.findFirst({
    where: { stripePaymentIntentId: "demo_delivery_feature" },
    include: {
      items: true,
      seller: { select: { displayName: true } },
      delivery: {
        include: {
          providerConfig: { select: { displayName: true } },
          history: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!order?.delivery) notFound();

  const delivery = order.delivery;
  return (
    <div className="wt-container py-10">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--copper)]">
        Privacy-safe local demonstration
      </p>
      <h1 className="mt-2 font-sans text-4xl font-semibold tracking-tight">
        WineTreff Express tracking
      </h1>
      <p className="mt-2 max-w-3xl text-[var(--ink-soft)]">
        This sandbox view contains no buyer address or personal information. The
        independent seller prepares the order and an approved third-party courier
        transports it.
      </p>

      <section className="mt-8 rounded-3xl border border-[var(--line)] bg-white/55 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--ink-soft)]">Current status</p>
            <p className="mt-1 font-display text-3xl capitalize">
              {delivery.status.replaceAll("_", " ")}
            </p>
          </div>
          <span className="rounded-full bg-[rgba(31,92,58,.12)] px-4 py-2 text-sm font-semibold text-[var(--ok)]">
            Sandbox courier
          </span>
        </div>

        <dl className="mt-6 grid gap-4 border-y border-[var(--line)] py-5 text-sm sm:grid-cols-3">
          <div><dt className="text-[var(--ink-soft)]">Item</dt><dd className="font-semibold">{order.items.map(i => i.title).join(", ")}</dd></div>
          <div><dt className="text-[var(--ink-soft)]">Seller</dt><dd className="font-semibold">{order.seller.displayName}</dd></div>
          <div><dt className="text-[var(--ink-soft)]">Delivery fee</dt><dd className="font-semibold">{formatEur(order.shippingCents)}</dd></div>
        </dl>

        <h2 className="mt-6 font-display text-2xl">Delivery timeline</h2>
        <ol className="mt-5 border-l border-[var(--line)] pl-6">
          {delivery.history.map((event) => (
            <li key={event.id} className="relative pb-5">
              <span className="absolute -left-[1.78rem] top-1 h-3 w-3 rounded-full bg-[var(--bottle)]" />
              <p className="font-semibold capitalize">{event.toStatus.replaceAll("_", " ")}</p>
              <p className="text-sm text-[var(--ink-soft)]">{event.createdAt.toLocaleString()}</p>
              {event.detail && <p className="mt-1 text-sm">{event.detail}</p>}
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/assistant" className="wt-btn wt-btn-primary">Open AI Assistant</Link>
        <Link href="/search" className="wt-btn wt-btn-secondary">Browse marketplace</Link>
      </div>
    </div>
  );
}
