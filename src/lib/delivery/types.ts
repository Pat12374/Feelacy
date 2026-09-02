export const DELIVERY_STATUSES = [
  "quote_requested", "quoted", "quote_expired", "awaiting_payment",
  "awaiting_seller_acceptance", "seller_accepted", "seller_rejected",
  "preparing", "ready_for_pickup", "courier_requested", "courier_assigned",
  "courier_arriving", "picked_up", "in_transit", "delivered",
  "delivery_failed", "return_requested", "return_in_transit",
  "returned_to_seller", "cancelled",
] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
export type FulfillmentType = "EXPRESS" | "SCHEDULED" | "STANDARD_SHIPPING" | "SELLER_PICKUP";

export type DeliveryAddress = {
  name: string; address1: string; address2?: string; city: string;
  region?: string; postalCode: string; country: string; phone?: string;
  latitude?: number; longitude?: number;
};

export type DeliveryEligibilityInput = {
  sellerId: string; pickupLocationId: string; address: DeliveryAddress;
  subtotalCents: number; containsAlcohol: boolean; localDeliveryPermitted: boolean;
  categoryIds: string[]; scheduledFor?: Date;
};

export type DeliveryAvailability = { eligible: boolean; reason?: string };
export type DeliveryQuoteInput = DeliveryEligibilityInput & {
  currency: string; signatureRequired: boolean;
};
export type NormalizedDeliveryQuote = {
  provider: string; providerQuoteId: string; feeCents: number; currency: string;
  pickupEta: Date; deliveryEta: Date; expiresAt: Date; ageVerification: boolean;
  signatureRequired: boolean; contactlessAllowed: boolean; returnSupported: boolean;
};
export type CreateDeliveryInput = DeliveryQuoteInput & {
  quoteId: string; internalDeliveryId: string; deliveryInstructions?: string;
};
export type NormalizedDelivery = {
  provider: string; providerDeliveryId: string; status: DeliveryStatus;
  pickupEta?: Date; deliveryEta?: Date; trackingUrl?: string;
};
export type NormalizedDeliveryEvent = {
  eventId: string; providerDeliveryId: string; status: DeliveryStatus;
  occurredAt: Date; failureCategory?: string; providerReason?: string;
  verificationResult?: "verified" | "failed";
};

export interface DeliveryProvider {
  readonly code: string;
  checkAvailability(input: DeliveryEligibilityInput): Promise<DeliveryAvailability>;
  createQuote(input: DeliveryQuoteInput): Promise<NormalizedDeliveryQuote>;
  createDelivery(input: CreateDeliveryInput): Promise<NormalizedDelivery>;
  getDelivery(deliveryId: string): Promise<NormalizedDelivery>;
  cancelDelivery(deliveryId: string, reason?: string): Promise<void>;
  createReturn?(deliveryId: string, reason: string): Promise<NormalizedDelivery>;
  verifyWebhook(headers: Headers, rawBody: string): boolean;
  normalizeWebhook(payload: unknown): NormalizedDeliveryEvent;
}
