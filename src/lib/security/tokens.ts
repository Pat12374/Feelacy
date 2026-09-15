import { createHmac, timingSafeEqual } from "crypto";
import { authSecret } from "@/lib/security/env";

export function signOrderCancellation(orderId: string): string {
  const secret = authSecret();
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return createHmac("sha256", secret)
    .update(`cancel-order:${orderId}`)
    .digest("hex");
}

export function verifyOrderCancellation(
  orderId: string,
  token: string | null,
): boolean {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const expected = signOrderCancellation(orderId);
  return timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"));
}
