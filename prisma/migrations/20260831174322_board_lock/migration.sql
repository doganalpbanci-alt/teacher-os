-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "boardPin" TEXT,
ADD COLUMN     "boardUnlockMinutes" INTEGER NOT NULL DEFAULT 10;
