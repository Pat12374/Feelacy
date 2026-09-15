"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import {
  nonAlcoholChecks,
  publicationDigest,
  reviewSchema,
} from "@/lib/catalog-import/compliance";
export async function reviewCatalogComplianceAction(form: FormData) {
  const session = await requireAdmin();
  const id = String(form.get("listingId") || "");
  await prisma.$transaction(async (tx) => {
    const listing = await tx.listing.findUnique({ where: { id } });
    if (
      !listing?.imported ||
      listing.containsAlcohol ||
      listing.status === "RESERVED"
    )
      throw new Error("Product cannot receive non-alcohol clearance");
    if (listing.updatedAt.toISOString() !== form.get("listingUpdatedAt"))
      throw new Error("Product changed; reload before reviewing");
    const expiry = new Date(String(form.get("expiresAt")));
    if (
      !Number.isFinite(expiry.getTime()) ||
      expiry <= new Date() ||
      expiry.getTime() > Date.now() + 366 * 86400000
    )
      throw new Error("Review expiry must be within the next year");
    const review = reviewSchema.parse({
      reviewerId: session.user.id,
      reviewedAt: new Date().toISOString(),
      expiresAt: expiry.toISOString(),
      digest: publicationDigest(listing),
      evidenceReference: String(form.get("evidenceReference") || ""),
      checks: Object.fromEntries(
        nonAlcoholChecks.map((k) => [k, form.get(k) === "on"]),
      ),
    });
    const updated = await tx.listing.updateMany({
      where: { id, updatedAt: listing.updatedAt, status: { not: "RESERVED" } },
      data: {
        importComplianceStatus: "APPROVED_NON_ALCOHOL",
        importComplianceReviewJson: JSON.stringify(review),
      },
    });
    if (!updated.count) throw new Error("Concurrent product change");
    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "CATALOG_COMPLIANCE_REVIEWED",
        meta: JSON.stringify({
          listingId: id,
          sellerId: listing.sellerId,
          review,
        }),
      },
    });
  });
  revalidatePath("/admin/catalog-imports");
  revalidatePath(`/sell/listings/${id}`);
  redirect("/admin/catalog-imports?reviewed=1");
}
