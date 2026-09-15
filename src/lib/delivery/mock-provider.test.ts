import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { MockDeliveryProvider } from "./mock-provider";

const input = { sellerId: "seller", pickupLocationId: "pickup", address: { name: "Buyer", address1: "1 Main", city: "Berlin", postalCode: "10115", country: "DE" }, subtotalCents: 5000, containsAlcohol: true, localDeliveryPermitted: true, categoryIds: ["wine"], currency: "eur", signatureRequired: true };
describe("mock delivery provider", () => {
  it("quotes alcohol orders with no unattended delivery", async () => {
    const quote = await new MockDeliveryProvider().createQuote(input);
    expect(quote.ageVerification).toBe(true); expect(quote.signatureRequired).toBe(true); expect(quote.contactlessAllowed).toBe(false); expect(quote.returnSupported).toBe(true);
  });
  it("creates one normalized sandbox delivery", async () => {
    const provider = new MockDeliveryProvider(); const delivery = await provider.createDelivery({ ...input, quoteId: "q", internalDeliveryId: "order" });
    expect(delivery.providerDeliveryId).toMatch(/^mock_d_/); expect(delivery.status).toBe("courier_assigned"); expect((await provider.getDelivery(delivery.providerDeliveryId)).providerDeliveryId).toBe(delivery.providerDeliveryId);
  });
  it("verifies signed webhooks", () => {
    vi.stubEnv("DELIVERY_MOCK_WEBHOOK_SECRET", "secret"); const body = "{}"; const h = new Headers({ "x-feelacy-signature": createHmac("sha256", "secret").update(body).digest("hex") });
    expect(new MockDeliveryProvider().verifyWebhook(h, body)).toBe(true); vi.unstubAllEnvs();
  });
});
