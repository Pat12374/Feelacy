import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { finalizeSellerPayout, PLAN_DEFAULTS } from "@/lib/commerce/fees";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const stripe = getStripe();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "Missing webhook secret" }, { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await prisma.stripeWebhookEvent.create({
      data: {
        id: event.id,
        type: event.type,
        accountId: event.account ?? null,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw error;
  }

  try {
    switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "payment" && session.metadata?.orderId) {
        if (session.payment_status !== "paid") break;

        const expectedPreTaxAmount = Number(session.metadata.expectedPreTaxAmount);
        const expectedCurrency = session.metadata.expectedCurrency?.toLowerCase();
        if (
          Number.isFinite(expectedPreTaxAmount) &&
          session.amount_subtotal != null &&
          session.amount_subtotal !== expectedPreTaxAmount
        ) {
          console.error("Stripe pre-tax amount mismatch", {
            orderId: session.metadata.orderId,
            expectedPreTaxAmount,
            amount_subtotal: session.amount_subtotal,
          });
          break;
        }
        if (
          expectedCurrency &&
          session.currency &&
          session.currency.toLowerCase() !== expectedCurrency
        ) {
          console.error("Stripe currency mismatch", {
            orderId: session.metadata.orderId,
          });
          break;
        }

        if (session.amount_total != null && session.amount_subtotal != null) {
          await applyCheckoutTax(
            session.metadata.orderId,
            session.amount_total,
            session.amount_total - session.amount_subtotal,
          );
        }
        await finalizePaidOrder(
          session.metadata.orderId,
          session.payment_intent,
          session.metadata.listingId,
          undefined,
          event.account ?? undefined,
        );
      }
      if (session.mode === "subscription" && session.metadata?.sellerId) {
        await applySubscriptionPlan(
          session.metadata.sellerId,
          session.metadata.planCode,
          session.metadata.expectedPriceId,
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id,
          stripe,
        );
      }
      break;
    }
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const orderId = pi.metadata?.orderId;
      if (!orderId) break;

      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) break;
      const preTaxAmount = order.productSubtotalCents + order.shippingCents;
      if (pi.amount_received < preTaxAmount) {
        console.error("PaymentIntent amount mismatch", {
          orderId,
          minimum: preTaxAmount,
          received: pi.amount_received,
        });
        break;
      }
      if (pi.amount_received !== order.buyerTotalCents) {
        await applyCheckoutTax(
          orderId,
          pi.amount_received,
          pi.amount_received - preTaxAmount,
        );
        order.buyerTotalCents = pi.amount_received;
      }

      let feeActual: number | undefined;
      const chargeId =
        typeof pi.latest_charge === "string"
          ? pi.latest_charge
          : pi.latest_charge?.id;
      if (chargeId) {
          const charge = await stripe.charges.retrieve(
            chargeId,
            {},
            event.account ? { stripeAccount: event.account } : undefined,
          );
        const balTxId =
          typeof charge.balance_transaction === "string"
            ? charge.balance_transaction
            : charge.balance_transaction?.id;
        if (balTxId) {
          const bal = await stripe.balanceTransactions.retrieve(
            balTxId,
            {},
            event.account ? { stripeAccount: event.account } : undefined,
          );
          feeActual = bal.fee;
          const settlement = await prisma.settlement.findUnique({
            where: { orderId },
          });
          if (settlement) {
            await prisma.settlement.update({
              where: { orderId },
              data: {
                processorFeeActualCents: feeActual,
                stripeBalanceTxId: balTxId,
                sellerPayoutCents: finalizeSellerPayout({
                  buyerTotalCents: order.buyerTotalCents,
                  commissionAmountCents: settlement.commissionAmountCents,
                  processorFeeActualCents: feeActual,
                }),
                finalizedAt: new Date(),
              },
            });
          }
        }
      }
      await finalizePaidOrder(
        orderId,
        pi.id,
        pi.metadata?.listingId,
        chargeId,
        event.account ?? undefined,
      );
      break;
    }
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.orderId) {
        await releasePendingOrder(session.metadata.orderId);
      }
      break;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      if (pi.metadata?.orderId) {
        await releasePendingOrder(pi.metadata.orderId);
      }
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const order = await prisma.order.findFirst({
        where: {
          OR: [
            { id: charge.metadata?.orderId || "__missing__" },
            { stripeChargeId: charge.id },
          ],
        },
        select: { id: true },
      });
      if (!order) break;
      await applyRefund(order.id, charge.amount_refunded);
      break;
    }
    case "customer.subscription.deleted":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const sellerId = subscription.metadata?.sellerId;
      if (sellerId) {
        await syncSubscriptionStatus(sellerId, subscription);
      }
      break;
    }
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      await prisma.sellerProfile.updateMany({
        where: { stripeAccountId: account.id },
        data: {
          stripeOnboardingComplete: Boolean(
            account.charges_enabled && account.payouts_enabled,
          ),
        },
      });
      break;
    }
    default:
      break;
    }

    await prisma.stripeWebhookEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() },
    });
  } catch (error) {
    // Remove the claim so Stripe's retry can process the event again.
    await prisma.stripeWebhookEvent.delete({ where: { id: event.id } }).catch(() => undefined);
    console.error("Stripe webhook processing failed", { eventId: event.id, error });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function finalizePaidOrder(
  orderId: string,
  paymentIntent: string | Stripe.PaymentIntent | null | undefined,
  listingId?: string,
  chargeId?: string,
  stripeAccountId?: string,
) {
  const piId =
    typeof paymentIntent === "string"
      ? paymentIntent
      : paymentIntent?.id ?? undefined;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, settlement: true },
  });
  if (!order || order.status === "PAID") return;
  if (order.status !== "PENDING") return;

  const targetListingId = listingId || order.items[0]?.listingId;
  if (!targetListingId) return;

  // Only finalize if listing is still reserved (or already sold by prior webhook)
  const listing = await prisma.listing.findUnique({
    where: { id: targetListingId },
  });
  if (!listing || (listing.status !== "RESERVED" && listing.status !== "SOLD")) {
    console.error("Listing not reserved for paid order", { orderId, targetListingId });
    return;
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: {
        status: "PAID",
        stripePaymentIntentId: piId,
        stripeChargeId: chargeId,
      },
    }),
    prisma.listing.update({
      where: { id: targetListingId },
      data: { status: "SOLD", quantity: 0 },
    }),
  ]);

  const delivery = await prisma.delivery.findUnique({ where: { orderId } });
  if (delivery?.status === "awaiting_payment") {
    await prisma.$transaction([
      prisma.delivery.update({ where: { id: delivery.id }, data: { status: "awaiting_seller_acceptance" } }),
      prisma.deliveryStatusHistory.create({ data: { deliveryId: delivery.id, fromStatus: "awaiting_payment", toStatus: "awaiting_seller_acceptance", source: "payment" } }),
    ]);
  }

  // Real Stripe payments are finalized only after the connected account's
  // BalanceTransaction supplies the actual processor fee.
  void stripeAccountId;
}

async function releasePendingOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order || order.status !== "PENDING") return;
  const listingId = order.items[0]?.listingId;
  await prisma.$transaction([
    prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } }),
    ...(listingId
      ? [
          prisma.listing.updateMany({
            where: { id: listingId, status: "RESERVED" },
            data: { status: "ACTIVE", quantity: { increment: 1 } },
          }),
        ]
      : []),
  ]);
}

async function applyCheckoutTax(
  orderId: string,
  buyerTotalCents: number,
  taxCents: number,
) {
  if (taxCents < 0) throw new Error("Stripe returned a negative tax amount");
  await prisma.$transaction([
    prisma.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { buyerTotalCents, taxCents },
    }),
    prisma.settlement.updateMany({
      where: { orderId },
      data: { taxCents },
    }),
  ]);
}

async function applyRefund(orderId: string, refundedCents: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { settlement: true },
  });
  if (!order || !order.settlement || refundedCents <= order.refundedCents) return;
  const fullRefund = refundedCents >= order.buyerTotalCents;
  const refundedCommissionCents = Math.min(
    order.settlement.commissionAmountCents,
    Math.round(
      (order.settlement.commissionAmountCents * refundedCents) /
        order.buyerTotalCents,
    ),
  );
  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: {
        refundedCents,
        status: fullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED",
      },
    }),
    prisma.settlement.update({
      where: { orderId },
      data: { refundedCommissionCents },
    }),
  ]);
}

async function syncSubscriptionStatus(
  sellerId: string,
  subscription: Stripe.Subscription,
) {
  const active = ["active", "trialing"].includes(subscription.status);
  const periodEnd = subscription.items.data[0]?.current_period_end;
  await prisma.subscription.upsert({
    where: { sellerId },
    create: {
      sellerId,
      stripeSubscriptionId: subscription.id,
      status: subscription.status.toUpperCase(),
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    },
    update: {
      status: subscription.status.toUpperCase(),
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    },
  });
  if (!active) {
    const starter = await prisma.sellerPlan.findUnique({ where: { code: "STARTER" } });
    if (starter) {
      await prisma.sellerProfile.update({
        where: { id: sellerId },
        data: { planId: starter.id, commissionBps: PLAN_DEFAULTS.STARTER.commissionBps },
      });
    }
  }
}

async function applySubscriptionPlan(
  sellerId: string,
  planCode: string | undefined,
  expectedPriceId: string | undefined,
  stripeSubscriptionId: string | undefined,
  stripe: Stripe,
) {
  if (!planCode || !(planCode in PLAN_DEFAULTS)) return;

  if (stripeSubscriptionId) {
    const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
      expand: ["items.data.price"],
    });
    const priceId = sub.items.data[0]?.price?.id;
    const envPrice =
      planCode === "MERCHANT"
        ? process.env.STRIPE_PRICE_MERCHANT
        : planCode === "PROFESSIONAL"
          ? process.env.STRIPE_PRICE_PROFESSIONAL
          : undefined;
    const plan = await prisma.sellerPlan.findUnique({
      where: { code: planCode },
    });
    const allowed = [expectedPriceId, envPrice, plan?.stripePriceId].filter(
      Boolean,
    );
    if (priceId && allowed.length > 0 && !allowed.includes(priceId)) {
      console.error("Subscription price mismatch", { sellerId, priceId, allowed });
      return;
    }
  }

  const plan = await prisma.sellerPlan.findUnique({
    where: { code: planCode },
  });
  if (!plan) return;
  const defaults = PLAN_DEFAULTS[planCode as keyof typeof PLAN_DEFAULTS];
  await prisma.sellerProfile.update({
    where: { id: sellerId },
    data: {
      planId: plan.id,
      commissionBps: defaults.commissionBps,
    },
  });
  await prisma.subscription.upsert({
    where: { sellerId },
    create: {
      sellerId,
      status: "ACTIVE",
      stripeSubscriptionId,
    },
    update: {
      status: "ACTIVE",
      stripeSubscriptionId,
    },
  });
}
