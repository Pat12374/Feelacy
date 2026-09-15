-- CreateIndex
CREATE INDEX "Listing_sellerId_sku_idx" ON "Listing"("sellerId", "sku");

-- CreateIndex
CREATE INDEX "Listing_sellerId_gtin_idx" ON "Listing"("sellerId", "gtin");

-- CreateIndex
CREATE INDEX "Listing_sellerId_sourceUrl_idx" ON "Listing"("sellerId", "sourceUrl");

-- CreateIndex
CREATE INDEX "Listing_sellerId_importFingerprint_idx" ON "Listing"("sellerId", "importFingerprint");

-- CreateIndex
CREATE INDEX "Listing_sellerId_sourceConnectionId_externalProductId_exter_idx" ON "Listing"("sellerId", "sourceConnectionId", "externalProductId", "externalVariantId");

-- CreateIndex
CREATE INDEX "ListingDraft_sellerId_gtin_idx" ON "ListingDraft"("sellerId", "gtin");

-- CreateIndex
CREATE INDEX "ListingDraft_sellerId_sourceUrl_idx" ON "ListingDraft"("sellerId", "sourceUrl");

-- CreateIndex
CREATE INDEX "ListingDraft_sellerId_connectionId_externalProductId_extern_idx" ON "ListingDraft"("sellerId", "connectionId", "externalProductId", "externalVariantId");

