# teacher-os
## Migration akisi

Bu proje Supabase kullanir. Migration'in nasil uygulandigi, uzerinde
calistigin ortama gore degisir.

### Bilgisayarda (normal gelistirme)

Veritabanina dogrudan baglanilabildigi icin Prisma'nin kendi akisi gecerlidir:

1. `.env.example` dosyasini `.env` olarak kopyala ve iki baglanti adresini doldur.
2. `prisma/schema.prisma` dosyasini degistir.
3. `npx prisma migrate dev --name <ad>`

`DIRECT_URL` (port 5432) migration'lar icin gereklidir; transaction pooler
(port 6543) DDL ve advisory lock desteklemez.

### Claude Code bulut oturumunda

Bu ortam veritabanina ag uzerinden ulasamaz, dolayisiyla `prisma migrate dev`
calismaz. Migration cevrimdisi uretilir ve elle uygulanir:

1. `prisma/schema.prisma` dosyasini degistir.
2. `npm run migration:new -- <ad>` calistir. Komut yerel PostgreSQL'i shadow
   database olarak kullanip migration'i uretir, tum migration'lari sifirdan
   oynatarak dogrular ve `prisma/pending-sql-editor.sql` dosyasini yazar.
3. O dosyanin icerigini Supabase Dashboard > SQL Editor'a yapistirip calistir.

Bu script Linux'a ozgu yollar kullanir; bilgisayarda calismaz, orada da
gerekmez.

### Her iki ortamda gecerli

Uygulanmis bir `migration.sql` dosyasi asla elle degistirilmez; checksum
tutmaz ve Prisma migration'i tanimaz. Degisiklik icin yeni migration uretilir.

Veritabaninin beklenen durumda olup olmadigini `prisma/verify-state.sql`
sorgusu ile kontrol edebilirsin.

## Testler

`scripts/behavior-test.sh` silme kurallarini, arsivlemeyi, puan tutarliligini
ve RLS'i gercek veri uzerinde dener. Migration'larin uygulandigi bir
veritabanina karsi calistirilir.
