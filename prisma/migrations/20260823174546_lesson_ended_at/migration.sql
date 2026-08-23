-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "endedAt" TIMESTAMP(3);

-- Bu migration'dan onceki dersler gecmistedir; hepsi bitmis sayilir.
-- Aksi halde eski dersler "suruyor" gorunur ve aktif ders belirsiz kalir.
-- Ogretmen bir sonraki derste "Yeni ders baslat" der.
UPDATE "Lesson" SET "endedAt" = "date" WHERE "endedAt" IS NULL;
