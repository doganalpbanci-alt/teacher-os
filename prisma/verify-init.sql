-- Teacher OS - init migration dogrulama
WITH k AS (
  SELECT 1 AS s, 'Tablolar' AS kontrol,
         (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations') AS bulunan, 10 AS beklenen
  UNION ALL SELECT 2, 'Enum tipleri',
         (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e'), 3
  UNION ALL SELECT 3, 'Index''ler',
         (SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND tablename<>'_prisma_migrations'), 26
  UNION ALL SELECT 4, 'Foreign key''ler',
         (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='f'), 15
  UNION ALL SELECT 5, 'RESTRICT FK (gecmis korumasi)',
         (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='f' AND c.confdeltype='r'), 4
  UNION ALL SELECT 6, 'RLS acik tablo',
         (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations' AND rowsecurity), 10
  UNION ALL SELECT 7, 'Migration kaydi',
         (SELECT count(*) FROM "_prisma_migrations" WHERE migration_name='20260821214524_init'), 1
  UNION ALL SELECT 8, 'Checksum dogru',
         (SELECT count(*) FROM "_prisma_migrations" WHERE migration_name='20260821214524_init'
            AND checksum='a47f4ba3092679ef4c671f9542a8dd076ee7f407cde95e65ace9b2bb91cafdc1'), 1
  UNION ALL SELECT 9, 'Tamamlanmis isaretli',
         (SELECT count(*) FROM "_prisma_migrations" WHERE migration_name='20260821214524_init'
            AND finished_at IS NOT NULL AND rolled_back_at IS NULL), 1
)
SELECT kontrol, bulunan, beklenen,
       CASE WHEN bulunan = beklenen THEN 'TAMAM' ELSE 'HATA' END AS durum
FROM k ORDER BY s;
