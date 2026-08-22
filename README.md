# teacher-os
## Migration akisi

Bu proje Supabase kullanir. Gelistirme ortami veritabanina dogrudan
baglanamadigi icin `prisma migrate dev` calismaz; migration'lar cevrimdisi
uretilip Supabase SQL Editor uzerinden uygulanir.

1. `prisma/schema.prisma` dosyasini degistir.
2. `npm run migration:new -- <ad>` calistir.
   Komut yerel PostgreSQL'i shadow database olarak kullanip migration'i
   uretir, tum migration'lari sifirdan oynatarak dogrular ve
   `prisma/pending-sql-editor.sql` dosyasini yazar.
3. O dosyanin icerigini Supabase Dashboard > SQL Editor'a yapistirip calistir.

Uygulanmis bir `migration.sql` dosyasi asla elle degistirilmez; checksum
tutmaz ve Prisma migration'i tanimaz. Degisiklik icin yeni migration uretilir.
