-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "gamificationEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ClassGoal" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "reward" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "ClassGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassGoal_classroomId_closedAt_idx" ON "ClassGoal"("classroomId", "closedAt");

-- AddForeignKey
ALTER TABLE "ClassGoal" ADD CONSTRAINT "ClassGoal_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hedef sayisi pozitif olmali; sifir ya da negatif hedef anlamsizdir.
ALTER TABLE "ClassGoal" ADD CONSTRAINT "ClassGoal_target_pozitif"
  CHECK ("target" > 0);

-- Supabase her public tabloyu anon anahtarla erisilebilen bir REST API'den
-- yayinlar. Politika tanimlanmadigi surece RLS tum erisimi reddeder;
-- Prisma'nin baglandigi rol tablo sahibi oldugu icin etkilenmez.
ALTER TABLE "ClassGoal" ENABLE ROW LEVEL SECURITY;
