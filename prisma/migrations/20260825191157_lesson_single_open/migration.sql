-- Bir sinifin ayni anda tek acik dersi olur.
--
-- Bu kural bugune kadar yalnizca uygulama kodundaydi: dersBaslat once
-- "acik ders var mi" diye bakip sonra kayit aciyordu. Iki istek ayni anda
-- gelirse (ogretmen telefondan ve akilli tahtadan ayni anda baslatirsa)
-- ikisi de "yok" gorup iki ders acabiliyordu. Kontrol ile yazma arasinda
-- atomiklik yoktu.
--
-- Once birikmis fazla dersler kapatilir, sonra kural veritabanina tasinir.

-- 1) Her sinifta EN YENI acik ders acik kalir, digerleri kapatilir.
--    Uygulama zaten en yenisini aktif ders sayiyordu; ogretmenin ekranda
--    gordugu ders degismesin diye o korunur.
--    Bitis zamani: o derse yazilmis son davranis kaydi, yoksa dersin
--    kendi baslangici. Boylece ders gercekte surdugu araligi gosterir.
UPDATE "Lesson" l
SET "endedAt" = COALESCE(
      (SELECT max(b."createdAt") FROM "BehaviorLog" b WHERE b."lessonId" = l."id"),
      l."date")
WHERE l."endedAt" IS NULL
  AND l."id" <> (
    SELECT x."id" FROM "Lesson" x
    WHERE x."classroomId" = l."classroomId" AND x."endedAt" IS NULL
    ORDER BY x."date" DESC, x."createdAt" DESC
    LIMIT 1
  );

-- 2) Kural artik veritabaninin garantisi. Kismi unique index: yalnizca
--    bitmemis dersleri kapsar, bitmis dersler sinirsiz olabilir (ayni
--    sinifa ayni gun birden fazla ders islenebilmeli).
--    Prisma semasi kismi index ifade edemez; bu yuzden elle yazilir.
CREATE UNIQUE INDEX "Lesson_tek_acik_ders"
  ON "Lesson" ("classroomId")
  WHERE "endedAt" IS NULL;
