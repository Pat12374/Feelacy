import { createHash } from "node:crypto";
import { z } from "zod";
import { validateProduct } from "./product-ui";
export const nonAlcoholChecks = [
  "productSafety",
  "taxConfiguration",
  "shippingRules",
  "returnsRules",
  "prohibitedProducts",
  "contentClaims",
] as const;
export const alcoholChecks = [
  "verifiedSeller",
  "activeApplicableLicense",
  "licenseCategoryCoverage",
  "approvedFulfillmentOrigin",
  "approvedDestinationState",
  "requiredProductInformation",
  "permittedShippingLane",
  "approvedCarrier",
  "adultSignature",
  "stateVolumeAndShipmentLimits",
  "permittedClaims",
] as const;
export type PublicationInput = {
  title: string;
  description: string;
  categoryId?: string | null;
  containsAlcohol: boolean;
  catalogProductJson: string;
  weightGrams?: number | null;
  specialHandling?: string | null;
  fragile?: boolean;
  localDeliveryPermitted?: boolean;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
};
export function publicationDigest(listing: PublicationInput) {
  let product = {};
  try {
    const parsed = JSON.parse(listing.catalogProductJson);
    if (typeof parsed.currency === "string")
      parsed.currency = parsed.currency.toLowerCase();
    product = Object.fromEntries(
      Object.entries(parsed)
        .filter(([k, v]) => !["price", "quantity"].includes(k) && v !== "")
        .sort(([a], [b]) => a.localeCompare(b)),
    );
  } catch {
    /* Invalid product metadata cannot receive clearance. */
  }
  return createHash("sha256")
    .update(
      JSON.stringify([
        listing.title,
        listing.description,
        listing.categoryId,
        listing.containsAlcohol,
        product,
        listing.weightGrams ?? null,
        listing.specialHandling ?? null,
        listing.fragile ?? true,
        listing.localDeliveryPermitted ?? false,
        listing.lengthCm ?? null,
        listing.widthCm ?? null,
        listing.heightCm ?? null,
      ]),
    )
    .digest("hex");
}
export const reviewSchema = z.object({
  reviewerId: z.string().min(1),
  reviewedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  digest: z.string().length(64),
  evidenceReference: z.string().min(20).max(2000),
  checks: z.object({
    productSafety: z.literal(true),
    taxConfiguration: z.literal(true),
    shippingRules: z.literal(true),
    returnsRules: z.literal(true),
    prohibitedProducts: z.literal(true),
    contentClaims: z.literal(true),
  }),
});
export function publicationEligibility(
  listing: PublicationInput & {
    imported: boolean;
    importComplianceStatus?: string;
    importComplianceReviewJson?: string | null;
    syncStatus: string;
  },
  now = new Date(),
) {
  if (["UNCERTAIN", "FAILED", "CONFLICT"].includes(listing.syncStatus))
    return {
      allowed: false,
      reason: "Inventory synchronization requires review",
    };
  if (!listing.imported)
    return { allowed: true, reason: "Established publication workflow" };
  let product: Record<string, string> = {};
  try {
    product = JSON.parse(listing.catalogProductJson);
  } catch {
    return { allowed: false, reason: "Invalid product metadata" };
  }
  const validation = validateProduct({
    ...product,
    title: listing.title,
    description: listing.description,
  });
  if (!validation.ready)
    return {
      allowed: false,
      reason: "Required product information or claims need review",
    };
  // No state/destination/volume enforcement adapter exists in the current checkout.
  // Even an administrator cannot mark alcohol eligible before those controls exist.
  if (listing.containsAlcohol || ["wine", "spirits"].includes(product.category))
    return {
      allowed: false,
      reason: `Alcohol eligibility integration required: ${alcoholChecks.join(", ")}`,
    };
  if (listing.importComplianceStatus !== "APPROVED_NON_ALCOHOL")
    return {
      allowed: false,
      reason: "Recorded non-alcohol compliance review required",
    };
  let raw: unknown;
  try {
    raw = JSON.parse(listing.importComplianceReviewJson || "null");
  } catch {
    raw = null;
  }
  const review = reviewSchema.safeParse(raw);
  if (
    !review.success ||
    review.data.digest !== publicationDigest(listing) ||
    Date.parse(review.data.expiresAt) <= now.getTime()
  )
    return {
      allowed: false,
      reason:
        "Current product safety, tax, shipping, returns and claims review required",
    };
  return {
    allowed: true,
    reason: "Recorded non-alcohol compliance review is current",
  };
}
