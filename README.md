# teacher-os

Ingilizce ogretmenleri icin ogrenci, sinif, ders, odev, performans ve davranis
takip paneli. Next.js 15 (App Router) + TypeScript + Prisma + Supabase.

## Uygulamayi calistirma

```
npm install          # postinstall Prisma Client'i uretir
npm run dev          # gelistirme sunucusu, http://localhost:3000
npm run build        # uretim derlemesi
npm start            # derlenmis uygulamayi calistirir
```

`.env` dosyasi gereklidir; sablonu `.env.example` icindedir.

Ana sayfa su an yalnizca bir baglanti testidir: `Teacher` tablosundaki kayit
sayisini okuyup ekrana yazar. Veritabanina ulasilamazsa sayfa cokmez, hatanin
sebebini gosterir.

## Vercel'e deploy

1. Vercel'de projeyi bu depoya bagla (Framework: Next.js, otomatik algilanir).
2. Settings > Environment Variables altina `DATABASE_URL` ve `DIRECT_URL`
   degerlerini ekle. `.env.example` icindeki aciklamalar gecerlidir.
3. Degiskenleri Production, Preview ve Development ortamlarinin hepsine ekle;
   aksi halde preview deployment'lar veritabanina ulasamaz.

`DATABASE_URL` transaction pooler (port 6543) olmalidir: serverless ortamda
her istek yeni bir baglanti acar, pooler bunu tasir. `connection_limit=1` ve
`pgbouncer=true` parametreleri bu yuzden zorunludur.

`postinstall` script'i `prisma generate` calistirir. Vercel bagimlilik
onbellegini kullandigi icin bu adim olmadan build "@prisma/client did not
initialize yet" hatasi verir.

Ana sayfa `force-dynamic` isaretlidir; build sirasinda veritabanina gitmez,
her istekte taze veri okur.

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

`scripts/e2e-test.mjs` sınıf ve öğrenci ekleme akışını gerçek tarayıcıda
dener (33 kontrol). `scripts/behavior-ui-test.mjs` ders başlatma, +/- puan ve
sarı/kırmızı kart kurallarını dener (23 kontrol). Çalıştırma adımları
dosyaların başındadır. İkisi de veri yazar; üretim veritabanına karşı
çalıştırılmaz.

## Kart ve puan kuralları

Kurallar tek modülde toplanmıştır: `src/lib/behavior.ts`. Puan sabitleri de
oradadır (başlangıç 90, PLUS +1, MINUS -5).

Bir ders içinde öğrencinin ilk kural ihlali sarı kart ve uyarıdır, puana
dokunmaz. Aynı ders içindeki tekrar eden ihlaller kırmızı kart ve MINUS
üretir. Kart durumu her zaman yalnızca aktif dersin kayıtlarına bakılarak
hesaplanır; bu yüzden sarı kart sonraki derse taşınmaz. Sıfırlama diye bir
yazma işlemi yoktur, geçmiş kayıtlara dokunulmaz.

`Student.performanceScore` bir önbellektir. Her davranış kaydından sonra
loglardan yeniden toplanarak yazılır, artırma/azaltma yapılmaz.

Ders yönetimi ekranı henüz yok. Geçici kural `src/lib/current-lesson.ts`
içindedir: bir sınıfın en son açılmış dersi aktif derstir. Gerçek ders ekranı
geldiğinde yalnızca o dosya değişir.
