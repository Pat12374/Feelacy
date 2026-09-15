-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "catalogProductJson" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "externalProductId" TEXT,
ADD COLUMN     "externalVariantId" TEXT,
ADD COLUMN     "gtin" TEXT,
ADD COLUMN     "importComplianceStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "importFingerprint" TEXT,
ADD COLUMN     "imported" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastImportAt" TIMESTAMP(3),
ADD COLUMN     "lastSyncAt" TIMESTAMP(3),
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "sourceConnectionId" TEXT,
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "syncBaselineJson" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "syncStatus" TEXT NOT NULL DEFAULT 'DISCONNECTED';

-- AlterTable
ALTER TABLE "ListingDraft" ADD COLUMN     "approvedListingId" TEXT,
ADD COLUMN     "connectionId" TEXT,
ADD COLUMN     "duplicateDraftId" TEXT,
ADD COLUMN     "duplicateResolution" TEXT,
ADD COLUMN     "externalProductId" TEXT,
ADD COLUMN     "externalVariantId" TEXT,
ADD COLUMN     "fingerprint" TEXT,
ADD COLUMN     "gtin" TEXT,
ADD COLUMN     "importJobId" TEXT,
ADD COLUMN     "lastImportAt" TIMESTAMP(3),
ADD COLUMN     "productJson" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "rawJson" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "rowNumber" INTEGER,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "validationErrorsJson" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CatalogImportJob" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'MAPPING',
    "mode" TEXT NOT NULL DEFAULT 'ONE_TIME',
    "requestKey" TEXT NOT NULL,
    "mappingJson" TEXT NOT NULL DEFAULT '{}',
    "headersJson" TEXT NOT NULL DEFAULT '[]',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "authorizedById" TEXT NOT NULL,
    "authorizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorizationText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogMapping" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mappingJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogConnection" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "storeUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "mode" TEXT NOT NULL DEFAULT 'ONE_TIME',
    "encryptedCredentials" TEXT,
    "syncFieldsJson" TEXT NOT NULL DEFAULT '["price","quantity"]',
    "authorizedById" TEXT NOT NULL,
    "authorizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "nextSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogSyncEvent" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "productJson" TEXT NOT NULL DEFAULT '{}',
    "conflictsJson" TEXT NOT NULL DEFAULT '[]',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "CatalogSyncEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogRateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogRateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "CatalogImportJob_status_leaseUntil_idx" ON "CatalogImportJob"("status", "leaseUntil");

-- CreateIndex
CREATE INDEX "CatalogImportJob_sellerId_createdAt_idx" ON "CatalogImportJob"("sellerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogImportJob_sellerId_requestKey_key" ON "CatalogImportJob"("sellerId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogMapping_sellerId_name_key" ON "CatalogMapping"("sellerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogConnection_sellerId_provider_storeId_key" ON "CatalogConnection"("sellerId", "provider", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogSyncEvent_connectionId_eventKey_key" ON "CatalogSyncEvent"("connectionId", "eventKey");

-- CreateIndex
CREATE INDEX "ListingDraft_sellerId_sku_idx" ON "ListingDraft"("sellerId", "sku");

-- CreateIndex
CREATE INDEX "ListingDraft_sellerId_fingerprint_idx" ON "ListingDraft"("sellerId", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "ListingDraft_importJobId_rowNumber_key" ON "ListingDraft"("importJobId", "rowNumber");

-- AddForeignKey
ALTER TABLE "ListingDraft" ADD CONSTRAINT "ListingDraft_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "CatalogImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogImportJob" ADD CONSTRAINT "CatalogImportJob_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogMapping" ADD CONSTRAINT "CatalogMapping_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogConnection" ADD CONSTRAINT "CatalogConnection_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogSyncEvent" ADD CONSTRAINT "CatalogSyncEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "CatalogConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

