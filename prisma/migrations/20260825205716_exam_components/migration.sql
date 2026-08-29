-- Sinav artik bilesenlerden olusuyor: MEB sinavi uc parcadir (Yazili %50,
-- Listening %25, Speaking %25), tek puanli bir sinav tek parcadir, tarama
-- sinavinda parca dogru/yanlis sayisindan hesaplanir. Tek mekanizma dort
-- sinav turunu birden karsilar ve "sinifin Listening ortalamasi" sorulabilir
-- hale gelir.
--
-- Mevcut kayitlar icin risk yok: eklenen iki sutunun da varsayilani var,
-- digerleri yeni tablo. Var olan Exam satirlari PRACTICE olarak isaretlenir;
-- resmi olanlar sinav duzenlenerek isaretlenir.

-- CreateEnum
CREATE TYPE "ExamScope" AS ENUM ('OFFICIAL', 'PRACTICE');

-- CreateEnum
CREATE TYPE "ComponentEntry" AS ENUM ('SCORE', 'NET');

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "scope" "ExamScope" NOT NULL DEFAULT 'PRACTICE';

-- AlterTable
ALTER TABLE "ExamResult" ADD COLUMN     "isAbsent" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ExamComponent" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "entry" "ComponentEntry" NOT NULL DEFAULT 'SCORE',
    "questionCount" INTEGER,
    "wrongDivisor" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExamComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamResultComponent" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "correct" INTEGER,
    "wrong" INTEGER,
    "blank" INTEGER,

    CONSTRAINT "ExamResultComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamComponent_examId_order_idx" ON "ExamComponent"("examId", "order");

-- CreateIndex
CREATE INDEX "ExamResultComponent_componentId_idx" ON "ExamResultComponent"("componentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamResultComponent_resultId_componentId_key" ON "ExamResultComponent"("resultId", "componentId");

-- AddForeignKey
ALTER TABLE "ExamComponent" ADD CONSTRAINT "ExamComponent_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResultComponent" ADD CONSTRAINT "ExamResultComponent_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "ExamResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResultComponent" ADD CONSTRAINT "ExamResultComponent_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "ExamComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- Row Level Security ----------
-- Migration 2'deki kuralin devami: Supabase her tabloyu anon/authenticated
-- anahtarlarla disariya acar, RLS bu erisimi tamamen kapatir. Yeni tablolar
-- bunsuz birakilirsa butun sema kapaliyken bu ikisi acik kalirdi.
ALTER TABLE "ExamComponent"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExamResultComponent" ENABLE ROW LEVEL SECURITY;
