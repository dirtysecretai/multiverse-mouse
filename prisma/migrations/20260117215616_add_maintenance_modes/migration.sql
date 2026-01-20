-- AlterTable
ALTER TABLE "SystemState" ADD COLUMN     "echoChamberMaintenance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "galleriesMaintenance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "promptPacksMaintenance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "runesMaintenance" BOOLEAN NOT NULL DEFAULT false;
