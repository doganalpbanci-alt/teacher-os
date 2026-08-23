-- CreateTable
CREATE TABLE "BreakPenalty" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreakPenalty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BreakPenalty_studentId_completedAt_idx" ON "BreakPenalty"("studentId", "completedAt");

-- AddForeignKey
ALTER TABLE "BreakPenalty" ADD CONSTRAINT "BreakPenalty_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ceza suresi negatif olamaz; erken bitirme completedAt ile yapilir,
-- sureyi eksiye dusurerek degil.
ALTER TABLE "BreakPenalty" ADD CONSTRAINT "BreakPenalty_seconds_pozitif"
  CHECK ("seconds" >= 0);

-- Supabase her public tabloyu anon anahtarla erisilebilen bir REST API'den
-- yayinlar. Politika tanimlanmadigi surece RLS tum erisimi reddeder;
-- Prisma'nin baglandigi rol tablo sahibi oldugu icin etkilenmez.
ALTER TABLE "BreakPenalty" ENABLE ROW LEVEL SECURITY;
