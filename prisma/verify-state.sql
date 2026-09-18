-- Teacher OS - veritabani durum kontrolu
-- Supabase SQL Editor'a yapistirip calistirin. Her satirda "TAMAM" bekleniyor.
WITH k AS (
  SELECT 1 s, 'Migration 1/14 · init' kontrol,
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260821214524_init'
       AND checksum='a47f4ba3092679ef4c671f9542a8dd076ee7f407cde95e65ace9b2bb91cafdc1') bulunan, '1' beklenen
  UNION ALL SELECT 2, 'Migration 2/14 · koruma kurallari + RLS',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260822105533_harden_history_and_rls'
       AND checksum='afcb1876314d16c32ff82d26aa7af9a82e3a8f0fa71bdc50da01790069cccff5'), '1'
  UNION ALL SELECT 3, 'Migration 3/14 · davranis sablonu',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260822235800_behavior_template'
       AND checksum='94375e958bda926bddd3ea6bb05d597ac74693c1ed9276c1187560ab021f56f7'), '1'
  UNION ALL SELECT 3.5, 'Migration 4/14 · teneffus cezasi',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260823144543_break_penalty'
       AND checksum='ffa1b73b6d26d509c6e5e3ffb88b9a292630e24958019221a1ca8c6404a12199'), '1'
  UNION ALL SELECT 3.6, 'Migration 5/14 · ders bitisi',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260823174546_lesson_ended_at'
       AND checksum='471a0d711809feadead51072c977097c2cfb9b1702cd0c572837d0295717f7ca'), '1'
  UNION ALL SELECT 3.7, 'Migration 6/14 · odev modulu',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260825152117_assignment_module'
       AND checksum='71bbf50cd7740dc8c769a9d227e7566eeb974c6968784b4ac2dbc5196f333289'), '1'
  UNION ALL SELECT 3.8, 'Migration 7/14 · tek acik ders kisiti',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260825191157_lesson_single_open'
       AND checksum='558337ff70a7f297c44533d391affac5bb9ecaf83ad9d56cf13209d132da3473'), '1'
  UNION ALL SELECT 3.9, 'Migration 8/14 · sinav ogretmene tasindi',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260825202845_exam_teacher_owned'
       AND checksum='b0254569fef57ef205180b83d3f628f495c6a8758778c1a58469d5390a428f0d'), '1'
  UNION ALL SELECT 3.95, 'Migration 9/14 · sinav bilesenleri',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260825205716_exam_components'
       AND checksum='17ac5ac0851464fddec16936a63907e224362acc9405da0b3dae52dcbc080f40'), '1'
  UNION ALL SELECT 3.96, 'Migration 10/14 · tahta kilidi',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260831174322_board_lock'
       AND checksum='15cad9a53b6027c75607208757f10af0d0e67af4dd5b3233b5f00ada542f4b6a'), '1'
  UNION ALL SELECT 3.97, 'Migration 11/14 · veli izin onayi',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260901092250_parent_consent'
       AND checksum='eb148c714e4cd2d48c06ab831a48838cedab7525cf073c3a46fb57956db73a10'), '1'
  UNION ALL SELECT 3.98, 'Migration 12/14 · sinif hedefleri',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260912180157_sinif_hedefleri'
       AND checksum='5dc1ba95bbb66d048d8ae4c8b721b824b97cce2b0743b09f93ff4a4e2239b2fc'), '1'
  UNION ALL SELECT 3.99, 'Migration 13/14 · exp sistemi',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260912192838_exp_sistemi'
       AND checksum='ec1681752ff2eae7417f1ed9cb4daf855fa8596b712c9fb202f75ba6574fbfe6'), '1'
  UNION ALL SELECT 3.995, 'Migration 14/14 · qr ile tahta girisi',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name='20260918191012_qr_ile_tahta_girisi'
       AND checksum='5a8aeb127411430f88512e79f11d3e2b3ecf9ad64912a059094e300d580b95de'), '1'
  UNION ALL SELECT 4, 'Fazladan/taninmayan migration kaydi',
    (SELECT coalesce(string_agg(migration_name,', '),'yok') FROM "_prisma_migrations"
       WHERE migration_name NOT IN ('20260821214524_init','20260822105533_harden_history_and_rls',
                                    '20260822235800_behavior_template',
                                    '20260823144543_break_penalty',
                                    '20260823174546_lesson_ended_at',
                                    '20260825152117_assignment_module',
                                    '20260825191157_lesson_single_open',
                                    '20260825202845_exam_teacher_owned',
                                    '20260825205716_exam_components',
                                    '20260831174322_board_lock',
                                    '20260901092250_parent_consent',
                                    '20260912180157_sinif_hedefleri',
                                    '20260912192838_exp_sistemi',
                                    '20260918191012_qr_ile_tahta_girisi')), 'yok'
  UNION ALL SELECT 5, 'Geri alinmis migration',
    (SELECT count(*)::text FROM "_prisma_migrations" WHERE rolled_back_at IS NOT NULL OR finished_at IS NULL), '0'
  UNION ALL SELECT 6, 'Tablo sayisi',
    (SELECT count(*)::text FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations'), '16'
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
  -- Tahta kilidi. PIN hesap parolasindan AYRI bir sutunda durur: tahtaya
  -- yazilan seyi butun sinif gorur, orada hesap parolasi yazilmamalidir.
  UNION ALL SELECT 28, 'Tahta PIN alani (Teacher.boardPin)',
    (SELECT count(*)::text FROM information_schema.columns
       WHERE table_name='Teacher' AND column_name='boardPin'), '1'
  UNION ALL SELECT 29, 'PIN kurulmamis olabilir (boardPin nullable)',
    (SELECT is_nullable FROM information_schema.columns
       WHERE table_name='Teacher' AND column_name='boardPin'), 'YES'
  UNION ALL SELECT 30, 'Kilit acik kalma suresi varsayilani 10 dakika',
    (SELECT count(*)::text FROM information_schema.columns
       WHERE table_name='Teacher' AND column_name='boardUnlockMinutes'
         AND column_default LIKE '%10%'), '1'
  UNION ALL SELECT 31, 'Veli izin onayi alani (Student.parentConsentAt)',
    (SELECT count(*)::text FROM information_schema.columns
       WHERE table_name='Student' AND column_name='parentConsentAt'), '1'
  UNION ALL SELECT 32, 'Izin tarihi bos birakilabilir (nullable)',
    (SELECT is_nullable FROM information_schema.columns
       WHERE table_name='Student' AND column_name='parentConsentAt'), 'YES'
  -- Sinif hedefleri: behaviorTemplate gibi ogretmen bazli acilir/kapanir,
  -- varsayilan kapali. Ilerleme ayrica tutulmaz, gercek kaynak BehaviorLog'dur.
  UNION ALL SELECT 33, 'Gamification alani (Teacher.gamificationEnabled)',
    (SELECT count(*)::text FROM information_schema.columns
       WHERE table_name='Teacher' AND column_name='gamificationEnabled'), '1'
  UNION ALL SELECT 34, 'Varsayilan gamification kapali',
    (SELECT count(*)::text FROM information_schema.columns
       WHERE table_name='Teacher' AND column_name='gamificationEnabled'
         AND column_default LIKE '%false%'), '1'
  UNION ALL SELECT 35, 'Sinif hedefi tablosu (ClassGoal)',
    (SELECT count(*)::text FROM pg_tables WHERE schemaname='public' AND tablename='ClassGoal'), '1'
  UNION ALL SELECT 36, 'Hedef sayisi pozitif kisiti',
    (SELECT count(*)::text FROM pg_constraint WHERE conname='ClassGoal_target_pozitif'), '1'
  -- EXP sistemi: performans notundan bagimsiz, yalnizca artan bir sayac.
  -- Kaynak ExpEvent (append-only), Student.expTotal cache'lenmis toplamdir.
  UNION ALL SELECT 37, 'EXP toplam alani (Student.expTotal)',
    (SELECT count(*)::text FROM information_schema.columns
       WHERE table_name='Student' AND column_name='expTotal'), '1'
  UNION ALL SELECT 38, 'Varsayilan EXP sifir',
    (SELECT count(*)::text FROM information_schema.columns
       WHERE table_name='Student' AND column_name='expTotal'
         AND column_default LIKE '%0%'), '1'
  UNION ALL SELECT 39, 'EXP olay tablosu (ExpEvent)',
    (SELECT count(*)::text FROM pg_tables WHERE schemaname='public' AND tablename='ExpEvent'), '1'
  UNION ALL SELECT 40, 'Ayni olaydan iki kez EXP yazilamaz (essiz kisit)',
    (SELECT count(*)::text FROM pg_indexes
       WHERE tablename='ExpEvent' AND indexname='ExpEvent_source_referenceId_key'), '1'
  UNION ALL SELECT 41, 'EXP miktari pozitif kisiti',
    (SELECT count(*)::text FROM pg_constraint WHERE conname='ExpEvent_amount_pozitif'), '1'
  UNION ALL SELECT 42, 'Toplam EXP negatif olamaz kisiti',
    (SELECT count(*)::text FROM pg_constraint WHERE conname='Student_expTotal_pozitif'), '1'
  -- QR ile tahta girisi: eslesme tek kullanimlik ve durumu ayri bir kolonda
  -- tutulmaz, uc zaman damgasindan turetilir. Kisitlar o tutarliligi korur.
  UNION ALL SELECT 43, 'Eslesme tablosu (DevicePairing)',
    (SELECT count(*)::text FROM pg_tables WHERE schemaname='public' AND tablename='DevicePairing'), '1'
  UNION ALL SELECT 44, 'Giz yalnizca ozet olarak saklanir (verifierHash)',
    (SELECT count(*)::text FROM information_schema.columns
       WHERE table_name='DevicePairing' AND column_name='verifierHash'), '1'
  UNION ALL SELECT 45, 'Dogrulama kodu bicimi kisiti',
    (SELECT count(*)::text FROM pg_constraint WHERE conname='DevicePairing_code_bicimi'), '1'
  UNION ALL SELECT 46, 'Onaysiz eslesme kullanilamaz kisiti',
    (SELECT count(*)::text FROM pg_constraint WHERE conname='DevicePairing_onaysiz_kullanilamaz'), '1'
  UNION ALL SELECT 47, 'Onayda ogretmen zorunlu kisiti',
    (SELECT count(*)::text FROM pg_constraint WHERE conname='DevicePairing_onayda_ogretmen_zorunlu'), '1'
  UNION ALL SELECT 11, 'RLS acik tablo',
    (SELECT count(*)::text FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations' AND rowsecurity), '16'
)
SELECT kontrol, bulunan, beklenen,
       CASE WHEN bulunan = beklenen THEN 'TAMAM' ELSE '>>> HATA <<<' END AS durum
FROM k ORDER BY s;
