-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "paymentMethodType" TEXT;

-- CreateTable
CREATE TABLE "payment_logs" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "transactionId" TEXT,
    "status" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "amount" INTEGER NOT NULL,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_logs_orderId_idx" ON "payment_logs"("orderId");

-- CreateIndex
CREATE INDEX "payment_logs_invoiceNumber_idx" ON "payment_logs"("invoiceNumber");

-- AddForeignKey
ALTER TABLE "payment_logs" ADD CONSTRAINT "payment_logs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
