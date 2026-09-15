import { createHmac, timingSafeEqual } from "node:crypto";
import { nanoid } from "nanoid";
import type { DeliveryProvider, DeliveryQuoteInput, CreateDeliveryInput, NormalizedDelivery, NormalizedDeliveryEvent } from "./types";

const deliveries = new Map<string, NormalizedDelivery>();
export class MockDeliveryProvider implements DeliveryProvider {
  readonly code = "mock";
  async checkAvailability(input: DeliveryQuoteInput) {
    return input.address.postalCode ? { eligible: true } : { eligible: false, reason: "A valid postal code is required." };
  }
  async createQuote(input: DeliveryQuoteInput) {
    const now = Date.now();
    return { provider: this.code, providerQuoteId: `mock_q_${nanoid()}`, feeCents: 1850,
      currency: input.currency.toUpperCase(), pickupEta: new Date(now + 45 * 60_000),
      deliveryEta: input.scheduledFor ?? new Date(now + 90 * 60_000), expiresAt: new Date(now + 30 * 60_000),
      ageVerification: input.containsAlcohol, signatureRequired: input.signatureRequired || input.containsAlcohol,
      contactlessAllowed: !input.containsAlcohol, returnSupported: true };
  }
  async createDelivery(input: CreateDeliveryInput) {
    const value = { provider: this.code, providerDeliveryId: `mock_d_${nanoid()}`, status: "courier_assigned" as const,
      pickupEta: new Date(Date.now() + 30 * 60_000), deliveryEta: new Date(Date.now() + 75 * 60_000),
      trackingUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/orders/${input.internalDeliveryId}` };
    deliveries.set(value.providerDeliveryId, value); return value;
  }
  async getDelivery(id: string) { const value = deliveries.get(id); if (!value) throw new Error("Delivery not found"); return value; }
  async cancelDelivery(id: string) { const value = deliveries.get(id); if (value) deliveries.set(id, { ...value, status: "cancelled" }); }
  async createReturn(id: string) { const value = await this.getDelivery(id); const returned = { ...value, status: "return_in_transit" as const }; deliveries.set(id, returned); return returned; }
  verifyWebhook(headers: Headers, rawBody: string) {
    const secret = process.env.DELIVERY_MOCK_WEBHOOK_SECRET; const signature = headers.get("x-feelacy-signature");
    if (!secret || !signature) return process.env.NODE_ENV !== "production" && signature === "dev-mock";
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(signature); const b = Buffer.from(expected); return a.length === b.length && timingSafeEqual(a, b);
  }
  normalizeWebhook(payload: unknown): NormalizedDeliveryEvent {
    const p = payload as Record<string, unknown>;
    if (!p.eventId || !p.providerDeliveryId || !p.status) throw new Error("Invalid webhook payload");
    return { eventId: String(p.eventId), providerDeliveryId: String(p.providerDeliveryId), status: String(p.status) as NormalizedDeliveryEvent["status"], occurredAt: p.occurredAt ? new Date(String(p.occurredAt)) : new Date(), failureCategory: p.failureCategory ? String(p.failureCategory) : undefined, providerReason: p.providerReason ? String(p.providerReason) : undefined, verificationResult: p.verificationResult as NormalizedDeliveryEvent["verificationResult"] };
  }
}
