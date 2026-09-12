-- Teacher OS - _prisma_migrations gecmisini geriye donuk tamamlama
-- Yalnizca STAGING icin: ilk 11 migration'in semasi zaten uygulanmis ama
-- kaydi _prisma_migrations tablosunda yok. Bu SQL semaya HICBIR SEY
-- degistirmez, yalnizca gecmis kaydini tamamlar. Her INSERT "yoksa ekle"
-- kuralina uyar; iki kez calistirmak zarar vermez.
--
-- Once prisma/verify-state.sql ile production'da AYNI bosluk olup olmadigini
-- kontrol edin. Varsa bu dosya orada da calistirilmali.

BEGIN;

INSERT INTO "_prisma_migrations"
  ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
SELECT gen_random_uuid()::text, 'a47f4ba3092679ef4c671f9542a8dd076ee7f407cde95e65ace9b2bb91cafdc1', now(), '20260821214524_init', NULL, NULL, now(), 1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = '20260821214524_init');

INSERT INTO "_prisma_migrations"
  ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
SELECT gen_random_uuid()::text, 'afcb1876314d16c32ff82d26aa7af9a82e3a8f0fa71bdc50da01790069cccff5', now(), '20260822105533_harden_history_and_rls', NULL, NULL, now(), 1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = '20260822105533_harden_history_and_rls');

INSERT INTO "_prisma_migrations"
  ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
SELECT gen_random_uuid()::text, '94375e958bda926bddd3ea6bb05d597ac74693c1ed9276c1187560ab021f56f7', now(), '20260822235800_behavior_template', NULL, NULL, now(), 1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = '20260822235800_behavior_template');

INSERT INTO "_prisma_migrations"
  ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
SELECT gen_random_uuid()::text, 'ffa1b73b6d26d509c6e5e3ffb88b9a292630e24958019221a1ca8c6404a12199', now(), '20260823144543_break_penalty', NULL, NULL, now(), 1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = '20260823144543_break_penalty');

INSERT INTO "_prisma_migrations"
  ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
SELECT gen_random_uuid()::text, '471a0d711809feadead51072c977097c2cfb9b1702cd0c572837d0295717f7ca', now(), '20260823174546_lesson_ended_at', NULL, NULL, now(), 1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = '20260823174546_lesson_ended_at');

INSERT INTO "_prisma_migrations"
  ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
SELECT gen_random_uuid()::text, '71bbf50cd7740dc8c769a9d227e7566eeb974c6968784b4ac2dbc5196f333289', now(), '20260825152117_assignment_module', NULL, NULL, now(), 1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = '20260825152117_assignment_module');

INSERT INTO "_prisma_migrations"
  ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
SELECT gen_random_uuid()::text, '558337ff70a7f297c44533d391affac5bb9ecaf83ad9d56cf13209d132da3473', now(), '20260825191157_lesson_single_open', NULL, NULL, now(), 1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = '20260825191157_lesson_single_open');

INSERT INTO "_prisma_migrations"
  ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
SELECT gen_random_uuid()::text, 'b0254569fef57ef205180b83d3f628f495c6a8758778c1a58469d5390a428f0d', now(), '20260825202845_exam_teacher_owned', NULL, NULL, now(), 1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = '20260825202845_exam_teacher_owned');

INSERT INTO "_prisma_migrations"
  ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
SELECT gen_random_uuid()::text, '17ac5ac0851464fddec16936a63907e224362acc9405da0b3dae52dcbc080f40', now(), '20260825205716_exam_components', NULL, NULL, now(), 1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = '20260825205716_exam_components');

INSERT INTO "_prisma_migrations"
  ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
SELECT gen_random_uuid()::text, '15cad9a53b6027c75607208757f10af0d0e67af4dd5b3233b5f00ada542f4b6a', now(), '20260831174322_board_lock', NULL, NULL, now(), 1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = '20260831174322_board_lock');

INSERT INTO "_prisma_migrations"
  ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
SELECT gen_random_uuid()::text, 'eb148c714e4cd2d48c06ab831a48838cedab7525cf073c3a46fb57956db73a10', now(), '20260901092250_parent_consent', NULL, NULL, now(), 1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = '20260901092250_parent_consent');

COMMIT;
