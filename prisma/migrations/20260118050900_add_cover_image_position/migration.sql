/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `Purchase` table. All the data in the column will be lost.
  - Made the column `itemId` on table `Purchase` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_userId_fkey";

-- DropIndex
DROP INDEX "Purchase_paypalOrderId_key";

-- AlterTable
ALTER TABLE "EchoMessage" ADD COLUMN     "imageCount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "name" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Gallery" ADD COLUMN     "coverImagePosition" TEXT DEFAULT 'center';

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "category" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Purchase" DROP COLUMN "updatedAt",
ALTER COLUMN "itemId" SET NOT NULL,
ALTER COLUMN "paymentStatus" SET DEFAULT 'pending';

-- AlterTable
CREATE SEQUENCE systemstate_id_seq;
ALTER TABLE "SystemState" ALTER COLUMN "id" SET DEFAULT nextval('systemstate_id_seq');
ALTER SEQUENCE systemstate_id_seq OWNED BY "SystemState"."id";

-- CreateIndex
CREATE INDEX "Purchase_paypalOrderId_idx" ON "Purchase"("paypalOrderId");

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
