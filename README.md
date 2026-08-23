# teacher-os

Ingilizce ogretmenleri icin ogrenci, sinif, ders, odev, performans ve davranis
takip paneli. Next.js 15 (App Router) + TypeScript + Prisma + Supabase.

Projeye yeni basliyorsan sirasiyla: `HANDOFF.md` (mevcut durum),
`CLAUDE.md` (kurallar), `ROADMAP.md` (yon).

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

Üç arayüz testi vardır, hepsi gerçek tarayıcıda çalışır:

- `scripts/e2e-test.mjs` — sınıf ve öğrenci ekleme (33 kontrol)
- `scripts/template-ui-test.mjs` — şablonlar, elle not, şablon değişimi (25 kontrol)
- `scripts/behavior-ui-test.mjs` — kart kuralları (24 kontrol)
- `scripts/history-ui-test.mjs` — öğrenci geçmişi ve dönem toplamları (16 kontrol)
- `scripts/auth-ui-test.mjs` — giriş sistemi ve veri ayrımı (26 kontrol)
- `scripts/card-buttons-ui-test.mjs` — kart şablonunun üç düğmesi (24 kontrol)
- `scripts/penalty-ui-test.mjs` — teneffüs cezası ve kronometre (22 kontrol)

Çalıştırma adımları dosyaların başındadır. Hepsi veri yazar; üretim
veritabanına karşı çalıştırılmaz.

## Giriş sistemi

Oturum imzalı bir çerezde taşınır (`jose`), parolalar `bcryptjs` ile
hash'lenir. Veritabanında oturum tablosu yoktur. `SESSION_SECRET` ortam
değişkeni zorunludur; eksikse uygulama zayıf bir varsayılana düşmez, hata
verir.

Kurulum bir kez yapılır: hesap yokken `/kurulum` açılır, sonrasında kapanır.
Kurulum yeni öğretmen oluşturmak yerine, giriş sistemi öncesinde oluşmuş
geçici kaydı devralır — sınıflar ve tüm geçmiş ona bağlıdır.

Veri ayrımı sorgunun parçasıdır: sınıf ve öğrenci sorguları `teacherId`
şartını taşır, başkasına ait kayıt 404 döner. Aynı kontrol server action'larda
da vardır; formdaki gizli alanı değiştirmek yetki kazandırmaz.

## Davranış şablonları

Öğretmen hangi sistemi kullandığını `Teacher.behaviorTemplate` ile seçer;
ayarlar sayfasından değiştirilir ve tüm sınıflarında geçerlidir. Kurallar tek
modülde toplanmıştır: `src/lib/behavior.ts`.

**Basit (varsayılan).** Yalnızca artı ve eksi vardır, kart yoktur. Kayıtlar
nötrdür, performans notunu değiştirmez. Notu öğretmen öğrenci sayfasından
elle girer.

**Kart sistemi.** Üç düğme vardır: yıldız (+1), sarı kart, kırmızı kart. Sarı
kart düğmesi yükselir: derste öğrencinin kartı yoksa sarı, varsa kırmızı
verir — sarı üstüne sarı kırmızı demektir. Sarı kartın kendisi zaten uyarıdır.
Kırmızı kart düğmesi koşulsuzdur. Kırmızı kart bir MINUS (-5)
kaydı da üretir, sarı kart puana dokunmaz. Kart durumu yalnızca aktif dersin kayıtlarına bakılarak
hesaplanır, bu yüzden sarı kart sonraki derse taşınmaz. Sıfırlama diye bir
yazma işlemi yoktur.

**Teneffüs cezası.** Kırmızı kart puan düşüşünün yanında bir de teneffüse geç
çıkma cezası üretir: arka arkaya birinci kırmızı 2 dakika, ikinci 3, üçüncü ve
sonrası 5. Kırmızı kart almadan geçen bir ders sayacı sıfırlar. Bir öğrencinin
aynı anda en fazla bir açık cezası olur; yeni kırmızı kart süreyi mevcut
cezaya ekler, böylece öğrenci bir kez tutulur.

Kronometre geri sayar. Başlangıç anı veritabanına yazıldığı için sayfa
kapansa da başka cihazdan girilse de kaldığı yerden devam eder. Öğretmen süre
ekleyebilir, çıkarabilir, doğrudan ayarlayabilir ve cezayı erken bitirebilir.
Süre dolduğunda ceza kendiliğinden kapanır.

Şablon değiştirmek geçmiş kayıtları silmez. Kart sisteminde
`Student.performanceScore` bir önbellektir: her kayıttan sonra loglardan
yeniden toplanarak yazılır, artırma/azaltma yapılmaz.

## Öğrenci geçmişi

`/ogrenci/[id]` öğrencinin bütün kayıtlarını derslere göre gruplanmış olarak
gösterir, en yeni ders en üstte. Kırmızı kart veritabanında iki satırdır
(`RED_CARD` ve yanındaki `MINUS`); geçmişte tek bir satır olarak gösterilir,
ham kayıtlara dokunulmaz. Dönem toplamlarında da bu MINUS iki kez sayılmaz.

## Ders yönetimi

Kurallar `src/lib/lesson.ts` içindedir. Bir sınıfın bitmemiş dersi
(`Lesson.endedAt` boş) aktif derstir; sınıfın aynı anda tek dersi olur, süren
ders bitmeden yenisi başlatılamaz. Sınıf sayfasında duruma göre "Yeni ders
başlat" ya da "Dersi bitir" görünür.

Ders bitmesi kaydı kapatır: bitmiş derse yeni davranış kaydı yazılamaz. Bu
kontrol `behavior.ts` içinde, kaydın yazıldığı en alt katmandadır; hiçbir
çağrı yolu atlayamaz. Kart durumu yalnızca aktif dersten okunduğu için ders
bitirmek sarı kartı da doğal olarak kapatır.

`/sinif/[id]/dersler` o sınıfın derslerini en yeniden eskiye listeler: günün
kaçıncı dersi olduğu, bitiş saati ya da "Sürüyor" rozeti ve dersin kayıt
sayıları. `/sinif/[id]/dersler/[dersId]` tek bir dersin kayıtlarını öğrenciye
göre gruplanmış gösterir. İki adres de sahipliği sorgunun parçası olarak
kontrol eder; başkasının dersi 404 döner.
