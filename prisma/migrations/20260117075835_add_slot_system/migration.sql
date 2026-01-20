-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isSlotActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "productType" TEXT NOT NULL DEFAULT 'regular',
ADD COLUMN     "slotPosition" INTEGER;
