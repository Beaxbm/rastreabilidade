-- CreateEnum
CREATE TYPE "AlertLevel" AS ENUM ('NORMAL', 'WARNING', 'CRITICAL', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('EXPIRATION_WARNING', 'EXPIRATION_CRITICAL', 'EXPIRED', 'TEMPERATURE_HIGH', 'TEMPERATURE_LOW', 'STORAGE_CONDITION', 'LOCATION_MOVED');

-- AlterTable
ALTER TABLE "medications" ADD COLUMN     "alertLevel" "AlertLevel" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "currentTemperature" DOUBLE PRECISION,
ADD COLUMN     "storageConditions" TEXT,
ADD COLUMN     "storageLocation" TEXT;

-- CreateTable
CREATE TABLE "medication_alerts" (
    "id" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medication_alerts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "medication_alerts" ADD CONSTRAINT "medication_alerts_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "medications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
