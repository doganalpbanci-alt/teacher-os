-- Teacher OS - veritabani durum kontrolu
-- Supabase SQL Editor'a yapistirip calistirin. Her satirda "TAMAM" bekleniyor.
WITH k AS (
  SELECT 1 s, 'Migration 1/5 · init' kontrol,
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260821214524_init'
       AND checksum='a47f4ba3092679ef4c671f9542a8dd076ee7f407cde95e65ace9b2bb91cafdc1') bulunan, '1' beklenen
  UNION ALL SELECT 2, 'Migration 2/5 · koruma kurallari + RLS',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260822105533_harden_history_and_rls'
       AND checksum='afcb1876314d16c32ff82d26aa7af9a82e3a8f0fa71bdc50da01790069cccff5'), '1'
  UNION ALL SELECT 3, 'Migration 3/5 · davranis sablonu',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260822235800_behavior_template'
       AND checksum='94375e958bda926bddd3ea6bb05d597ac74693c1ed9276c1187560ab021f56f7'), '1'
  UNION ALL SELECT 3.5, 'Migration 4/5 · teneffus cezasi',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260823144543_break_penalty'
       AND checksum='ffa1b73b6d26d509c6e5e3ffb88b9a292630e24958019221a1ca8c6404a12199'), '1'
  UNION ALL SELECT 3.6, 'Migration 5/6 · ders bitisi',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260823174546_lesson_ended_at'
       AND checksum='471a0d711809feadead51072c977097c2cfb9b1702cd0c572837d0295717f7ca'), '1'
  UNION ALL SELECT 3.7, 'Migration 6/6 · odev modulu',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260825152117_assignment_module'
       AND checksum='485d7dbcf673252987540cacfc282971523fb0563b36aa1a86248e77bc1e2d26'), '1'
  UNION ALL SELECT 4, 'Fazladan/taninmayan migration kaydi',
    (SELECT coalesce(string_agg(migration_name,', '),'yok') FROM "_prisma_migrations"
       WHERE migration_name NOT IN ('20260821214524_init','20260822105533_harden_history_and_rls',
                                    '20260822235800_behavior_template',
                                    '20260823144543_break_penalty',
                                    '20260823174546_lesson_ended_at',
                                    '20260825152117_assignment_module')), 'yok'
  UNION ALL SELECT 5, 'Geri alinmis migration',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE rolled_back_at IS NOT NULL OR finished_at IS NULL), '0'
  UNION ALL SELECT 6, 'Tablo sayisi',
    (SELECT count(*)::text FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations'), '11'
  UNION ALL SELECT 7, 'Ayni gune ikinci ders (kisit kalkti mi)',
    (SELECT count(*)::text FROM pg_indexes WHERE tablename='Lesson' AND indexdef ILIKE '%UNIQUE%' AND indexname<>'Lesson_pkey'), '0'
  UNION ALL SELECT 8, 'Gecmis korumasi (RESTRICT baglanti)',
    (SELECT count(*)::text FROM pg_constraint WHERE contype='f' AND confdeltype='r'), '12'
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
  UNION ALL SELECT 18, 'Odev ogretmene bagli (Assignment.teacherId)',
    (SELECT count(*)::text FROM information_schema.columns
       WHERE table_name='Assignment' AND column_name='teacherId'), '1'
  UNION ALL SELECT 19, 'Odev artik tek sinifa bagli DEGIL (classroomId kalkti)',
    (SELECT count(*)::text FROM information_schema.columns
       WHERE table_name='Assignment' AND column_name='classroomId'), '0'
  UNION ALL SELECT 20, 'Odev tarih ve arsiv alanlari',
    (SELECT count(*)::text FROM information_schema.columns
       WHERE table_name='Assignment' AND column_name IN ('startDate','isActive','updatedAt')), '3'
  UNION ALL SELECT 11, 'RLS acik tablo',
    (SELECT count(*)::text FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations' AND rowsecurity), '11'
)
SELECT kontrol, bulunan, beklenen,
       CASE WHEN bulunan = beklenen THEN 'TAMAM' ELSE '>>> HATA <<<' END AS durum
FROM k ORDER BY s;
