-- CreateEnum
CREATE TYPE "CarpoolSessionStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HazardCategory" AS ENUM ('SIDEWALK_DAMAGE', 'BIKE_LANE_OBSTRUCTION', 'POOR_LIGHTING', 'BUS_STOP_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "HazardStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED');

-- CreateTable
CREATE TABLE "CarpoolSession" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "status" "CarpoolSessionStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarpoolSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarpoolParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "commuterId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarpoolParticipant_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN "carpoolSessionId" TEXT;

-- CreateTable
CREATE TABLE "HazardReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "category" "HazardCategory" NOT NULL,
    "status" "HazardStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "location" geometry(Point, 4326) NOT NULL,
    "endorsementCount" INTEGER NOT NULL DEFAULT 1,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HazardReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HazardEndorsement" (
    "id" TEXT NOT NULL,
    "hazardReportId" TEXT NOT NULL,
    "commuterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HazardEndorsement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "costEcoPoints" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Redemption" (
    "id" TEXT NOT NULL,
    "commuterId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "voucherCode" TEXT NOT NULL,
    "costEcoPoints" INTEGER NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Redemption_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "PointTransaction" ADD COLUMN "hazardReportId" TEXT,
ADD COLUMN "redemptionId" TEXT;

-- CreateTable
CREATE TABLE "MobilityInsight" (
    "id" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "commuterId" TEXT,
    "summary" TEXT NOT NULL,
    "priorityCorridors" JSONB,
    "recommendedActions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobilityInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CarpoolSession_joinCode_key" ON "CarpoolSession"("joinCode");

-- CreateIndex
CREATE UNIQUE INDEX "CarpoolParticipant_sessionId_commuterId_key" ON "CarpoolParticipant"("sessionId", "commuterId");

-- CreateIndex
CREATE INDEX "Trip_carpoolSessionId_idx" ON "Trip"("carpoolSessionId");

-- CreateIndex
CREATE INDEX "HazardReport_status_category_idx" ON "HazardReport"("status", "category");

-- CreateIndex
CREATE INDEX "HazardReport_location_idx" ON "HazardReport" USING GIST ("location");

-- CreateIndex
CREATE UNIQUE INDEX "HazardEndorsement_hazardReportId_commuterId_key" ON "HazardEndorsement"("hazardReportId", "commuterId");

-- CreateIndex
CREATE UNIQUE INDEX "Redemption_voucherCode_key" ON "Redemption"("voucherCode");

-- CreateIndex
CREATE INDEX "Redemption_commuterId_status_idx" ON "Redemption"("commuterId", "status");

-- CreateIndex
CREATE INDEX "Redemption_status_expiresAt_idx" ON "Redemption"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "CarpoolSession" ADD CONSTRAINT "CarpoolSession_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Commuter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarpoolParticipant" ADD CONSTRAINT "CarpoolParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CarpoolSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarpoolParticipant" ADD CONSTRAINT "CarpoolParticipant_commuterId_fkey" FOREIGN KEY ("commuterId") REFERENCES "Commuter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_carpoolSessionId_fkey" FOREIGN KEY ("carpoolSessionId") REFERENCES "CarpoolSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HazardReport" ADD CONSTRAINT "HazardReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "Commuter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HazardEndorsement" ADD CONSTRAINT "HazardEndorsement_hazardReportId_fkey" FOREIGN KEY ("hazardReportId") REFERENCES "HazardReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HazardEndorsement" ADD CONSTRAINT "HazardEndorsement_commuterId_fkey" FOREIGN KEY ("commuterId") REFERENCES "Commuter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_commuterId_fkey" FOREIGN KEY ("commuterId") REFERENCES "Commuter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_hazardReportId_fkey" FOREIGN KEY ("hazardReportId") REFERENCES "HazardReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "Redemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobilityInsight" ADD CONSTRAINT "MobilityInsight_commuterId_fkey" FOREIGN KEY ("commuterId") REFERENCES "Commuter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
