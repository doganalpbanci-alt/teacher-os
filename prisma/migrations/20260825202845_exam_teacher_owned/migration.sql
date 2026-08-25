-- Sinav artik bir sinifa degil ogretmene ait: ayni sinav birden fazla sinifa
-- ve tek tek secilen ogrencilere verilebilmeli. Kime verildigi ExamResult
-- satirlarinda yazili; sinif uyeligi oradan turetilir. Odevde (Assignment)
-- verilen kararin aynisi, ayni gerekcelerle.
--
-- Mevcut kayitlar korunur: teacherId once bos eklenir, her sinavin kendi
-- sinifinin ogretmeninden doldurulur, sonra NOT NULL yapilir ve classroomId
-- ancak tasidigi deger kopyalandiktan sonra dusurulur. Dogrudan NOT NULL
-- eklemek tabloda satir varsa islemi durdurur -- odevde tam olarak bu yasandi.

-- AlterTable: teacherId
ALTER TABLE "Exam" ADD COLUMN "teacherId" TEXT;

UPDATE "Exam" e
SET "teacherId" = c."teacherId"
FROM "Classroom" c
WHERE c."id" = e."classroomId";

-- Sahipsiz kalan sinav olmamali. Sinifi silinmis bir sinav varsa migration
-- burada durur; sessizce veri kaybetmektense elle karar verilmesi iyidir.
ALTER TABLE "Exam" ALTER COLUMN "teacherId" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "Exam" DROP CONSTRAINT "Exam_classroomId_fkey";

-- DropIndex
DROP INDEX "Exam_classroomId_idx";

-- AlterTable: sinif bagi kalkti
ALTER TABLE "Exam" DROP COLUMN "classroomId";

-- AlterTable: puan artik bos birakilabilir. Null = sinav bu ogrenciye
-- verilmis ama notu HENUZ GIRILMEMIS. Odevdeki PENDING satirinin karsiligi:
-- sinavin kime verildigi bu satirlarda yazili oldugu icin puan girilmeden
-- once de satir durabilmeli. Girilmis puanlar etkilenmez.
ALTER TABLE "ExamResult" ALTER COLUMN "score" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Exam_teacherId_examDate_idx" ON "Exam"("teacherId", "examDate");

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
