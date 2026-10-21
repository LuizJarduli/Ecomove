-- CreateEnum
CREATE TYPE "TransportMode" AS ENUM ('WALK', 'BICYCLE', 'PUBLIC_TRANSIT', 'CARPOOL');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('RECORDING', 'VALIDATED', 'PENDING_REVIEW', 'REJECTED');

-- CreateEnum
CREATE TYPE "PointTransactionReason" AS ENUM ('TRIP_VALIDATED', 'HAZARD_APPROVED', 'REWARD_REDEEMED', 'REDEMPTION_EXPIRED_REFUND');

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "commuterId" TEXT NOT NULL,
    "transportMode" "TransportMode" NOT NULL,
    "status" "TripStatus" NOT NULL,
    "route" geometry(LineString, 4326) NOT NULL,
    "distanceMeters" DOUBLE PRECISION NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "avgSpeedKmh" DOUBLE PRECISION NOT NULL,
    "peakSpeedKmh" DOUBLE PRECISION NOT NULL,
    "co2SavedGrams" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ecoPointsEarned" INTEGER NOT NULL DEFAULT 0,
    "rejectionReason" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointTransaction" (
    "id" TEXT NOT NULL,
    "commuterId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "PointTransactionReason" NOT NULL,
    "tripId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Trip_commuterId_createdAt_idx" ON "Trip"("commuterId", "createdAt");

-- CreateIndex
CREATE INDEX "Trip_route_idx" ON "Trip" USING GIST ("route");

-- CreateIndex
CREATE INDEX "PointTransaction_commuterId_createdAt_idx" ON "PointTransaction"("commuterId", "createdAt");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_commuterId_fkey" FOREIGN KEY ("commuterId") REFERENCES "Commuter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_commuterId_fkey" FOREIGN KEY ("commuterId") REFERENCES "Commuter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
