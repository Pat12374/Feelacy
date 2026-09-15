import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  formatBpsAsPercent,
  formatEur,
} from "@/lib/commerce/fees";
import { refundOrderAction, updateShippingAction } from "@/lib/actions/marketplace";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return { title: `Order ${(await params).id.slice(0, 8)}` };
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string; demo?: string; shipping?: string; refund?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/login?next=${encodeURIComponent(`/orders/${id}`)}`);

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      seller: true,
      settlement: true,
      buyer: true,
      delivery: { include: { history: { orderBy: { createdAt: "asc" } }, providerConfig: true } },
    },
  });
  if (!order) notFound();

  const isBuyer = order.buyerId === session.user.id;
  const isSeller = order.seller.userId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isBuyer && !isSeller && !isAdmin) notFound();

  return (
    <div className="wt-container py-10">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--copper)]">
        Order · {order.status}
      </p>
      <h1 className="mt-2 font-sans text-4xl font-semibold tracking-tight">Purchase confirmation</h1>
      {sp.paid && (
        <p className="mt-3 rounded-xl bg-[rgba(31,92,58,0.12)] px-4 py-3 text-sm text-[var(--ok)]">
          Payment recorded
          {sp.demo
            ? " (demo mode — Stripe not configured; settlement used estimated processor fee as actual)."
            : "."}
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--line)] bg-white/50 p-6">
          <h2 className="font-display text-xl">Buyer receipt</h2>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Buyers pay only product price, shipping, and applicable taxes — never
            WineBloom commissions.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4">
                <span>{item.title}</span>
                <span>{formatEur(item.unitPriceCents)}</span>
              </li>
            ))}
            <li className="flex justify-between gap-4 border-t border-[var(--line)] pt-2">
              <span>Shipping</span>
              <span>{formatEur(order.shippingCents)}</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Tax / duty</span>
              <span>{formatEur(order.taxCents)}</span>
            </li>
            <li className="flex justify-between gap-4 border-t border-[var(--line)] pt-2 text-base font-semibold">
              <span>Total paid</span>
              <span>{formatEur(order.buyerTotalCents)}</span>
            </li>
          </ul>
        </div>

        {(isSeller || isAdmin) && order.settlement && (
          <div className="rounded-2xl border border-[var(--line)] bg-[rgba(31,61,50,0.06)] p-6">
            <h2 className="font-display text-xl">Seller settlement</h2>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex justify-between gap-4">
                <span>Product subtotal</span>
                <span>{formatEur(order.settlement.productSubtotalCents)}</span>
              </li>
              <li className="flex justify-between gap-4">
                <span>Shipping</span>
                <span>{formatEur(order.settlement.shippingCents)}</span>
              </li>
              <li className="flex justify-between gap-4">
                <span>
                  WineBloom commission (
                  {formatBpsAsPercent(order.settlement.commissionBps)})
                </span>
                <span>
                  −{formatEur(order.settlement.commissionAmountCents)}
                </span>
              </li>
              <li className="flex justify-between gap-4">
                <span>Payment processing (estimated)</span>
                <span>
                  −{formatEur(order.settlement.processorFeeEstimatedCents)}
                </span>
              </li>
              <li className="flex justify-between gap-4">
                <span>Payment processing (actual)</span>
                <span>
                  {order.settlement.processorFeeActualCents != null
                    ? `−${formatEur(order.settlement.processorFeeActualCents)}`
                    : "Pending capture"}
                </span>
              </li>
              <li className="flex justify-between gap-4 border-t border-[var(--line)] pt-2 font-semibold">
                <span>Seller proceeds</span>
                <span>
                  {order.settlement.sellerPayoutCents != null
                    ? formatEur(order.settlement.sellerPayoutCents)
                    : "—"}
                </span>
              </li>
            </ul>
          </div>
        )}
      </div>

      {order.delivery && (
        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white/50 p-6" aria-labelledby="delivery-status">
          <p className="text-xs uppercase tracking-[.16em] text-[var(--copper)]">WineBloom Express</p>
          <h2 id="delivery-status" className="mt-1 font-display text-2xl">{order.delivery.status.replaceAll("_", " ")}</h2>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">The seller prepares this order and an approved third-party courier transports it. Arrival times are estimates until seller acceptance and courier confirmation.</p>
          {order.delivery.ageRestricted && <div className="mt-4 rounded-xl bg-[rgba(176,138,90,.15)] p-4 text-sm"><strong>Eligible recipient required.</strong> Someone eligible must be physically present with valid identification. This order cannot be left unattended and returns to the seller after a failed delivery.</div>}
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="font-semibold">Estimated arrival</dt><dd>{order.delivery.deliveryEta?.toLocaleString() ?? "Awaiting courier confirmation"}</dd></div><div><dt className="font-semibold">Tracking</dt><dd>{order.delivery.trackingUrl ? <a href={order.delivery.trackingUrl} className="underline" rel="noreferrer" target="_blank">Open courier tracking</a> : "Not assigned yet"}</dd></div></dl>
          {order.delivery.customerExplanation && <p className="mt-4 rounded-xl bg-[rgba(139,46,46,.1)] p-4 text-sm text-[var(--danger)]">{order.delivery.customerExplanation} Refund responsibility is pending support review.</p>}
          <ol className="mt-5 border-l border-[var(--line)] pl-5">{order.delivery.history.map(h=><li key={h.id} className="relative pb-4 text-sm"><span className="absolute -left-[1.45rem] top-1 h-2 w-2 rounded-full bg-[var(--bottle)]"/><span className="font-semibold">{h.toStatus.replaceAll("_", " ")}</span><span className="block text-[var(--ink-soft)]">{h.createdAt.toLocaleString()}</span></li>)}</ol>
          <a className="wt-btn wt-btn-secondary mt-2" href="mailto:support@feelacy.com?subject=Delivery support">Contact WineBloom support</a>
        </section>
      )}

      {(order.shippedAt || isSeller || isAdmin) && (
        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white/50 p-6">
          <h2 className="font-display text-xl">Seller-managed shipping</h2>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            The seller—not WineBloom—is responsible for packing, dispatch,
            tracking, delivery communication, and shipping compliance.
          </p>
          {order.shippedAt && (
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="font-semibold">Carrier</dt><dd>{order.carrier || "Not provided"}</dd></div>
              <div><dt className="font-semibold">Tracking</dt><dd>{order.trackingUrl ? <a className="underline" href={order.trackingUrl} rel="noreferrer" target="_blank">{order.trackingNumber || "Open tracking"}</a> : order.trackingNumber || "Not provided"}</dd></div>
            </dl>
          )}
          {isSeller && ["PAID", "SHIPPED", "DELIVERED"].includes(order.status) && (
            <form action={updateShippingAction} className="mt-5 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="orderId" value={order.id} />
              <label className="wt-label">Carrier<input className="wt-input" name="carrier" defaultValue={order.carrier ?? ""} maxLength={80} /></label>
              <label className="wt-label">Tracking number<input className="wt-input" name="trackingNumber" defaultValue={order.trackingNumber ?? ""} maxLength={160} /></label>
              <label className="wt-label sm:col-span-2">Tracking URL<input className="wt-input" name="trackingUrl" type="url" defaultValue={order.trackingUrl ?? ""} maxLength={2000} /></label>
              <div className="flex gap-3 sm:col-span-2">
                <button className="wt-btn wt-btn-secondary" name="status" value="SHIPPED">Mark shipped</button>
                <button className="wt-btn wt-btn-primary" name="status" value="DELIVERED">Mark delivered</button>
              </div>
            </form>
          )}
        </section>
      )}

      {isSeller && order.stripeChargeId && ["PAID", "SHIPPED", "DELIVERED", "PARTIALLY_REFUNDED"].includes(order.status) && (
        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white/50 p-6">
          <h2 className="font-display text-xl">Issue refund</h2>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">Refunds are sent through the seller’s connected Stripe account. Refunded so far: {formatEur(order.refundedCents)}.</p>
          <form action={refundOrderAction} className="mt-4 flex max-w-md items-end gap-3">
            <input type="hidden" name="orderId" value={order.id} />
            <label className="wt-label flex-1">Amount (EUR)<input className="wt-input" name="amountEuros" type="number" min="0.01" max={(order.buyerTotalCents - order.refundedCents) / 100} step="0.01" required /></label>
            <button className="wt-btn wt-btn-secondary">Refund</button>
          </form>
        </section>
      )}

      <Link href="/account" className="wt-btn wt-btn-secondary mt-8 inline-flex">
        Back to account
      </Link>
    </div>
  );
}
