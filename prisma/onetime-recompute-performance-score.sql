-- Teacher OS - performans notu tabanini 90'dan 80'e degistirme
-- Yalnizca bu bir kerelik veri duzeltmesi icin. Sema degismez, bu yuzden
-- migration akisina girmez (bkz. prisma/backfill-migration-history.sql
-- ayni desen icin).
--
-- Kart sisteminde not kayitlardan turetilir: not = BASLANGIC_PUANI + o
-- ogrencinin tum BehaviorLog.points toplami (bkz. src/lib/behavior.ts).
-- BASLANGIC_PUANI 90'dan 80'e indirildi (src/lib/behavior-rules.ts); bu SQL
-- var olan CARD sablonundaki ogrencilerin notunu YENI tabana gore hemen
-- yeniden hesaplar -- aksi halde her ogrencinin notu yalnizca bir sonraki
-- kayit girildiginde (dagitik, farkli zamanlarda) 10 puan birden duserdi.
--
-- Basit sablondaki ogretmenlerin ogrencilerine DOKUNULMAZ: orada not elle
-- girilir, bu formulle hicbir ilgisi yoktur.

BEGIN;

UPDATE "Student" s
SET "performanceScore" = 80 + COALESCE((
  SELECT SUM(bl.points) FROM "BehaviorLog" bl WHERE bl."studentId" = s.id
), 0)
WHERE s."classroomId" IN (
  SELECT c.id FROM "Classroom" c
  JOIN "Teacher" t ON t.id = c."teacherId"
  WHERE t."behaviorTemplate" = 'CARD'
);

COMMIT;

-- Dogrulama: her CARD ogrencisi icin yeni notun formulle eslestigini gosterir.
-- Fark sutunu hep 0 olmali.
SELECT
  s."firstName", s."lastName", s."performanceScore",
  80 + COALESCE((SELECT SUM(bl.points) FROM "BehaviorLog" bl WHERE bl."studentId" = s.id), 0) AS beklenen,
  s."performanceScore" - (80 + COALESCE((SELECT SUM(bl.points) FROM "BehaviorLog" bl WHERE bl."studentId" = s.id), 0)) AS fark
FROM "Student" s
JOIN "Classroom" c ON c.id = s."classroomId"
JOIN "Teacher" t ON t.id = c."teacherId"
WHERE t."behaviorTemplate" = 'CARD'
ORDER BY s."firstName";
