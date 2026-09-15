import { describe, expect, it } from "vitest";
import { publicationDigest, publicationEligibility } from "./compliance";
import { accessory } from "./fixtures";
const listing = {
  title: "Cork display",
  description: "Wood display box for used corks",
  categoryId: "accessories",
  containsAlcohol: false,
  imported: true,
  catalogProductJson: JSON.stringify(accessory),
  syncStatus: "DISCONNECTED",
  importComplianceStatus: "APPROVED_NON_ALCOHOL",
};
function approved() {
  return {
    ...listing,
    importComplianceReviewJson: JSON.stringify({
      reviewerId: "admin",
      reviewedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2027-01-01T00:00:00.000Z",
      digest: publicationDigest(listing),
      evidenceReference: "Verified product documentation case 123",
      checks: {
        productSafety: true,
        taxConfiguration: true,
        shippingRules: true,
        returnsRules: true,
        prohibitedProducts: true,
        contentClaims: true,
      },
    }),
  };
}
const now = new Date("2026-09-07T00:00:00.000Z");
describe("import publication eligibility", () => {
  it("requires actual recorded non-alcohol clearance", () =>
    expect(publicationEligibility(listing, now).allowed).toBe(false));
  it("allows a current complete non-alcohol review", () =>
    expect(publicationEligibility(approved(), now).allowed).toBe(true));
  it("rejects altered product content and expired clearance", () => {
    expect(
      publicationEligibility(
        { ...approved(), description: "Different claims" },
        now,
      ).allowed,
    ).toBe(false);
    expect(
      publicationEligibility(approved(), new Date("2028-01-01")).allowed,
    ).toBe(false);
  });
  it("never treats alcohol as legally eligible automatically or from non-alcohol clearance", () =>
    expect(
      publicationEligibility({ ...approved(), containsAlcohol: true }, now)
        .allowed,
    ).toBe(false));
  it("blocks uncertain inventory even after review", () =>
    expect(
      publicationEligibility({ ...approved(), syncStatus: "UNCERTAIN" }, now)
        .allowed,
    ).toBe(false));
  it("honors invalidation after a content/image edit", () =>
    expect(
      publicationEligibility(
        { ...approved(), importComplianceStatus: "PENDING" },
        now,
      ).allowed,
    ).toBe(false));
});
