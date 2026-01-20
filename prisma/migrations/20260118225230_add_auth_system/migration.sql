/*
  Warnings:

  - You are about to drop the column `imageCount` on the `EchoMessage` table. All the data in the column will be lost.
  - You are about to drop the column `grantedAt` on the `GalleryAccess` table. All the data in the column will be lost.
  - You are about to drop the column `customerId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `hasAllAccess` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `isPatron` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `paypalEmail` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[paypalOrderId]` on the table `Purchase` will be added. If there are existing duplicate values, this will fail.
  - Made the column `paypalOrderId` on table `Purchase` required. This step will fail if there are existing NULL values in that column.
  - Made the column `paypalPayerId` on table `Purchase` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Purchase_paypalOrderId_idx";

-- AlterTable
ALTER TABLE "EchoMessage" DROP COLUMN "imageCount";

-- AlterTable
ALTER TABLE "Gallery" ALTER COLUMN "price" SET DEFAULT 0,
ALTER COLUMN "accessType" SET DEFAULT 'free';

-- AlterTable
ALTER TABLE "GalleryAccess" DROP COLUMN "grantedAt",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "productType" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Purchase" ALTER COLUMN "itemId" DROP NOT NULL,
ALTER COLUMN "paypalOrderId" SET NOT NULL,
ALTER COLUMN "paypalPayerId" SET NOT NULL,
ALTER COLUMN "paymentStatus" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SystemState" ADD COLUMN     "aiGenerationMaintenance" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "isShopOpen" SET DEFAULT true;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "customerId",
DROP COLUMN "hasAllAccess",
DROP COLUMN "isPatron",
DROP COLUMN "paypalEmail",
ADD COLUMN     "password" TEXT;

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "totalBought" INTEGER NOT NULL DEFAULT 0,
    "totalUsed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketPurchase" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "ticketsCount" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paypalOrderId" TEXT NOT NULL,
    "paypalPayerId" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedImage" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GeneratedImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_userId_key" ON "Ticket"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketPurchase_paypalOrderId_key" ON "TicketPurchase"("paypalOrderId");

-- CreateIndex
CREATE INDEX "TicketPurchase_userId_idx" ON "TicketPurchase"("userId");

-- CreateIndex
CREATE INDEX "GeneratedImage_userId_idx" ON "GeneratedImage"("userId");

-- CreateIndex
CREATE INDEX "GeneratedImage_expiresAt_idx" ON "GeneratedImage"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_paypalOrderId_key" ON "Purchase"("paypalOrderId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketPurchase" ADD CONSTRAINT "TicketPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedImage" ADD CONSTRAINT "GeneratedImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
