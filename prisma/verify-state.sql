-- Teacher OS - veritabani durum kontrolu
-- Supabase SQL Editor'a yapistirip calistirin. Her satirda "TAMAM" bekleniyor.
WITH k AS (
  SELECT 1 s, 'Migration 1/9 · init' kontrol,
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260821214524_init'
       AND checksum='a47f4ba3092679ef4c671f9542a8dd076ee7f407cde95e65ace9b2bb91cafdc1') bulunan, '1' beklenen
  UNION ALL SELECT 2, 'Migration 2/9 · koruma kurallari + RLS',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260822105533_harden_history_and_rls'
       AND checksum='afcb1876314d16c32ff82d26aa7af9a82e3a8f0fa71bdc50da01790069cccff5'), '1'
  UNION ALL SELECT 3, 'Migration 3/9 · davranis sablonu',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260822235800_behavior_template'
       AND checksum='94375e958bda926bddd3ea6bb05d597ac74693c1ed9276c1187560ab021f56f7'), '1'
  UNION ALL SELECT 3.5, 'Migration 4/9 · teneffus cezasi',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260823144543_break_penalty'
       AND checksum='ffa1b73b6d26d509c6e5e3ffb88b9a292630e24958019221a1ca8c6404a12199'), '1'
  UNION ALL SELECT 3.6, 'Migration 5/9 · ders bitisi',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260823174546_lesson_ended_at'
       AND checksum='471a0d711809feadead51072c977097c2cfb9b1702cd0c572837d0295717f7ca'), '1'
  UNION ALL SELECT 3.7, 'Migration 6/9 · odev modulu',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260825152117_assignment_module'
       AND checksum='71bbf50cd7740dc8c769a9d227e7566eeb974c6968784b4ac2dbc5196f333289'), '1'
  UNION ALL SELECT 3.8, 'Migration 7/9 · tek acik ders kisiti',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260825191157_lesson_single_open'
       AND checksum='558337ff70a7f297c44533d391affac5bb9ecaf83ad9d56cf13209d132da3473'), '1'
  UNION ALL SELECT 3.9, 'Migration 8/9 · sinav ogretmene tasindi',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260825202845_exam_teacher_owned'
       AND checksum='b0254569fef57ef205180b83d3f628f495c6a8758778c1a58469d5390a428f0d'), '1'
  UNION ALL SELECT 3.95, 'Migration 9/9 · sinav bilesenleri',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260825205716_exam_components'
       AND checksum='17ac5ac0851464fddec16936a63907e224362acc9405da0b3dae52dcbc080f40'), '1'
  UNION ALL SELECT 4, 'Fazladan/taninmayan migration kaydi',
    (SELECT coalesce(string_agg(migration_name,', '),'yok') FROM "_prisma_migrations"
       WHERE migration_name NOT IN ('20260821214524_init','20260822105533_harden_history_and_rls',
                                    '20260822235800_behavior_template',
                                    '20260823144543_break_penalty',
                                    '20260823174546_lesson_ended_at',
                                    '20260825152117_assignment_module',
                                    '20260825191157_lesson_single_open',
                                    '20260825202845_exam_teacher_owned',
                                    '20260825205716_exam_components')), 'yok'
  UNION ALL SELECT 5, 'Geri alinmis migration',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE rolled_back_at IS NOT NULL OR finished_at IS NULL), '0'
  UNION ALL SELECT 6, 'Tablo sayisi',
    (SELECT count(*)::text FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations'), '13'
  -- Ayni sinifa ayni gun birden fazla ders islenebilmeli. Tek acik ders
  -- kisiti bunu engellemez (yalnizca bitmemis dersleri kapsar), o yuzden
  -- bu sayimdan haric tutulur.
  UNION ALL SELECT 7, 'Ayni gune ikinci ders (kisit kalkti mi)',
    (SELECT count(*)::text FROM pg_indexes WHERE tablename='Lesson' AND indexdef ILIKE '%UNIQUE%'
       AND indexname NOT IN ('Lesson_pkey','Lesson_tek_acik_ders')), '0'
  UNION ALL SELECT 8, 'Gecmis korumasi (RESTRICT baglanti)',
    (SELECT count(*)::text FROM pg_constraint WHERE contype='f' AND confdeltype='r'), '13'
  UNION ALL SELECT 9, 'Sinif arsivleme alani (isActive)',
    (SELECT count(*)::text FROM information_schema.columns WHERE table_name='Classroom' AND column_name='isActive'), '1'
  UNION ALL SELECT 10, 'Puan tutarlilik kisiti',
    (SELECT count(*)::text FROM pg_constraint WHERE conname='BehaviorLog_points_matches_type'), '1'
  UNION ALL SELECT 12, 'Davranis sablonu alani (Teacher)',
    (SELECT count(*)::text FROM information_schema.columns
       WHERE table_name='Teacher' AND column_name='behaviorTemplate'), '1'
  UNION ALL SELECT 13, 'Sablon varsayilani basit sistem',
    (SELECT count(*)::text FROM information_schema.columns
       WHERE table_name='Teacher' AND column_name='behaviorTemplate'
         AND column_default LIKE '%SIMPLE%'), '1'
  UNION ALL SELECT 14, 'Notr kayit yazilabilir (kisit gevsedi)',
    (SELECT CASE WHEN pg_get_constraintdef(oid) LIKE '%>= 0%' THEN 'gevsek' ELSE 'eski' END
       FROM pg_constraint WHERE conname='BehaviorLog_points_matches_type'), 'gevsek'
  UNION ALL SELECT 15, 'Ceza tablosu',
    (SELECT count(*)::text FROM pg_tables WHERE schemaname='public' AND tablename='BreakPenalty'), '1'
  UNION ALL SELECT 16, 'Ders bitis alani (Lesson.endedAt)',
    (SELECT count(*)::text FROM information_schema.columns
       WHERE table_name='Lesson' AND column_name='endedAt'), '1'
  UNION ALL SELECT 17, 'Gecmis dersler kapatildi (acik ders en fazla sinif basina 1)',
    (SELECT CASE WHEN count(*)=0 THEN 'tek' ELSE 'coklu' END FROM (
       SELECT "classroomId" FROM "Lesson" WHERE "endedAt" IS NULL
       GROUP BY "classroomId" HAVING count(*) > 1) x), 'tek'
  UNION ALL SELECT 17.5, 'Tek acik ders artik veritabani garantisi',
    (SELECT count(*)::text FROM pg_indexes
       WHERE tablename='Lesson' AND indexname='Lesson_tek_acik_ders'), '1'
  UNION ALL SELECT 18, 'Odev ogretmene bagli (Assignment.teacherId)',
    (SELECT count(*)::text FROM information_schema.columns
       WHERE table_name='Assignment' AND column_name='teacherId'), '1'
  UNION ALL SELECT 19, 'Odev artik tek sinifa bagli DEGIL (classroomId kalkti)',
    (SELECT count(*)::text FROM information_schema.columns
       WHERE table_name='Assignment' AND column_name='classroomId'), '0'
  UNION ALL SELECT 20, 'Odev tarih ve arsiv alanlari',
    (SELECT count(*)::text FROM information_schema.columns
       WHERE table_name='Assignment' AND column_name IN ('startDate','isActive','updatedAt')), '3'
  UNION ALL SELECT 21, 'Sinav ogretmene bagli (Exam.teacherId)',
    (SELECT count(*)::text FROM information_schema.columns
       WHERE table_name='Exam' AND column_name='teacherId'), '1'
  UNION ALL SELECT 22, 'Sinav artik tek sinifa bagli DEGIL (classroomId kalkti)',
    (SELECT count(*)::text FROM information_schema.columns
       WHERE table_name='Exam' AND column_name='classroomId'), '0'
  -- Null puan = sinav verilmis ama notu henuz girilmemis. Odevdeki PENDING
  -- satirinin karsiligi; sinavin kime verildigi bu satirlarda yazili.
  UNION ALL SELECT 23, 'Sinav puani bos birakilabilir (score nullable)',
    (SELECT is_nullable FROM information_schema.columns
       WHERE table_name='ExamResult' AND column_name='score'), 'YES'
  UNION ALL SELECT 24, 'Sinav bilesen tablolari',
    (SELECT count(*)::text FROM pg_tables WHERE schemaname='public'
       AND tablename IN ('ExamComponent','ExamResultComponent')), '2'
  -- Resmi/deneme ayrimi: deneme sinavlari karne ortalamasina karismaz.
  UNION ALL SELECT 25, 'Sinav turu alani (Exam.scope)',
    (SELECT count(*)::text FROM information_schema.columns
       WHERE table_name='Exam' AND column_name='scope'), '1'
  UNION ALL SELECT 26, 'Varsayilan sinav turu deneme',
    (SELECT count(*)::text FROM information_schema.columns
       WHERE table_name='Exam' AND column_name='scope'
         AND column_default LIKE '%PRACTICE%'), '1'
  -- "Girmedi" bos nottan farklidir: bos henuz girilmemis, bu girmeyecek.
  UNION ALL SELECT 27, 'Sinava girmedi alani (ExamResult.isAbsent)',
    (SELECT count(*)::text FROM information_schema.columns
       WHERE table_name='ExamResult' AND column_name='isAbsent'), '1'
  UNION ALL SELECT 11, 'RLS acik tablo',
    (SELECT count(*)::text FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations' AND rowsecurity), '13'
)
SELECT kontrol, bulunan, beklenen,
       CASE WHEN bulunan = beklenen THEN 'TAMAM' ELSE '>>> HATA <<<' END AS durum
FROM k ORDER BY s;
