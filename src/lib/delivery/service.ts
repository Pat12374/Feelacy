import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertTransition, canTransition, statusRank } from "./state-machine";
import { getDeliveryProvider } from "./providers";
import type { DeliveryAddress, DeliveryQuoteInput, DeliveryStatus, FulfillmentType, NormalizedDeliveryEvent } from "./types";

const localTypes = new Set<FulfillmentType>(["EXPRESS", "SCHEDULED"]);
export async function checkDeliveryEligibility(input: DeliveryQuoteInput) {
  const [global, seller, pickup] = await Promise.all([
    prisma.expressConfiguration.findUnique({ where: { id: "global" } }),
    prisma.sellerDeliverySettings.findUnique({ where: { sellerId: input.sellerId } }),
    prisma.pickupLocation.findFirst({ where: { id: input.pickupLocationId, sellerId: input.sellerId, approved: true, active: true } }),
  ]);
  if (!global?.enabled) return { eligible: false, reason: "WineTreff Express is not available in this area yet." };
  if (!seller || seller.adminApprovalStatus !== "APPROVED" || !seller.expressEnabled || !seller.acceptingLocalOrders) return { eligible: false, reason: "This seller is not currently accepting Express requests." };
  if (!pickup) return { eligible: false, reason: "The seller does not have an approved pickup location." };
  if (seller.closedUntil && seller.closedUntil > new Date()) return { eligible: false, reason: "The seller is temporarily closed." };
  if (!input.localDeliveryPermitted) return { eligible: false, reason: "One or more items are not eligible for local delivery." };
  if (input.containsAlcohol && (!global.alcoholEnabled || seller.alcoholApprovalStatus !== "APPROVED")) return { eligible: false, reason: "Age-restricted Express delivery is not enabled for this seller and jurisdiction." };
  if (input.subtotalCents < seller.minOrderCents || (seller.maxOrderCents && input.subtotalCents > seller.maxOrderCents)) return { eligible: false, reason: "The order value is outside this seller’s Express limits." };
  const countries = global.allowedCountriesCsv.split(",").map(x => x.trim().toUpperCase()).filter(Boolean);
  if (!countries.includes(input.address.country.toUpperCase())) return { eligible: false, reason: "The address is outside the configured service area." };
  return getDeliveryProvider("mock").checkAvailability(input);
}

export async function createAndStoreQuote(input: DeliveryQuoteInput, fulfillmentType: FulfillmentType) {
  if (!localTypes.has(fulfillmentType)) throw new Error("A courier quote is only used for local delivery.");
  const eligibility = await checkDeliveryEligibility(input); if (!eligibility.eligible) throw new Error(eligibility.reason);
  const config = await prisma.deliveryProviderConfig.findFirst({ where: { code: "mock", enabled: true } });
  if (!config) throw new Error("No delivery provider is enabled.");
  const quote = await getDeliveryProvider(config.code).createQuote(input);
  const requestHash = createHash("sha256").update(JSON.stringify({ ...input, scheduledFor: input.scheduledFor?.toISOString() })).digest("hex");
  return prisma.deliveryQuote.create({ data: { sellerId: input.sellerId, pickupLocationId: input.pickupLocationId, providerConfigId: config.id, providerQuoteId: quote.providerQuoteId, fulfillmentType, feeCents: quote.feeCents, currency: quote.currency, pickupEta: quote.pickupEta, deliveryEta: quote.deliveryEta, expiresAt: quote.expiresAt, ageVerification: quote.ageVerification, signatureRequired: quote.signatureRequired, contactlessAllowed: quote.contactlessAllowed, returnSupported: quote.returnSupported, requestHash, deliveryAddressJson: JSON.stringify(input.address) } });
}

export async function transitionDelivery(id: string, to: DeliveryStatus, source: string, detail?: string) {
  return prisma.$transaction(async tx => {
    const current = await tx.delivery.findUniqueOrThrow({ where: { id } });
    assertTransition(current.status as DeliveryStatus, to);
    const updated = await tx.delivery.update({ where: { id }, data: { status: to, sellerAcceptedAt: to === "seller_accepted" ? new Date() : undefined, readyAt: to === "ready_for_pickup" ? new Date() : undefined } });
    await tx.deliveryStatusHistory.create({ data: { deliveryId: id, fromStatus: current.status, toStatus: to, source, detail } });
    return updated;
  });
}

export async function dispatchDelivery(id: string) {
  const delivery = await prisma.delivery.findUnique({ where: { id }, include: { order: { include: { items: { include: { listing: true } } } }, quote: true, pickupLocation: true, providerConfig: true } });
  if (!delivery) throw new Error("Delivery not found.");
  if (delivery.providerDeliveryId) return delivery;
  if (delivery.order.status !== "PAID" || delivery.status !== "ready_for_pickup" || !delivery.quote || delivery.quote.expiresAt <= new Date()) throw new Error("The paid order must be accepted and ready, with a valid quote, before dispatch.");
  const address = JSON.parse(delivery.deliveryAddressJson) as DeliveryAddress;
  const provider = getDeliveryProvider(delivery.providerConfig.code);
  const created = await provider.createDelivery({ sellerId: delivery.sellerId, pickupLocationId: delivery.pickupLocationId, address, subtotalCents: delivery.order.productSubtotalCents, containsAlcohol: delivery.ageRestricted, localDeliveryPermitted: true, categoryIds: delivery.order.items.map(x => x.listing.categoryId).filter((x): x is string => Boolean(x)), currency: delivery.order.currency, signatureRequired: delivery.signatureRequired, quoteId: delivery.quote.providerQuoteId, internalDeliveryId: delivery.orderId });
  return prisma.$transaction(async tx => {
    const claimed = await tx.delivery.updateMany({ where: { id, providerDeliveryId: null, status: "ready_for_pickup" }, data: { providerDeliveryId: created.providerDeliveryId, status: "courier_assigned", pickupEta: created.pickupEta, deliveryEta: created.deliveryEta, trackingUrl: created.trackingUrl } });
    if (!claimed.count) return tx.delivery.findUniqueOrThrow({ where: { id } });
    await tx.deliveryStatusHistory.createMany({ data: [{ deliveryId: id, fromStatus: "ready_for_pickup", toStatus: "courier_requested", source: "system" }, { deliveryId: id, fromStatus: "courier_requested", toStatus: "courier_assigned", source: delivery.providerConfig.code }] });
    return tx.delivery.findUniqueOrThrow({ where: { id } });
  });
}

export async function applyProviderEvent(providerConfigId: string, event: NormalizedDeliveryEvent, payload: unknown) {
  try { await prisma.deliveryWebhookEvent.create({ data: { providerConfigId, providerEventId: event.eventId, eventType: event.status, payload: JSON.stringify(payload).slice(0, 100_000) } }); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { duplicate: true }; throw error; }
  const delivery = await prisma.delivery.findFirst({ where: { providerConfigId, providerDeliveryId: event.providerDeliveryId } });
  if (!delivery) { await prisma.deliveryWebhookEvent.update({ where: { providerConfigId_providerEventId: { providerConfigId, providerEventId: event.eventId } }, data: { processingError: "No matching internal delivery" } }); throw new Error("No matching delivery"); }
  const from = delivery.status as DeliveryStatus;
  if (from === event.status || !canTransition(from, event.status)) {
    const outOfOrder = statusRank(event.status) >= 0 && statusRank(event.status) < statusRank(from);
    await prisma.deliveryWebhookEvent.update({ where: { providerConfigId_providerEventId: { providerConfigId, providerEventId: event.eventId } }, data: { processedAt: new Date(), processingError: outOfOrder ? "Ignored out-of-order event" : "Ignored invalid transition" } });
    return { duplicate: false, ignored: true };
  }
  await prisma.$transaction(async tx => {
    await tx.delivery.update({ where: { id: delivery.id }, data: { status: event.status, failureCategory: event.failureCategory, providerReason: event.providerReason, customerExplanation: event.failureCategory ? safeFailureExplanation(event.failureCategory) : undefined, failedAt: event.failureCategory ? event.occurredAt : undefined, verificationResult: event.verificationResult, verificationProvider: event.verificationResult ? "provider" : undefined, verifiedAt: event.verificationResult ? event.occurredAt : undefined, returnStatus: event.status.startsWith("return") ? event.status : undefined } });
    await tx.deliveryStatusHistory.create({ data: { deliveryId: delivery.id, fromStatus: from, toStatus: event.status, source: "provider" } });
    await tx.deliveryWebhookEvent.update({ where: { providerConfigId_providerEventId: { providerConfigId, providerEventId: event.eventId } }, data: { processedAt: new Date() } });
  });
  return { duplicate: false, ignored: false };
}

export function safeFailureExplanation(category: string) {
  const known: Record<string, string> = { recipient_unavailable: "The recipient was unavailable. Age-restricted orders will be returned to the seller.", id_invalid: "The recipient’s identification could not be verified.", recipient_underage: "The recipient was not eligible to accept this age-restricted order.", restricted_address: "The courier could not complete delivery at this address.", seller_not_ready: "The seller was not ready when the courier arrived.", damaged_package: "The package was reported damaged.", courier_cancellation: "The courier cancelled the delivery.", provider_cancellation: "The provider cancelled the delivery.", delivery_timeout: "The delivery could not be completed in the available time." };
  return known[category] ?? "The delivery could not be completed. WineTreff support will review the outcome.";
}
