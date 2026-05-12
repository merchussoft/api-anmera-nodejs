/*
  Warnings:

  - A unique constraint covering the columns `[reference]` on the table `products` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `reference` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "products" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "reference" TEXT NOT NULL,
ALTER COLUMN "description" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "products_reference_key" ON "products"("reference");
