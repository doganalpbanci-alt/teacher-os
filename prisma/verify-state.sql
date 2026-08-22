-- Teacher OS - veritabani durum kontrolu
-- Supabase SQL Editor'a yapistirip calistirin. Her satirda "TAMAM" bekleniyor.
WITH k AS (
  SELECT 1 s, 'Migration 1/3 · init' kontrol,
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260821214524_init'
       AND checksum='a47f4ba3092679ef4c671f9542a8dd076ee7f407cde95e65ace9b2bb91cafdc1') bulunan, '1' beklenen
  UNION ALL SELECT 2, 'Migration 2/3 · koruma kurallari',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260822090337_harden_history_and_rls'
       AND checksum='91863bac1101cee740dc7b0887d7d7bd14c955364765b8f1fbcfcabeacb8df16'), '1'
  UNION ALL SELECT 3, 'Migration 3/3 · ders kisiti kaldirildi',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260822105832_allow_multiple_lessons_per_day'
       AND checksum='b3b4e5d6387b1768ddbb1a9f77b6b88fb24769d9183a92aa398fbe66e34eb232'), '1'
  UNION ALL SELECT 4, 'Fazladan/taninmayan migration kaydi',
    (SELECT coalesce(string_agg(migration_name,', '),'yok') FROM "_prisma_migrations"
       WHERE migration_name NOT IN ('20260821214524_init','20260822090337_harden_history_and_rls','20260822105832_allow_multiple_lessons_per_day')), 'yok'
  UNION ALL SELECT 5, 'Geri alinmis migration',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE rolled_back_at IS NOT NULL OR finished_at IS NULL), '0'
  UNION ALL SELECT 6, 'Tablo sayisi',
    (SELECT count(*)::text FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations'), '10'
  UNION ALL SELECT 7, 'Ayni gune ikinci ders (kisit kalkti mi)',
    (SELECT count(*)::text FROM pg_indexes WHERE tablename='Lesson' AND indexdef ILIKE '%UNIQUE%' AND indexname<>'Lesson_pkey'), '0'
  UNION ALL SELECT 8, 'Gecmis korumasi (RESTRICT baglanti)',
    (SELECT count(*)::text FROM pg_constraint WHERE contype='f' AND confdeltype='r'), '10'
  UNION ALL SELECT 9, 'Sinif arsivleme alani (isActive)',
    (SELECT count(*)::text FROM information_schema.columns WHERE table_name='Classroom' AND column_name='isActive'), '1'
  UNION ALL SELECT 10, 'Puan tutarlilik kisiti',
    (SELECT count(*)::text FROM pg_constraint WHERE conname='BehaviorLog_points_matches_type'), '1'
  UNION ALL SELECT 11, 'RLS acik tablo',
    (SELECT count(*)::text FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations' AND rowsecurity), '10'
)
SELECT kontrol, bulunan, beklenen,
       CASE WHEN bulunan = beklenen THEN 'TAMAM' ELSE '>>> HATA <<<' END AS durum
FROM k ORDER BY s;
