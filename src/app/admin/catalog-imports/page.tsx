import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import {
  nonAlcoholChecks,
  publicationEligibility,
} from "@/lib/catalog-import/compliance";
import { reviewCatalogComplianceAction } from "@/lib/actions/catalog-compliance";
export default async function CatalogCompliancePage() {
  await requireAdmin();
  const listings = await prisma.listing.findMany({
    where: { imported: true },
    include: { seller: { select: { displayName: true } } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return (
    <div className="wt-container py-10">
      <Link className="underline" href="/admin">
        Admin dashboard
      </Link>
      <h1 className="my-4 text-3xl font-semibold">
        Imported product compliance review
      </h1>
      <p>
        Record actual review evidence. Clearance never publishes a product.
        Sellers retain final publication control. Alcohol remains blocked until
        destination, licensing, carrier and shipment-volume enforcement is
        integrated.
      </p>
      {listings.map((l) => {
        const eligibility = publicationEligibility(l);
        return (
          <section
            key={l.id}
            className="my-6 rounded-xl border border-[var(--line)] p-5"
          >
            <h2 className="text-xl font-semibold">
              {l.title} · {l.seller.displayName}
            </h2>
            <p className="my-3 whitespace-pre-wrap">{l.description}</p>
            <details>
              <summary>Seller-supplied product information</summary>
              <pre className="whitespace-pre-wrap text-sm">
                {JSON.stringify(JSON.parse(l.catalogProductJson), null, 2)}
              </pre>
            </details>
            <p className="my-3">{eligibility.reason}</p>
            {!l.containsAlcohol && (
              <form
                action={reviewCatalogComplianceAction}
                className="grid gap-3"
              >
                <input type="hidden" name="listingId" value={l.id} />
                <input
                  type="hidden"
                  name="listingUpdatedAt"
                  value={l.updatedAt.toISOString()}
                />
                {nonAlcoholChecks.map((k) => (
                  <label key={k} className="flex gap-2">
                    <input type="checkbox" required name={k} />I verified {k}
                  </label>
                ))}
                <label className="wt-label">
                  Review evidence / case reference
                  <textarea
                    className="wt-input"
                    name="evidenceReference"
                    required
                    minLength={20}
                    maxLength={2000}
                  />
                </label>
                <label className="wt-label">
                  Review expiry
                  <input
                    className="wt-input"
                    name="expiresAt"
                    type="date"
                    required
                  />
                </label>
                <button className="wt-btn wt-btn-primary justify-self-start">
                  Record non-alcohol clearance
                </button>
              </form>
            )}
          </section>
        );
      })}
      {!listings.length && (
        <p className="mt-6">No imported products awaiting review.</p>
      )}
    </div>
  );
}
