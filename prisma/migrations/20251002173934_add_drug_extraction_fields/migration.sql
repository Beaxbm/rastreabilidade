/*
  Warnings:

  - You are about to drop the column `itemId` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `lotId` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `medicationId` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `newValues` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `oldValues` on the `audit_logs` table. All the data in the column will be lost.
  - Made the column `entityId` on table `audit_logs` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "MedicationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'RECALLED', 'EXPIRED');

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_itemId_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_lotId_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_medicationId_fkey";

-- AlterTable
ALTER TABLE "audit_logs" DROP COLUMN "itemId",
DROP COLUMN "lotId",
DROP COLUMN "medicationId",
DROP COLUMN "newValues",
DROP COLUMN "oldValues",
ADD COLUMN     "details" JSONB,
ALTER COLUMN "entityId" SET NOT NULL;

-- AlterTable
ALTER TABLE "medications" ADD COLUMN     "batchNumber" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "dosage" TEXT,
ADD COLUMN     "expirationDate" TIMESTAMP(3),
ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "manufacturingDate" TIMESTAMP(3),
ADD COLUMN     "qrCode" TEXT,
ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "status" "MedicationStatus" NOT NULL DEFAULT 'ACTIVE';
