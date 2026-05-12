-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'READY_FOR_DELIVERY';
ALTER TYPE "OrderStatus" ADD VALUE 'FAILED_DELIVERY';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'DELIVERY';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "deliveryPersonId" TEXT,
ADD COLUMN     "failureNotes" TEXT,
ADD COLUMN     "failureReason" TEXT;

-- CreateTable
CREATE TABLE "delivery_evidences" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_evidences_orderId_idx" ON "delivery_evidences"("orderId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_deliveryPersonId_fkey" FOREIGN KEY ("deliveryPersonId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_evidences" ADD CONSTRAINT "delivery_evidences_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
