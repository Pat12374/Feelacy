-- Non-alcohol clearance is bound to reviewed product content; alcohol remains fail-closed.
ALTER TABLE "Listing" ADD COLUMN "importComplianceReviewJson" TEXT;
