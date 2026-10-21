CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Commuter" (
    "id" TEXT NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "isInstitutional" BOOLEAN NOT NULL DEFAULT false,
    "ecoPointsBalance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commuter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobilityManager" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firebaseUid" TEXT,
    "name" TEXT,
    "department" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobilityManager_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampusZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "boundary" geometry(Polygon, 4326) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CampusZone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Commuter_firebaseUid_key" ON "Commuter"("firebaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "Commuter_email_key" ON "Commuter"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MobilityManager_email_key" ON "MobilityManager"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MobilityManager_firebaseUid_key" ON "MobilityManager"("firebaseUid");

-- CreateIndex
CREATE INDEX "CampusZone_boundary_idx" ON "CampusZone" USING GIST ("boundary");

