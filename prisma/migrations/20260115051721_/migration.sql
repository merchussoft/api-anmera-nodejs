/*
  Warnings:

  - A unique constraint covering the columns `[invoiceNumber]` on the table `orders` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'STRIPE';

-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'STRIPE';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "invoiceNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_invoiceNumber_key" ON "orders"("invoiceNumber");

-- CreateIndex
CREATE INDEX "orders_invoiceNumber_idx" ON "orders"("invoiceNumber");
