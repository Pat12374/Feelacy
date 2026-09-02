"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin, requireSeller } from "@/lib/session";
import { dispatchDelivery, transitionDelivery } from "@/lib/delivery/service";
import { createAndStoreQuote } from "@/lib/delivery/service";
import { requireAgeVerified } from "@/lib/session";

export async function requestDeliveryQuoteAction(formData: FormData) {
  await requireAgeVerified();
  const listingId = String(formData.get("listingId")); const fulfillmentType = String(formData.get("fulfillmentType")) as "EXPRESS" | "SCHEDULED";
  const listing = await prisma.listing.findFirst({ where: { id: listingId, status: "ACTIVE", quantity: { gt: 0 } }, include: { seller: { include: { pickupLocations: { where: { approved: true, active: true }, take: 1 } } }, category: true } });
  const pickup = listing?.seller.pickupLocations[0]; if (!listing || !pickup) redirect(`/checkout/${listingId}?error=unavailable`);
  const parsed = z.object({ name: z.string().min(2).max(120), address1: z.string().min(3).max(200), address2: z.string().max(200).optional(), city: z.string().min(2).max(100), region: z.string().max(100).optional(), postalCode: z.string().min(2).max(20), country: z.string().length(2), phone: z.string().max(40).optional(), scheduledFor: z.string().optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success || !["EXPRESS", "SCHEDULED"].includes(fulfillmentType)) redirect(`/checkout/${listingId}?error=address`);
  if (fulfillmentType === "SCHEDULED" && !parsed.data.scheduledFor) redirect(`/checkout/${listingId}?error=schedule`);
  try {
    const quote = await createAndStoreQuote({ sellerId: listing.sellerId, pickupLocationId: pickup.id, address: { name: parsed.data.name, address1: parsed.data.address1, address2: parsed.data.address2, city: parsed.data.city, region: parsed.data.region, postalCode: parsed.data.postalCode, country: parsed.data.country.toUpperCase(), phone: parsed.data.phone }, subtotalCents: listing.priceCents, containsAlcohol: listing.containsAlcohol, localDeliveryPermitted: listing.localDeliveryPermitted, categoryIds: listing.categoryId ? [listing.categoryId] : [], scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : undefined, currency: listing.currency, signatureRequired: listing.signatureRequired }, fulfillmentType);
    redirect(`/checkout/${listingId}?quote=${quote.id}`);
  } catch (e) { if ((e as {digest?:string}).digest?.startsWith("NEXT_REDIRECT")) throw e; redirect(`/checkout/${listingId}?error=ineligible`); }
}

export async function saveSellerDeliverySettingsAction(formData: FormData) {
  const { seller } = await requireSeller();
  const data = z.object({ timezone: z.string().min(1).max(80), preparationMinutes: z.coerce.number().int().min(5).max(1440), deliveryRadiusKm: z.coerce.number().min(0).max(500), minOrderEuros: z.coerce.number().min(0), maxOrderEuros: z.coerce.number().min(0).optional(), deliveryInstructions: z.string().max(1000).optional() }).parse({ timezone: formData.get("timezone"), preparationMinutes: formData.get("preparationMinutes"), deliveryRadiusKm: formData.get("deliveryRadiusKm"), minOrderEuros: formData.get("minOrderEuros") || 0, maxOrderEuros: formData.get("maxOrderEuros") || undefined, deliveryInstructions: formData.get("deliveryInstructions") || undefined });
  await prisma.sellerDeliverySettings.upsert({ where: { sellerId: seller.id }, create: { sellerId: seller.id, expressEnabled: formData.get("expressEnabled") === "on", scheduledEnabled: formData.get("scheduledEnabled") === "on", acceptingLocalOrders: formData.get("acceptingLocalOrders") === "on", ...data, minOrderCents: Math.round(data.minOrderEuros * 100), maxOrderCents: data.maxOrderEuros ? Math.round(data.maxOrderEuros * 100) : null, automaticAcceptance: false }, update: { expressEnabled: formData.get("expressEnabled") === "on", scheduledEnabled: formData.get("scheduledEnabled") === "on", acceptingLocalOrders: formData.get("acceptingLocalOrders") === "on", timezone: data.timezone, preparationMinutes: data.preparationMinutes, deliveryRadiusKm: data.deliveryRadiusKm, minOrderCents: Math.round(data.minOrderEuros * 100), maxOrderCents: data.maxOrderEuros ? Math.round(data.maxOrderEuros * 100) : null, deliveryInstructions: data.deliveryInstructions } });
  await prisma.auditLog.create({ data: { actorId: seller.userId, action: "EXPRESS_SETTINGS_UPDATED", meta: JSON.stringify({ sellerId: seller.id }) } });
  revalidatePath("/sell/express"); redirect("/sell/express?ok=settings");
}

export async function addPickupLocationAction(formData: FormData) {
  const { seller } = await requireSeller();
  const d = z.object({ label: z.string().min(1).max(80), address1: z.string().min(3).max(200), address2: z.string().max(200).optional(), city: z.string().min(2).max(100), region: z.string().max(100).optional(), postalCode: z.string().min(2).max(20), country: z.string().length(2) }).parse(Object.fromEntries(formData));
  await prisma.pickupLocation.create({ data: { sellerId: seller.id, ...d, country: d.country.toUpperCase(), approved: false } });
  revalidatePath("/sell/express"); redirect("/sell/express?ok=pickup");
}

export async function sellerDeliveryAction(formData: FormData) {
  const { seller } = await requireSeller(); const deliveryId = String(formData.get("deliveryId")); const action = String(formData.get("intent"));
  const delivery = await prisma.delivery.findFirst({ where: { id: deliveryId, sellerId: seller.id }, include: { order: true } }); if (!delivery) redirect("/sell/express?error=notfound");
  if (action === "accept") await transitionDelivery(delivery.id, "seller_accepted", "seller");
  else if (action === "reject") { await transitionDelivery(delivery.id, "seller_rejected", "seller"); await transitionDelivery(delivery.id, "cancelled", "system", "Seller could not fulfill; support review required."); }
  else if (action === "prepare") await transitionDelivery(delivery.id, "preparing", "seller");
  else if (action === "ready") await transitionDelivery(delivery.id, "ready_for_pickup", "seller");
  else if (action === "dispatch") await dispatchDelivery(delivery.id);
  await prisma.auditLog.create({ data: { actorId: seller.userId, action: `DELIVERY_${action.toUpperCase()}`, meta: JSON.stringify({ deliveryId }) } });
  revalidatePath("/sell/express"); revalidatePath(`/orders/${delivery.orderId}`); redirect("/sell/express?ok=delivery");
}

export async function adminExpressAction(formData: FormData) {
  const session = await requireAdmin(); const intent = String(formData.get("intent"));
  if (intent === "global") await prisma.expressConfiguration.upsert({ where: { id: "global" }, create: { enabled: formData.get("enabled") === "on", alcoholEnabled: formData.get("alcoholEnabled") === "on", allowedCountriesCsv: String(formData.get("allowedCountries") || "") }, update: { enabled: formData.get("enabled") === "on", alcoholEnabled: formData.get("alcoholEnabled") === "on", allowedCountriesCsv: String(formData.get("allowedCountries") || "") } });
  if (intent === "seller") await prisma.sellerDeliverySettings.update({ where: { sellerId: String(formData.get("sellerId")) }, data: { adminApprovalStatus: String(formData.get("approval")), alcoholApprovalStatus: String(formData.get("alcoholApproval")) } });
  if (intent === "pickup") await prisma.pickupLocation.update({ where: { id: String(formData.get("pickupId")) }, data: { approved: formData.get("approved") === "true" } });
  await prisma.auditLog.create({ data: { actorId: session.user.id, action: "EXPRESS_ADMIN_CONFIGURATION", meta: JSON.stringify({ intent }) } });
  revalidatePath("/admin/express"); redirect("/admin/express?ok=1");
}
