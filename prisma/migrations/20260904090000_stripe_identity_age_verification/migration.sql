ALTER TABLE "User"
ADD COLUMN "ageVerificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN "stripeIdentityVerificationId" TEXT,
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "User_stripeIdentityVerificationId_key"
ON "User"("stripeIdentityVerificationId");
