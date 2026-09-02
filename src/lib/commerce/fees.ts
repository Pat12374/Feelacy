/** WineTreff commerce fee rules — see docs/FEES.md */

export const PROCESSOR_FEE_RATE = 0.025;
export const PROCESSOR_FEE_FIXED_CENTS = 25;

export type PlanCommission = {
  code: string;
  monthlyPriceCents: number;
  commissionBps: number;
};

export const PLAN_DEFAULTS: Record<
  "STARTER" | "MERCHANT" | "PROFESSIONAL" | "ENTERPRISE",
  PlanCommission
> = {
  STARTER: { code: "STARTER", monthlyPriceCents: 0, commissionBps: 1000 },
  MERCHANT: { code: "MERCHANT", monthlyPriceCents: 4900, commissionBps: 700 },
  PROFESSIONAL: {
    code: "PROFESSIONAL",
    monthlyPriceCents: 14900,
    commissionBps: 500,
  },
  ENTERPRISE: {
    code: "ENTERPRISE",
    monthlyPriceCents: 39900,
    commissionBps: 400,
  },
};

export const ENTERPRISE_COMMISSION_BPS_MIN = 350;
export const ENTERPRISE_COMMISSION_BPS_MAX = 450;

/** Planning estimate: 2.5% + €0.25 per payment */
export function estimateProcessorFeeCents(amountCents: number): number {
  return Math.round(amountCents * PROCESSOR_FEE_RATE) + PROCESSOR_FEE_FIXED_CENTS;
}

export function commissionCents(
  productSubtotalCents: number,
  commissionBps: number,
): number {
  return Math.round((productSubtotalCents * commissionBps) / 10000);
}

/** Buyers never pay WineTreff commission or processor fees */
export function buyerTotalCents(input: {
  productSubtotalCents: number;
  shippingCents: number;
  taxCents?: number;
}): number {
  return (
    input.productSubtotalCents +
    input.shippingCents +
    (input.taxCents ?? 0)
  );
}

export function buildSettlementPreview(input: {
  productSubtotalCents: number;
  shippingCents: number;
  taxCents?: number;
  commissionBps: number;
}) {
  const taxCents = input.taxCents ?? 0;
  const buyerTotal = buyerTotalCents({
    productSubtotalCents: input.productSubtotalCents,
    shippingCents: input.shippingCents,
    taxCents,
  });
  const commissionAmount = commissionCents(
    input.productSubtotalCents,
    input.commissionBps,
  );
  const processorFeeEstimated = estimateProcessorFeeCents(buyerTotal);
  const sellerPayoutEstimated =
    buyerTotal - commissionAmount - processorFeeEstimated;

  return {
    productSubtotalCents: input.productSubtotalCents,
    shippingCents: input.shippingCents,
    taxCents,
    buyerTotalCents: buyerTotal,
    commissionBps: input.commissionBps,
    commissionAmountCents: commissionAmount,
    processorFeeEstimatedCents: processorFeeEstimated,
    sellerPayoutEstimatedCents: sellerPayoutEstimated,
  };
}

export function finalizeSellerPayout(input: {
  buyerTotalCents: number;
  commissionAmountCents: number;
  processorFeeActualCents: number;
}): number {
  return (
    input.buyerTotalCents -
    input.commissionAmountCents -
    input.processorFeeActualCents
  );
}

export function formatEur(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function formatBpsAsPercent(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}
