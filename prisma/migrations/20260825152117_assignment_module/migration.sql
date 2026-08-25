-- Odev artik bir sinifa degil ogretmene ait: ayni odev birden fazla sinifa
-- ve tek tek secilen ogrencilere verilebilmeli. Kime verildigi Submission
-- satirlarinda yazili; sinif uyeligi oradan turetilir.
--
-- Mevcut kayitlar korunur: teacherId once bos eklenir, her odevin kendi
-- sinifinin ogretmeninden doldurulur, sonra NOT NULL yapilir. Dogrudan
-- NOT NULL eklemek tabloda satir varsa islemi durdurur.

-- AlterTable: teacherId
ALTER TABLE "Assignment" ADD COLUMN "teacherId" TEXT;

UPDATE "Assignment" a
SET "teacherId" = c."teacherId"
FROM "Classroom" c
WHERE c."id" = a."classroomId";

ALTER TABLE "Assignment" ALTER COLUMN "teacherId" SET NOT NULL;

-- AlterTable: updatedAt. Mevcut satirlar olusturulma anindan baslar.
ALTER TABLE "Assignment" ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "Assignment" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

ALTER TABLE "Assignment" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable: arsiv ve baslangic tarihi
ALTER TABLE "Assignment" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "startDate" TIMESTAMP(3);

-- DropForeignKey
ALTER TABLE "Assignment" DROP CONSTRAINT "Assignment_classroomId_fkey";

-- DropIndex
DROP INDEX "Assignment_classroomId_idx";

-- AlterTable: sinif bagi kalkti
ALTER TABLE "Assignment" DROP COLUMN "classroomId";

-- CreateIndex
CREATE INDEX "Assignment_teacherId_createdAt_idx" ON "Assignment"("teacherId", "createdAt");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
