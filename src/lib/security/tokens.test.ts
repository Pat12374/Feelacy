import { describe, expect, it } from "vitest";
import { signOrderCancellation, verifyOrderCancellation } from "@/lib/security/tokens";

describe("order cancellation tokens", () => {
  it("accepts only the token bound to the exact order", () => {
    process.env.AUTH_SECRET = "test-secret-that-is-long-enough-for-hmac";
    const token = signOrderCancellation("order-a");
    expect(verifyOrderCancellation("order-a", token)).toBe(true);
    expect(verifyOrderCancellation("order-b", token)).toBe(false);
    expect(verifyOrderCancellation("order-a", "bad")).toBe(false);
  });
});
