CREATE TABLE "DeliveryProviderConfig" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "environment" TEXT NOT NULL DEFAULT 'sandbox',
    "regionsCsv" TEXT NOT NULL DEFAULT '',
    "webhookSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpressConfiguration" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "alcoholEnabled" BOOLEAN NOT NULL DEFAULT false,
    "allowedCountriesCsv" TEXT NOT NULL DEFAULT '',
    "retentionDays" INTEGER NOT NULL DEFAULT 365,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpressConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerDeliverySettings" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "expressEnabled" BOOLEAN NOT NULL DEFAULT false,
    "scheduledEnabled" BOOLEAN NOT NULL DEFAULT false,
    "acceptingLocalOrders" BOOLEAN NOT NULL DEFAULT false,
    "adminApprovalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "alcoholApprovalStatus" TEXT NOT NULL DEFAULT 'NOT_APPROVED',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "storeHoursJson" TEXT,
    "preparationMinutes" INTEGER NOT NULL DEFAULT 60,
    "deliveryRadiusKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minOrderCents" INTEGER NOT NULL DEFAULT 0,
    "maxOrderCents" INTEGER,
    "eligibleCategoriesCsv" TEXT NOT NULL DEFAULT '',
    "automaticAcceptance" BOOLEAN NOT NULL DEFAULT false,
    "deliveryInstructions" TEXT,
    "closedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerDeliverySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupLocation" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "address1" TEXT NOT NULL,
    "address2" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickupLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryQuote" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "pickupLocationId" TEXT NOT NULL,
    "providerConfigId" TEXT NOT NULL,
    "providerQuoteId" TEXT NOT NULL,
    "fulfillmentType" TEXT NOT NULL,
    "feeCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "pickupEta" TIMESTAMP(3) NOT NULL,
    "deliveryEta" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ageVerification" BOOLEAN NOT NULL,
    "signatureRequired" BOOLEAN NOT NULL,
    "contactlessAllowed" BOOLEAN NOT NULL,
    "returnSupported" BOOLEAN NOT NULL,
    "requestHash" TEXT NOT NULL,
    "deliveryAddressJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "pickupLocationId" TEXT NOT NULL,
    "providerConfigId" TEXT NOT NULL,
    "quoteId" TEXT,
    "providerDeliveryId" TEXT,
    "fulfillmentType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'awaiting_payment',
    "deliveryAddressJson" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "ageRestricted" BOOLEAN NOT NULL DEFAULT false,
    "signatureRequired" BOOLEAN NOT NULL DEFAULT false,
    "contactlessAllowed" BOOLEAN NOT NULL DEFAULT false,
    "buyerAcknowledgedAt" TIMESTAMP(3),
    "sellerAcceptedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "pickupEta" TIMESTAMP(3),
    "deliveryEta" TIMESTAMP(3),
    "trackingUrl" TEXT,
    "failureCategory" TEXT,
    "providerReason" TEXT,
    "customerExplanation" TEXT,
    "failedAt" TIMESTAMP(3),
    "returnStatus" TEXT,
    "associatedFeesCents" INTEGER NOT NULL DEFAULT 0,
    "refundResolutionStatus" TEXT NOT NULL DEFAULT 'NOT_REVIEWED',
    "verificationResult" TEXT,
    "verificationProvider" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryStatusHistory" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryWebhookEvent" (
    "id" TEXT NOT NULL,
    "providerConfigId" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processingError" TEXT,

    CONSTRAINT "DeliveryWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAcknowledgment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryAcknowledgment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
ALTER TABLE "Listing" ADD COLUMN "containsAlcohol" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "ageVerificationRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "signatureRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "fragile" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "declaredValueCents" INTEGER,
ADD COLUMN "weightGrams" INTEGER,
ADD COLUMN "lengthCm" DOUBLE PRECISION,
ADD COLUMN "widthCm" DOUBLE PRECISION,
ADD COLUMN "heightCm" DOUBLE PRECISION,
ADD COLUMN "localDeliveryPermitted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "specialHandling" TEXT;
-- CreateIndex
CREATE UNIQUE INDEX "DeliveryProviderConfig_code_key" ON "DeliveryProviderConfig"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SellerDeliverySettings_sellerId_key" ON "SellerDeliverySettings"("sellerId");

-- CreateIndex
CREATE INDEX "PickupLocation_sellerId_approved_active_idx" ON "PickupLocation"("sellerId", "approved", "active");

-- CreateIndex
CREATE INDEX "DeliveryQuote_sellerId_expiresAt_idx" ON "DeliveryQuote"("sellerId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryQuote_providerConfigId_providerQuoteId_key" ON "DeliveryQuote"("providerConfigId", "providerQuoteId");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_orderId_key" ON "Delivery"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_quoteId_key" ON "Delivery"("quoteId");

-- CreateIndex
CREATE INDEX "Delivery_sellerId_status_idx" ON "Delivery"("sellerId", "status");

-- CreateIndex
CREATE INDEX "Delivery_buyerId_createdAt_idx" ON "Delivery"("buyerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_providerConfigId_providerDeliveryId_key" ON "Delivery"("providerConfigId", "providerDeliveryId");

-- CreateIndex
CREATE INDEX "DeliveryStatusHistory_deliveryId_createdAt_idx" ON "DeliveryStatusHistory"("deliveryId", "createdAt");

-- CreateIndex
CREATE INDEX "DeliveryWebhookEvent_processedAt_idx" ON "DeliveryWebhookEvent"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryWebhookEvent_providerConfigId_providerEventId_key" ON "DeliveryWebhookEvent"("providerConfigId", "providerEventId");

CREATE UNIQUE INDEX "DeliveryAcknowledgment_orderId_buyerId_kind_version_key" ON "DeliveryAcknowledgment"("orderId", "buyerId", "kind", "version");

-- CreateIndex
-- AddForeignKey
ALTER TABLE "SellerDeliverySettings" ADD CONSTRAINT "SellerDeliverySettings_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupLocation" ADD CONSTRAINT "PickupLocation_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryQuote" ADD CONSTRAINT "DeliveryQuote_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryQuote" ADD CONSTRAINT "DeliveryQuote_pickupLocationId_fkey" FOREIGN KEY ("pickupLocationId") REFERENCES "PickupLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryQuote" ADD CONSTRAINT "DeliveryQuote_providerConfigId_fkey" FOREIGN KEY ("providerConfigId") REFERENCES "DeliveryProviderConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_pickupLocationId_fkey" FOREIGN KEY ("pickupLocationId") REFERENCES "PickupLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_providerConfigId_fkey" FOREIGN KEY ("providerConfigId") REFERENCES "DeliveryProviderConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "DeliveryQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryStatusHistory" ADD CONSTRAINT "DeliveryStatusHistory_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryWebhookEvent" ADD CONSTRAINT "DeliveryWebhookEvent_providerConfigId_fkey" FOREIGN KEY ("providerConfigId") REFERENCES "DeliveryProviderConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAcknowledgment" ADD CONSTRAINT "DeliveryAcknowledgment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAcknowledgment" ADD CONSTRAINT "DeliveryAcknowledgment_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
