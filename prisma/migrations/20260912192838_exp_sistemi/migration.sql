-- CreateEnum
CREATE TYPE "ExpKaynagi" AS ENUM ('YILDIZ', 'ODEV_TAMAMLANDI');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "expTotal" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ExpEvent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "source" "ExpKaynagi" NOT NULL,
    "amount" INTEGER NOT NULL,
    "referenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpEvent_studentId_idx" ON "ExpEvent"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpEvent_source_referenceId_key" ON "ExpEvent"("source", "referenceId");

-- AddForeignKey
ALTER TABLE "ExpEvent" ADD CONSTRAINT "ExpEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EXP miktari negatif olamaz.
ALTER TABLE "ExpEvent" ADD CONSTRAINT "ExpEvent_amount_pozitif"
  CHECK ("amount" > 0);

-- Toplam EXP negatif olamaz (yalnizca artar).
ALTER TABLE "Student" ADD CONSTRAINT "Student_expTotal_pozitif"
  CHECK ("expTotal" >= 0);

ALTER TABLE "ExpEvent" ENABLE ROW LEVEL SECURITY;
