import { describe, expect, it } from "vitest";
import {
  buildSettlementPreview,
  buyerTotalCents,
  commissionCents,
  estimateProcessorFeeCents,
  finalizeSellerPayout,
} from "./fees";

describe("commerce fees", () => {
  it("never adds seller fees to the buyer total", () => {
    expect(
      buyerTotalCents({
        productSubtotalCents: 10_000,
        shippingCents: 1_000,
        taxCents: 2_090,
      }),
    ).toBe(13_090);
  });

  it("calculates commission only on product subtotal", () => {
    expect(commissionCents(10_000, 700)).toBe(700);
    const preview = buildSettlementPreview({
      productSubtotalCents: 10_000,
      shippingCents: 5_000,
      taxCents: 2_000,
      commissionBps: 700,
    });
    expect(preview.commissionAmountCents).toBe(700);
  });

  it("uses the documented processor estimate", () => {
    expect(estimateProcessorFeeCents(10_000)).toBe(275);
  });

  it("reconciles seller payout using the actual processor fee", () => {
    expect(
      finalizeSellerPayout({
        buyerTotalCents: 13_090,
        commissionAmountCents: 700,
        processorFeeActualCents: 405,
      }),
    ).toBe(11_985);
  });
});
