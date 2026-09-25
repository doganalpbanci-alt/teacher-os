# Devir Notu

Yeni bir oturuma başlarken önce bunu, sonra `CLAUDE.md` (kurallar) ve
`ROADMAP.md` (yön) dosyalarını oku. Bu belge **mevcut durumu** anlatır.

Son güncelleme: 25 Eylül 2026 · anlatılan kod durumu `main` = `bb5c219`
(üstündeki commit'ler yalnızca bu notun kendisi olabilir)

---

## Proje nedir

İngilizce öğretmenleri için öğrenci, sınıf, ders, ödev, sınav, davranış,
performans ve veli iletişimi takip paneli. Tek öğretmenin kişisel aracı
olarak başladı, artık çok öğretmenli çalışacak yapıda.

## Nerede çalışıyor

| | |
|---|---|
| Depo | `doganalpbanci-alt/teacher-os` |
| Deploy dalı | `main` — her push Vercel'de otomatik yayına girer (Production) |
| Test dalı | `staging` — her push Vercel'de ayrı bir Preview deployment üretir |
| Çalışma dalı | her iş için yeni bir `claude/...` dalı → önce `staging`'e merge → orada test/onay → sonra `main`'e merge |
| Canlı | https://teacher-os-black.vercel.app |
| Staging | https://teacher-os-git-staging-doganalp-banci.vercel.app |
| Veritabanı | Supabase PostgreSQL — production ve staging **ayrı, izole projeler** |

Vercel ortam değişkenleri: `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`.
Production ve Preview için **ayrı ayrı** tanımlı — Production kendi
Supabase'ine, Preview (yani `staging`) kendi izole Supabase'ine bağlanır.
Ayrıntı ve gerekçe için aşağıdaki "Dallanma ve staging" bölümüne bak.
`SESSION_SECRET` "sensitive" olduğu için Development ortamında yoktur;
gerekmiyor.

---

## ÖNEMLİ: bu ortamdan veritabanına erişilemez

Claude Code bulut oturumu Supabase'e ağ üzerinden **ulaşamaz** (proxy yalnızca
HTTPS geçirir, Postgres portları kapalıdır). Bu yüzden `prisma migrate dev`
burada çalışmaz. Migration akışı:

1. `prisma/schema.prisma` değiştirilir.
2. `npm run migration:new -- <ad> [--sql <ek-dosya>]`
   Yerel PostgreSQL'i shadow database olarak kullanır, migration'ı üretir,
   hepsini sıfırdan oynatarak doğrular, `prisma/pending-sql-editor.sql` yazar.
3. O dosyanın içeriği kullanıcıya verilir; **kullanıcı** Supabase SQL
   Editor'de çalıştırır.
4. `prisma/verify-state.sql` ile doğrulanır (her satır "TAMAM").
5. **Ancak ondan sonra** `main`'e merge edilir ve deploy tetiklenir.

Sıra ters olursa uygulama olmayan bir sütunu arar ve kırılır.

**3 Eylül 2026'dan beri şema değişikliği iki veritabanına gidiyor**:
production'da yukarıdaki akışla, ayrıca staging'in kendi izole Supabase
projesinde de aynı SQL çalıştırılmalı — yoksa staging'in şeması
production'dan sürüklenir ve orada test etmek anlamsızlaşır.

Uygulanmış bir `migration.sql` **asla** elle değiştirilmez; checksum tutmaz.

Prisma **6.19.3'te sabit**. Prisma 7 `url`/`directUrl` alanlarını
`schema.prisma`'dan kaldırdı; yükseltilirse şema geçersiz olur.

### Şema değiştirmeden önce: tabloda veri var mı

Üretimde satır varsa `ADD COLUMN ... NOT NULL` (varsayılansız) migration'ı
durdurur. Bu bir kere yaşandı: `Assignment.teacherId` boş olmayan tabloya
eklenmeye çalışıldı, PostgreSQL reddetti. Doğrusu üç adım: **nullable ekle →
mevcut satırları doldur → NOT NULL yap.** Bkz. migration 6.

İyi haber: SQL Editor betiği `BEGIN/COMMIT` içinde, yani hata her şeyi geri
alır. Yarım uygulanmış şema oluşmaz.

**Önden düşünülmüş ama henüz kullanılmayan alanlar bazen migration'ı
öne çeker:** `Classroom.isActive` ve `Student.isActive` archiving için
en baştan eklenmişti; aylar sonra arşivleme özelliği yazılırken hiç
migration gerekmedi, yalnızca eksik olan action/düğme eklendi.

---

## Migration'lar (14)

```
20260821214524_init                    tablolar
20260822105533_harden_history_and_rls  RESTRICT silme kuralları + RLS
20260822235800_behavior_template       Teacher.behaviorTemplate + puan kısıtı gevşetildi
20260823144543_break_penalty           BreakPenalty tablosu
20260823174546_lesson_ended_at         Lesson.endedAt + eski dersler kapatıldı
20260825152117_assignment_module       Assignment sınıftan öğretmene taşındı
20260825191157_lesson_single_open      tek açık ders kısıtı + birikmiş dersler kapatıldı
20260825202845_exam_teacher_owned      Exam sınıftan öğretmene taşındı
20260825205716_exam_components         ExamComponent + ExamResultComponent, scope, isAbsent
20260831174322_board_lock              Teacher.boardPin/boardUnlockMinutes
20260901092250_parent_consent          Student.parentName/parentPhone/parentConsentAt
20260912180157_sinif_hedefleri         Teacher.gamificationEnabled + ClassGoal tablosu
20260912192838_exp_sistemi             Student.expTotal + ExpEvent tablosu
20260918191012_qr_ile_tahta_girisi     DevicePairing tablosu (QR ile tahta girişi)
```

Hepsi hem production hem staging Supabase'inde uygulandı ve
`verify-state.sql` ile doğrulandı (59 satır, hepsi TAMAM). Bekleyen
migration yok.

**Staging bir süre EXP migration'ı olmadan çalıştı (18 Eylül'de yakalandı).**
`20260912192838_exp_sistemi` production'a uygulanmış ama staging'e hiç
gitmemişti: staging'de `ExpEvent` tablosu ve `Student.expTotal` yoktu, kod
ise onları arıyordu — orada gamification açıkken yıldız vermek ya da
öğrenci sayfasını açmak hata verirdi. QR migration'ı için verify çıktısı
istendiğinde ortaya çıktı ve aynı SQL staging'de çalıştırılarak kapatıldı.

Not: EXP, staging'e QR'dan SONRA uygulandı, yani migration sırası bozuldu.
İkisi bağımsız olduğu için sorun değil (EXP `Student`'a, QR `Teacher`'a
dokunur, aralarında bağımlılık yok) — ama varsayılmadı: staging'in tam
durumu yerelde kurulup EXP sıra dışı uygulanarak önce denendi.

**Performans notu tabanı 90'dan 80'e indirildi (12 Eylül) — bunun bir
migration'ı YOK.** Yıldız +1, kırmızı kart -5 aynı kaldı; değişen tek şey
`behavior-rules.ts`'teki `BASLANGIC_PUANI` sabiti, şemaya dokunmadı.
Öğretmenin isteğiyle bu değişiklik **`staging` atlanarak doğrudan `main`'e**
alındı — normalde geçerli olan "önce staging, sonra main" kuralının
bilinçli, tek seferlik istisnasıydı, kalıcı bir politika değişikliği değil.

Kart şablonunda not `BASLANGIC_PUANI + SUM(BehaviorLog.points)` olarak
**her yeni kayıtta yeniden hesaplandığı için**, taban değişince var olan
öğrencilerin notu kendiliğinden değişmez — yalnızca bir sonraki kayıtta
(yıldız/kart verildiğinde) aniden 10 puan düşer, öğrenci öğrenci, farklı
zamanlarda. Bunu önlemek için `prisma/onetime-recompute-performance-score.sql`
hazırlandı (CARD şablonundaki tüm öğrencilerin notunu tek seferde yeni
tabana göre eşitler; SIMPLE şablonundaki elle girilen notlara dokunmaz).
**17 Eylül'de çözüldü:** öğretmen bu değişiklikten önce sınıflarını zaten
baştan açmıştı (eski öğrenci/geçmiş kaydı yok), yani eski 90 tabanından
etkilenecek bir veri hiç kalmamıştı; recompute SQL'i çalıştırmaya gerek
kalmadı. Bu not, ileride taban tekrar değiştirilirse aynı riski (mevcut
öğrencilerin notunun bir sonraki kayda kadar eski taban üzerinden kalması)
hatırlamak için duruyor.

**Staging'in `_prisma_migrations` geçmişinde bir boşluk çıktı (12 Eylül):**
ilk 11 migration'ın şeması staging'de tamdı ama kaydı tablosunda yoktu —
muhtemelen staging ilk kurulurken şema tek seferde push edilmiş, tek tek
migration kaydı yazılmamış. Şemaya dokunmuyor, yalnızca bookkeeping; ama
biri ileride staging'de `npm run db:deploy` (`prisma migrate deploy`)
çalıştırırsa Prisma bu 11 migration'ı "hiç uygulanmamış" sanıp yeniden
denemeye çalışır ve "zaten var" hatasıyla dururdu. `prisma/backfill-migration-history.sql`
ile geriye dönük dolduruldu (yalnızca staging'de çalıştırıldı; production'da
zaten bu boşluk yoktu). Not: Vercel'in build'i (`next build`) hiçbir zaman
`prisma migrate deploy` çalıştırmaz — şema her zaman elle SQL Editor'e
yapıştırılır — bu yüzden boşluk canlı uygulamayı hiç etkilemedi.

---

## Mimari

```
src/lib/
  prisma.ts              Prisma Client (tek örnek)
  session.ts             imzalı oturum çerezi (jose)
  lock-token.ts           tahta kilidi için imzalı çerez (edge-safe: jose only)
  auth.ts                parola hash (bcryptjs), oturum aç/kapat
  current-teacher.ts     oturumdaki öğretmen; yoksa /giris'e yönlendirir
  lesson.ts              aktif ders, ders başlat/bitir, ders geçmişi ve detayı
  behavior.ts            davranış kaydını yazan taraf; geri alma da burada
  behavior-rules.ts      şablon kurallarının veritabanısız kısmı; ekran da bunu
                         kullanır, böylece kural iki yere kopyalanmaz
  penalty.ts             teneffüs cezası kuralları + kronometre durumu
  lock.ts / lock-rules.ts akıllı tahta PIN kilidi: hash/doğrulama/deneme sınırı
  board-events.ts        telefondan verilen kartın tahtaya yansıması (polling)
  board-sound.ts         WebAudio 8-bit bildirim sesi
  board-rules.ts         tahta bildiriminin veritabanısız/tarayıcısız kısmı:
                         metin, ekranda kalma süresi (olay türüne göre), sıra
                         baskısı eşiği, büyük gösterilecek türler, PiP renkleri
  board-notification.ts  işletim sistemi bildirimi: izin, gösterme, süre
  board-pip.ts           tahta penceresi (Document Picture-in-Picture): açma
                         ve pencerenin kendi stil sayfası
  parent-message.ts / parent-message-rules.ts
                         veli mesajı: WhatsApp bağlantısı, şablonlar, geçmiş
  account-reset.ts       tüm hesap verisini silme (öğretmen kalır)
  class-goal.ts / class-goal-rules.ts
                         sınıf hedefi: açık hedef + ilerleme (BehaviorLog'dan
                         türetilir), geçmiş hedefler, hedef/ödül geçerliliği
  exp.ts / exp-rules.ts sınıf hedefi ile aynı desende ama ayrı kaynak: EXP
                         append-only ExpEvent'ten toplanır, seviye formülü
                         (artan eşik) ve EXP sabitleri buradan okunur
  assignment.ts          ödev: oluşturma, atama, işaretleme, istatistik, gündem
  exam.ts                sınav: oluşturma, atama, not girme, ortalama, istatistik
  exam-rules.ts          sınav hesabının veritabanısız kısmı: şablonlar, net,
                         ağırlıklı puan, dönem, bileşen form satırı
  dashboard.ts / dashboard-rules.ts
                         genel panel: bekleyen işler, dikkat gereken
                         öğrenciler, sınıf karşılaştırması, 30 günlük özet.
                         Eşikler ve "dikkat" kararı kurallar dosyasında
  pairing.ts / pairing-rules.ts
                         QR ile tahta girişi: eşleşme aç/onayla/tüket.
                         Durum ayrı kolonda değil, üç zaman damgasından
                         türetilir
  devam-yolu.ts          giriş sonrası dönülecek adres + açık yönlendirme
                         koruması (edge-safe: middleware de kullanır)
  progress.ts / progress-rules.ts
                         öğrenci VE sınıf gelişimi: son iki dönemi
                         karşılaştırır. Eşikler, "iyi yön" ve normalleştirme
                         kurallar dosyasında; birim kapsama göre değişir
                         (öğrenci: ders başına, sınıf: ders başına öğrenci)
  report.ts              öğrenci ve sınıf raporu: seçilen dönemin dökümü.
                         Sınav ve ödev satırları mevcut sorgulardan gelir,
                         burada yalnızca döneme süzülür
  student-history.ts     öğrenci geçmişi ve dönem toplamları
  siralama.ts            Türkçe alfabe sıralaması
  form-state.ts          form durumu tipi

src/components/  (~35 dosya; öne çıkanlar)
  UstMenu.tsx              Panel · Sınıflarım · Ödevler · Sınavlar · Veli · Ayarlar + sayaçlar
  OgrenciSatiri.tsx        ders ekranındaki öğrenci satırı; iyimser güncelleme;
                           gamification açıksa "Sv.N" EXP rozeti de burada
  DavranisDugmeleri.tsx    şablona göre düğmeler, gönderimler sıraya girer
  GeriAlDugmesi.tsx        süren dersteki son kaydı geri alır
  DersKontrolu.tsx         duruma göre "Yeni ders başlat" ya da "Dersi bitir"
  CezaKontrolu.tsx         ceza rozeti + kronometre paneli
  TahtaKilidi.tsx          PIN pad'i, kilit rozeti, kilit/aç akışı
  SinifCanliBildirimleri.tsx  telefonda verilen kartın tahtada canlı yansıması + ses;
                           üç gösterim kanalını da o yönetir (sayfa içi kutu,
                           işletim sistemi bildirimi, tahta penceresi)
  TahtaPenceresi.tsx       tahta penceresinin içeriği; `createPortal` ile AYRI
                           BİR DOKÜMANA render edilir
  OgrenciAdiFormu.tsx      öğrenci sayfası başlığı; "Düzenle" ile ad/soyad düzeltme
  SinifYonetimi.tsx / OgrenciYonetimi.tsx  arşivle/arşivden çıkar/sil
  HesapSifirlamaFormu.tsx  Ayarlar'daki "Tehlike bölgesi"
  VeliMesajFormu.tsx       hazır şablon + WhatsApp bağlantısı + taslak/gönderildi
  OdevIslemleri.tsx / SinavIslemleri.tsx  düzenle · kopyala · arşivle · sil
  GundemPaneli.tsx         ana sayfadaki "Bugün kontrol edilecek"
  GamificationFormu.tsx    Ayarlar'da sınıf hedeflerini aç/kapa anahtarı
  SinifHedefi.tsx          sınıf sayfasında açık hedef (ilerleme çubuğu) ya da
                           oluşturma formu + geçmiş hedefler listesi
  Panel.tsx                panelin dört bloğu (bekleyen işler, dikkat gereken
                           öğrenciler, sınıf tablosu, 30 günlük özet)
  QrEkrani.tsx             tahtadaki QR ekranının yoklayan kısmı; onaylanınca
                           oturumu alır ve ana sayfaya geçer
  EslesmeOnayi.tsx         telefondaki onay ekranı (kod karşılaştırma + Onayla)
  Gelisim.tsx              son iki dönem + yön okları. Öğrenci sayfası,
                           sınıf sayfası ve iki rapor AYNI bileşeni kullanır;
                           `kapsam` yalnızca birimi değiştirir
  RaporDonemSecici.tsx     rapordaki dönem açılır listesi (`?donem=2025-1`)
  YazdirDugmesi.tsx        raporda "Yazdır / PDF"; window.print() çağırır

src/app/
  page.tsx                gündem paneli + sınıf listesi + arşivlenmiş sınıflar
  panel/                  genel bakış (v0.6): dört blok, son 30 gün
  sinif/[id]/             sınıf detayı: ders, davranış düğmeleri, ceza rozeti,
                          canlı yayın, arşivlenmiş öğrenciler, sınıfı yönet
  sinif/[id]/dersler/     ders geçmişi ve tek dersin kayıtları
  sinif/[id]/odevler/     sınıfın ödevleri + sınıf istatistiği + öğrenci dökümü
  sinif/[id]/sinavlar/    sınıfın sınavları + ortalama + öğrenci dökümü
  sinif/[id]/rapor/       yazdırılabilir sınıf raporu (öğrenci başına satır)
  odevler/, sinavlar/     ödev/sınav listeleri, yeni/düzenle sayfaları
  veli/                   öğrenci seç → mesaj oluştur ekranı
  ogrenci/[id]/           öğrenci: özet, ad düzenleme, not girme, gelişim,
                          ödevler, sınavlar, geçmiş, cezalar, veli mesajı
  ogrenci/[id]/rapor/     yazdırılabilir dönem raporu
  ayarlar/                davranış şablonu, tahta kilidi, sınıf hedefleri
                          anahtarı, tehlike bölgesi
  giris/ kurulum/         oturum ekranları
  giris/qr/               akıllı tahtada QR ile parolasız giriş ekranı
  eslestir/[id]/          telefonun QR'ı okutunca açtığı onay ekranı
  api/sinif/[sinifId]/canli/   canlı yayının yokladığı uç nokta (middleware'den muaf)
  api/eslestirme/[id]/         eşleşme durumu (salt okuma)
  api/eslestirme/[id]/al/      onaylanmış eşleşmenin oturumunu alır (POST)
  actions.ts              sınıf, öğrenci, ders, davranış, ceza, arşiv/sil,
                          sıfırlama, sınıf hedefi oluştur/kapat, gamification aç/kapa
  odev-actions.ts         ödev action'ları (ayrı dosya; modül tek başına büyük)
  sinav-actions.ts        sınav action'ları
  kilit-actions.ts        tahta PIN kurulum/aç action'ları
  veli-actions.ts         veli mesajı action'ları
  oturum-actions.ts       giriş / kurulum / çıkış (giriş `?devam=` onurlandırır)
  eslestirme-actions.ts   QR oluştur (gizi çereze yazar) + eşleşmeyi onayla
  middleware.ts           oturumsuz istekleri /giris'e (nereye gitmek istediğini
                          `?devam=` ile taşıyarak), kilitli cihazı sınıf
                          sayfasına yönlendirir; /api/* muaf (bkz. kod içi not)
```

### Değişmez kurallar
- **Geçmiş silinmez.** Her davranış bir olay kaydıdır. Geri alma bile
  yalnızca süren dersteki son kaydı hedefler; bitmiş dersin kaydı kalıcıdır.
- **Sahiplik sorgunun parçasıdır.** Id alan her sorgu ve action
  `teacherId` şartı taşır; başkasının kaydı 404 döner. Bu unutulursa veri
  ayrımı sessizce delinir.
- **Düğme gizlemek yetki kontrolü değildir.** Hangi eylemin geçerli olduğu
  sunucuda öğretmenin şablonundan okunur.
- **Silme yalnızca iz bırakmıyorsa mümkündür, aksi hâlde arşiv.** Ödev,
  sınıf, öğrenci — hepsi aynı desen: hiçbir geçmiş kaydı yoksa kalıcı silme,
  varsa `isActive=false` ile arşivleme. Kural sunucuda kontrol edilir;
  arayüzdeki gizleme yalnızca kullanıcıyı boşuna tıklatmamak içindir.
  Veritabanının RESTRICT kısıtları son savunma hattıdır.
- **Toplu hesap sıfırlama bu ilkenin bilinçli istisnasıdır.** Öğretmenin
  kendi isteğiyle, parola + yazılı onay ("SIFIRLA") vererek tetiklediği
  tam sıfırlama — kazayla basılan bir tuşun sonucu değil.

### Ders ekranı
Ders sırasında kullanılan cihaz telefon ya da akıllı tahtadır. Düzen tek
ama üç boyuta ölçeklenir (`globals.css`): telefonda başlık tek satır,
tahtada (≥1280px) sütun genişler, yazı ve düğmeler büyür, sınıf iki sütuna
dikey akar. Dokunma hedefi en az 44px.

Performans puanı ders ekranında **gösterilmez**; öğrenci sayfasında görülür.
Ders sırasında karar kartlardan ve sayılardan verilir.

Öğrencinin sahip olduğu kart satırın kendisidir (renkli şerit + zemin);
düğmeler ayrı durur. İkisi birbirine benzerse liste bir bakışta okunmaz.

### Akıllı tahta kilidi
Öğretmen Ayarlar'dan bir PIN belirler (`Teacher.boardPin`, bcrypt hash).
Sınıf sayfasından "Bu cihazı kilitle" ile o **cihaz** (imzalı çerez,
`lock-token.ts`, jose — edge-safe, middleware'de çalışır) kilitlenir; kilit
cihaza aittir, sınıfa değil, telefon etkilenmez. Kilitliyken:
- middleware her yolu sınıf sayfasına yönlendirir (`kilitDurumu`),
- davranış düğmeleri PIN pad açar, sunucu tarafında da `yazmaKilitli()`
  kontrolü vardır — düğme gizlemek tek başına yeterli değil,
- 5 yanlış PIN → 60 saniye bekleme,
- `boardUnlockMinutes` süresi dolunca kilit kendiliğinden geri döner.

`/api/*` rotaları middleware'in kilit/oturum kontrolünden **muaftır** —
sayfa yönlendirmesi bir `fetch` isteğine HTML döndürseydi çağıran onu JSON
sanıp patlardı. Her API rotası kendi auth kontrolünü yapar.

### Canlı tahta yansıması
Telefondan verilen bir kart, tahtada 2 saniyede bir yoklama (`board-events.ts`
+ `/api/sinif/[sinifId]/canli`) ile görünür ve 8-bit bir ses çalar
(`board-sound.ts`, WebAudio). Websocket/Supabase Realtime kullanılmaz:
tarayıcıdan doğrudan veritabanına erişim sahiplik kontrolünü atlardı.

Etkinlik üç şeyden birine bağlıdır: ekran 1280px eşiğini geçmişse, öğretmen
elle "Tahta modu" açmışsa, ya da **cihaz kilitliyse** (kilitli cihaz tanım
gereği tahtadır — genişlik tahmini yanılabilir, kilit her zaman kazanır).

**Uç nokta derse değil SINIFA bağlıdır** ve aktif dersi her yoklamada sunucu
tarafında kendisi bulur; ders id'si istekte değil YANITTA gelir. Bunun
sebebi 18 Eylül'de yakalanan bir kilitlenme:

Canlı katman eskiden ders id'si yoksa yoklamayı hiç başlatmıyordu. Tahta
ders BAŞLAMADAN açılıp kilitlendiğinde (gerçek kullanım sırası tam bu:
tahtayı kur, kilitle, derse sonra başla) elinde ders id'si olmuyordu. Yeni
dersi ancak sayfa tazelenince öğrenebilirdi, tazeleme ise yalnızca yoklama
olay getirince yapılıyordu — yani tazelenmek için olay bekliyor, olay almak
için tazelenmesi gerekiyordu. Sonuç: ders boyunca hiçbir bildirim gelmiyor,
ekran "Aktif ders yok"ta kalıyordu.

Aynı kök nedenin ikinci sonucu: ders bitip yenisi başlayınca tahta eski ders
id'sini yoklamaya devam ediyor, yeni dersten haber alamıyordu.

Mevcut test bunu kaçırmıştı çünkü dersi başlatıp SONRA kilitliyordu. Sıra
tersine çevrilince hata hemen çıktı. Ders yokken açılan tahta ve ders
değişimi artık `board-ui-test.mjs`'in K ve L bölümlerinde sınanıyor.

Yan etki (bilinçli): geniş bir ekranda açık duran eskimiş ikinci sekme artık
kendini düzeltir. `lesson-ui-test`'teki "eskimiş form" senaryosu bu yüzden
dar ekrana alındı.

#### Üç gösterim kanalı
Aynı olay, tahtanın o anki durumuna göre farklı yerde görünür. Üçünü de
`SinifCanliBildirimleri` yönetir:

| durum | ne görünür |
|---|---|
| sekme önde | sayfa içi kutu (`.canli-bildirim`) + ses |
| sekme arka planda | işletim sistemi bildirimi (`board-notification.ts`) + ses |
| tahta penceresi açık | pencerenin kendisi (`board-pip.ts`) + ses |

**Arka planda yoklama neden durmuyor (23 Eylül):** `yokla` içinde
`document.visibilityState !== "visible"` ise dönen bir kontrol vardı; gerekçe
pil ve ağ tasarrufuydu. Ama bu döngü zaten YALNIZCA tahta modunda çalışıyor
ve tahta prize takılı. Öğretmen tahtada başka bir uygulamaya geçtiği anda —
yani tam kartın görünmesi gereken anda — bildirimlerin tamamı kesiliyordu.
Kontrol kaldırıldı. `board-ui-test`'in G bölümü eskiden bunun TERSİNİ
doğruluyordu; çevrildi.

Chrome, 5 dakikadan uzun süre gizli kalan sekmede `setInterval`i dakikada
bire indirir. Muafiyet listesi dar; **son 30 saniyede ses çalmış sekme muaf
tutulur**, bu yüzden sesin arka planda da çalması ayrıca işe yarar.

**Arka plan olayları kuyruğa girmez.** Girseydi iki sorun çıkardı: kutuyu
sıraya sokan `setTimeout` gizli sekmede kısıtlanır, ve öğretmen sekmeye
döndüğünde ders boyunca birikmiş bildirimler arka arkaya patlardı.

#### Süre ve boyut olay türüne göre
Kart, yıldızla aynı sürede kaybolmamalı: yıldız rutindir, kart SINIFIN
GÖRMESİ için verilir. Öğretmenin "kızmak yerine kart işlettiği" an budur.
Kurallar `board-rules.ts`te, tek yerde:

```
yıldız/artı  2.5 sn   küçük     (sık verilir, yol tıkamasın)
eksi         4   sn   büyük
sarı kart    6   sn   büyük
kırmızı kart 7.5 sn   büyük     (en ağır sonuç, teneffüs cezası buna bağlı)
```

Bu sayılar **25 Eylül'de gerçek tahtada kısaltıldı** (eksi 5→4, sarı 8→6,
kırmızı 10→7.5): kartlar ders materyalini fazla bölüyordu. Öğretmenin isteği
"çok kısaltma ama biraz kısalt" — sıralama ve oran korundu, hepsi aşağı
çekildi. Kural testinde ALT SINIR da var (kırmızı ≥ 6 sn, sarı ≥ 5 sn): daha
da kısalırsa sesi duyup başını kaldıran öğrenci boş ekran görür, kartın bütün
anlamı buydu.

**Sıra baskısı:** sırada iki ya da daha fazla olay beklerken süre en kısaya
düşer. Yoksa üst üste üç kart veren öğretmenin sonuncusu yarım dakika sonra
görünürdü. Bu kural tarayıcıda güvenilir sınanamaz (üç kartın aynı yoklamaya
düşmesi garanti değil), bu yüzden `board-rules-test`te saf olarak sınanır.

**Chrome tuzağı:** `requireInteraction` verilmemiş bir bildirimi Chrome ~8
saniye sonra kendiliğinden bildirim merkezine indirir. Bu eşikten uzun
gösterilecek türlerde bayrak açılır; kapatma kararı yine bizde kalır.

Süreler kısaldıktan sonra **hiçbir tür bu eşiği aşmıyor**, yani bayrak şu an
hiç açılmıyor — ve bu doğru durum: sayfa içi kutu ile işletim sistemi
bildirimi artık tam aynı süre boyunca duruyor. Kural silinmedi; biri süreyi
8 saniyenin üstüne çıkarırsa kendiliğinden devreye girer. `board-rules-test`
her tür için ayrı ayrı "eşiği aşmıyor" ve "sabitleme gerekmiyor" diye
sınıyor, ve eşiğin 1 ms üstünün sabitlendiğini de.

Kutu sayfanın sağ altındaydı (düğmelerin arasında, tahtanın en az bakılan
yeri); artık düğme yığınından ayrı, **ekranın üstünde ve ortalanmış**.
`pointer-events: none` şart: saniyelerce duran bir katman altındaki listeye
tıklamayı yutmamalı.

#### Tahta penceresi (Document Picture-in-Picture)
24 Eylül'de gerçek tahtada denendi: yalnızca Windows bildirimi geldi ve
küçüktü. İşletim sistemi bildiriminin GÖRÜNÜMÜNÜ belirleyemiyoruz — boyutu,
yeri, yazı tipi Windows'a ait. Çözüm masaüstü uygulaması değil, Chrome'un
Document PiP penceresi: her zaman üstte durur, içeriği tamamen bizimdir,
kurulum gerektirmez.

Öğretmen ders başında "📺 Tahta penceresini aç" der (kullanıcı dokunuşu şart,
kendiliğinden açılamaz). Pencere olay yokken sınıf adı ve ders bilgisini
gösterir; olay gelince öğrencinin adı büyük puntoyla ve **tam ekran renkle**
çıkar, süresi dolunca sakin haline döner.

Üç karar ve nedenleri:
- **Simge yok.** `OLAY_GORUNUMU`daki 🟥 ve 🟨 emojileri kendi renklerinde
  geliyor; kırmızı zeminde kırmızı kart görünmez oluyordu (ekran
  görüntüsünde yakalandı). Rengi zaten zemin taşıyor, ve pencere alçak —
  simgeyi çıkarmak ada ve etikete daha çok punto bıraktı.
- **Renk tek başına anlam taşımaz:** etiket ("kırmızı kart aldı") her zaman
  yazılı. Yeşil `#16a34a`, `#15803d` değil: koyu yeşil kırmızıyla neredeyse
  aynı parlaklıkta (1.04:1) ve gri tonda ayırt edilemiyordu. Kural testi her
  rengin kontrastını WCAG formülüyle ölçer, göz kararıyla değil.
- **Pencere açıkken işletim sistemi bildirimi gönderilmez.** İkisi de arka
  plan kanalı; ikisi birden çıkarsa aynı olay iki kez duyurulur.

**Yoklama zamanlayıcısı pencereden kurulur.** Pencere ayrı bir dokümandır ve
`visibilityState` hep `"visible"`; Chrome'un "5 dakikadır gizli sekmede
dakikada bir uyandır" kısıtlaması ona işlemez. Pencere yoksa eskisi gibi
sayfanın kendi zamanlayıcısı.

Tahta modu kapatılırsa pencere de kapanır: yoklama durduğu için açık kalsa
donmuş bir ekran gösterirdi.

**Pencere boyutu ve konumu.** Pencere açıkken üç hazır ölçü düğmesi çıkar
(Küçük 420×180, Orta 560×240, Büyük 760×320); seçim cihazda kalır.
Kenarından sürükleyerek de boyutlandırılabiliyor ama akıllı tahtada parmakla
kenar yakalamak zor, düğme tek dokunuş.

**Sabitleme ayrı bir iş değil:** Chrome, PiP penceresinin boyutunu VE
konumunu kendisi hatırlıyor. Öğretmen bir kez yerleştirip boyutlandırınca
sonraki derslerde orada açılıyor. Bu yüzden `preferInitialWindowPlacement`
BİLEREK verilmiyor — verilseydi her açılışta varsayılan konuma dönerdi ve
konumu site zaten belirleyemiyor, tek yolu bu hafıza.

`resizeTo` PiP penceresinde çalışır ama **kullanıcı dokunuşu ister**; düğmeye
basmak zaten o. Gerçek boyutlanma bu ortamda doğrulanamıyor: headless'ta
pencere yöneticisi yok, pencere hep açan sayfanın ölçüsünü bildiriyor. Test
ölçünün UYGULANDIĞINI değil DOĞRU ÇAĞRILDIĞINI sınar.

Sınırlar: yalnızca Chrome/Edge masaüstü (Firefox ve Safari'de düğme hiç
görünmez), ve sayfa gerçekten başka bir adrese giderse pencere kapanır —
`router.refresh()` gezinme sayılmaz, pencere ayakta kalır.

**Gerçek tahtada doğrulandı (25 Eylül).** Pencere çalışıyor ve öğretmenin
kendi HTML sunumunun üstünde küçük bir alana yerleştirilebiliyor; sunumun az
bir kısmını kapatıyor, öğretmen bunu kabul edilebilir buldu. Sunuma gömülü
bir entegrasyon (aşağıya bak) bu yüzden gereksiz kaldı.

### Ders kuralı
Bir sınıfın bitmemiş dersi (`Lesson.endedAt` boş) aktif derstir. Sınıfın aynı
anda tek dersi olur; süren ders bitmeden yenisi başlatılamaz ve bitmiş derse
kayıt yazılamaz.

Bu kural **iki katmanlı**. `lesson.ts` içindeki kontrol olağan durumu
karşılar ve anlaşılır mesaj verir. Asıl garanti veritabanındaki kısmi unique
index'tir (`Lesson_tek_acik_ders`, yalnızca `endedAt IS NULL` satırlarını
kapsar). Sebep: kontrol ile yazma arasında atomiklik yoktu, telefon ve akıllı
tahtadan aynı anda "Yeni ders başlat" basılınca iki ders açılıyordu — bu
üretimde gerçekten oldu. `dersBaslat` artık P2002'yi yakalayıp aynı mesaja
çevirir. Bitmiş dersler kısıt dışıdır; aynı sınıfa aynı gün birden fazla ders
işlenebilir.

### Davranış kaydını geri alma
Yalnızca **süren dersteki en son kayıt** geri alınabilir (`sonKaydiGeriAl`).
Bitmiş dersin kaydına dokunulmaz — "geçmişi silmek" değil "henüz o anın
kendisi olan bir yanlışı düzeltmek". Kırmızı kart tek satır değildir:
yanındaki MINUS ve teneffüs cezası (`kirmiziKartCezasiGeriAl`) aynı anda,
kart HENÜZ SİLİNMEDEN geri alınır — sayaç mantığı ekleyen tarafla birebir
aynı olsun diye. Basit şablonda not elle girildiği için geri alma ona
dokunmaz.

### Sınıf/öğrenci arşivleme ve silme
`Classroom.isActive` / `Student.isActive` şemada en baştan vardı, listeleme
sorguları zaten bunu filtreliyordu; eksik olan yalnızca action ve düğmeydi.

- **Arşivle/arşivden çıkar** her zaman mümkün, geri alınabilir, kayıtlara
  dokunmaz. Arşivlenen öğe kendi listesinden kalkar ama üst sayfada
  katlanır bir "Arşivlenmiş ..." bölümünde durur — geri açma yolu orada.
- **Kalıcı silme** yalnızca hiçbir iz bırakmıyorsa mümkün: sınıf için hiç
  öğrenci ve hiç ders; öğrenci için hiç davranış/ceza/ödev/sınav/veli mesajı
  kaydı. Aksi hâlde arayüzde "Sil" düğmesi hiç görünmez, sunucu da yine
  reddeder (bkz. ödev modülündeki `odevSil` ile aynı desen).

### Hesap sıfırlama
Ayarlar'da "Tehlike bölgesi": hesap parolası + yazılı "SIFIRLA" onayı ister.
`account-reset.ts` tek bir transaction içinde, RESTRICT ilişkilerin izin
verdiği sırayla (ExamResultComponent → ExamResult → ExamComponent → Exam →
Submission → Assignment → ParentMessage → BehaviorLog → BreakPenalty →
Lesson → Student → Classroom) öğretmenin tüm verisini siler. `Teacher`
satırının kendisi (giriş bilgisi, PIN, şablon tercihi) dokunulmadan kalır.

### Sınıf hedefleri
Roadmap'teki "Ekstra — Gamification" bölümünün ilk ve en basit parçası.
`behaviorTemplate` gibi öğretmen bazlı açılıp kapanan ayrı bir modül
(`Teacher.gamificationEnabled`, varsayılan kapalı); kapalıyken sınıf
sayfasında hiçbir iz bırakmaz, hiç sorgulanmaz.

- **İlerleme ayrıca tutulmaz.** Gerçek kaynak `BehaviorLog`'daki PLUS
  kayıtlarıdır (basit şablonda artı, kart şablonunda yıldız — ikisi de aynı
  tip); `ClassGoal` yalnızca bir pencerenin başlangıcını (`createdAt`) ve
  kapanışını (`closedAt`) işaretler, sayım her istek anında canlı hesaplanır.
- **Bir sınıfın aynı anda en fazla bir açık hedefi olur** — `Lesson`'daki
  "tek açık ders" kuralıyla aynı mantık, ama burada veritabanı seviyesinde
  bir kısıt yok, kontrol yalnızca action'da (`sinifHedefiOlustur`).
- **Hedefe ulaşmak otomatik kapatmaz.** Öğretmen ödülü verdiğinde elle
  "Hedefi kapat" der; o ana kadar tamamlanmış hedef sayfada "Hedefe
  ulaşıldı!" rozetiyle açık durur, öğretmen istediği kadar bekleyebilir.
- **Kapanan hedefler silinmez.** Sınıf sayfasında katlanır bir "Geçmiş
  hedefler" listesinde kalır — tamamlanan ve erken kapatılan hedefler
  ayrı ayrı işaretlenir (`· tamamlandı` / `· kapatıldı`).
- Açık hedef varken sınıf sayfasında katlanmadan, doğrudan görünür (ders
  sırasında motive edici olsun diye); hedef yokken oluşturma formu diğer
  yönetim bölümleri gibi katlanır durur.

### EXP ve seviye
Gamification'ın ikinci parçası, sınıf hedefleriyle aynı anahtarla
(`Teacher.gamificationEnabled`) açılıp kapanır. **Performans notundan
tamamen bağımsızdır** — kırmızı kart notu düşürür ama EXP'yi hiç etkilemez,
EXP yalnızca artar.

- **Kaynak `ExpEvent`, append-only bir olay günlüğü** (`BehaviorLog` ile
  aynı felsefe, ama kendi tablosu): her satır bir kaynağı (`YILDIZ`,
  `ODEV_TAMAMLANDI`) ve miktarı taşır. Yeni bir kaynak eklemek yalnızca
  enum'a yeni bir değer eklemek demektir; toplama sorgusu (`SUM(amount)`)
  hiç değişmez. `Student.expTotal` bu toplamın cache'i.
- **Kazanma:** yıldız/artı +10 (şablon farketmez, ikisi de PLUS tipi),
  ödev zamanında tamamlama (DONE) +20, geç tamamlama (LATE) +10. Geriye
  dönük EXP verilmez — sistem açıldığı andan itibaren sayılır.
  Sınav tamamlama şimdilik EXP vermiyor.
- **Aynı olaydan iki kez EXP yazılmaz.** `(source, referenceId)` essiz
  kısıtı bunu garanti eder: bir ödev PENDING'e çekilip yeniden DONE
  yapılsa bile ikinci kez EXP eklenmez (`createMany({ skipDuplicates: true })`).
- **Geri alma EXP'yi de geri alır.** Yıldız, davranış kaydıyla (`sonKaydiGeriAl`)
  aynı transaction'da, SÜREN derste geri alınabildiği sürece; kırmızı kart
  cezası gibi aynı desen.
- **Seviye formülü artan eşikli**, `exp-rules.ts`'te `seviyeHesapla`: L.
  seviyeye ulaşmak için toplam gereken EXP = `10 × L × (L-1)` (her seviye
  bir öncekinden 20 fazla EXP ister). Seviye 1'de herkes 0 EXP ile başlar.
- **Görünürlük:** ders ekranında öğrenci satırında "Sv.N" rozeti (salt
  gösterim, kilitli tahtada da görünür — kart/ceza rozeti gibi); öğrenci
  sayfasında performans notunun altında EXP çubuğu + seviye.

### Ödev kuralı
**Ödev bir sınıfa değil öğretmene aittir** (`Assignment.teacherId`). Kime
verildiği `Submission` satırlarında yazılıdır; sınıf üyeliği oradan türetilir,
ayrıca tutulmaz. Böylece aynı ödev birden fazla sınıfa ve tek tek seçilen
öğrencilere verilebilir, "asıl sınıf hangisi" sorusu hiç doğmaz.

- Ödev oluşturulduğunda o anki aktif öğrencilere `PENDING` kaydı açılır.
  Sonradan sınıfa katılan öğrenci geçmiş ödevlere **eklenmez**.
- Son teslim tarihi geçince durum **kendiliğinden değişmez**; ekran yalnızca
  "süresi geçti" diye işaretler, kararı öğretmen verir.
- Tamamı işaretlenmiş ödev tarihi geçse de gündemde değildir.
- Silme yalnızca hiçbir öğrenci işaretlenmemişken mümkün; aksi hâlde arşiv.
- Düzenlemede seçimden çıkarılan öğrencinin kaydı silinir — form kaç işaretli
  kaydın kaybolacağını önceden yazar.
- `Submission.note` şemada var, arayüzde **kullanılmıyor** (bilinçli).

### Sınav kuralı
**Sınav da bir sınıfa değil öğretmene aittir** (`Exam.teacherId`), ödevle
aynı gerekçe. Kime verildiği `ExamResult` satırlarında yazılıdır.

Bir sınav **bileşenlerden** oluşur. MEB sınavı üç bileşendir (Yazılı %50,
Listening %25, Speaking %25); tek puanlı sınav tek bileşendir; tarama
sınavında bileşen doğru/yanlış sayısından hesaplanır. Dört sınav türü için
dört ayrı model yazmak yerine tek mekanizma hepsini karşılar, ve "sınıfın
Listening ortalaması" sorulabilir hâle gelir.

- **Ağırlıklı hesap ham puanı değil YÜZDEYİ kullanır.** Bileşenlerin tam
  puanları farklı olabilir ve sınavın kendisi de 100 üzerinden olmayabilir
  (Oxford sınavları çoğunlukla değil). 20 üzerinden bir Speaking, 100
  üzerinden bir Yazılı ile başka türlü toplanamaz.
- **Bir bileşen bile eksikse puan hesaplanmaz.** Yazılı bugün, Speaking
  gelecek hafta girilir; eksiği sıfır saymak arada yanıltıcı bir düşük not
  gösterirdi. Öğrenci gerçekten girmediyse öğretmen sıfırı kendisi yazar.
- **"Girmedi" boş nottan farklıdır.** Boş "henüz girilmedi", girmedi
  "girmeyecek" demektir. İşaretli öğrenci sayılır ama ortalamaya katılmaz.
- **Resmî / deneme ayrımı** (`Exam.scope`): deneme sınavları karne
  ortalamasına karışmaz. Varsayılan deneme.
- **Dönem sınavın tarihinden türetilir**, ayrı tablo yoktur. 1. dönem
  Eylül'de, 2. dönem Şubat'ta başlar; sınırlar `exam-rules` içinde sabit.
- Kurum adları (Oxford, Cambridge) bilerek **şablon değildir**; kişiye özel
  kurallar koda gömülmez. Oxford sınavı "Tek puan" şablonuyla, kendi tam
  puanı yazılarak açılır.

### Veli iletişimi
Mesaj uygulama içinde taslak olarak hazırlanır, gönderim WhatsApp'a
(`wa.me` bağlantısı, gerçek bir `<a target="_blank">`) devredilir — ayrı
bir SMS/WhatsApp API ücreti yok. Telefon numarası isteğe bağlıdır; girilince
KVKK amaçlı bir rıza onayı ister (`Student.parentConsentAt`) — bu onay
KVKK uyumluluğunun garantisi değil, yalnızca öğretmenin beyanının zaman
damgalı izidir.

Hazır şablonlar (`mesajSablonlari`) öğrencinin gerçek verisiyle önceden
doldurulur, göndermeden önce her zaman düzenlenebilir:
- **Davranış özeti** — sayısal döküm (yıldız/kart ya da artı/eksi).
- **Ödev durumu / Son sınav** — yalnızca ilgili veri varsa önerilir.
- **Kart uygulaması (sarı → kırmızı)** — öğretmenin kendi yazdığı, tek bir
  ders içinde sarı-üstüne-kırmızı olayını anlatan sabit metin; yalnızca
  kart sisteminde ve öğrencinin en az bir kırmızı kartı varsa görünür.
  Metne dokunulmaz, yalnızca sonundaki öğrenci adı değişir.
- **Tekrarlayan davranış** — aynı öğrencide ikinci (ya da daha fazla)
  kırmızı kart varsa; daha ciddi ama yine cezalandırıcı olmayan bir ton.
- **Genel bilgilendirme** — davranış/performanstan bağımsız, köşeli
  parantezli bir yer tutucuyla serbestçe doldurulacak nötr bir not.
  "Davranış özeti" ile karıştırılmasın diye bilerek rakamsız tutuldu.
- **Serbest** — boş, sıfırdan yazmak için.

### Günlük gündem
Ana sayfadaki panel ve üst menüdeki sayaç. Bir ödev üç şart birden
sağlıyorsa gündemdedir: arşivlenmemiş + teslim günü gelmiş ya da geçmiş +
hâlâ işaretlenmemiş öğrenci var. Tarihsiz ödev hiç düşmez. Yapacak iş yoksa
panel **hiç render edilmez** — her gün duran boş kutu bir süre sonra
okunmaz olur.

### Genel panel (v0.6)
`/panel`, üst menünün ilk sekmesi. Ana sayfa bilerek yerinde bırakıldı:
derse girerken en hızlı ulaşılması gereken şey sınıf listesidir.

Dört blok, hepsi **son 30 günlük kayan pencere**: bekleyen işler → dikkat
gereken öğrenciler → sınıf karşılaştırması → 30 günün özeti. Yapılacak
işten genel resme doğru.

**Yeni veri modeli yok.** Her sayı mevcut kayıtlardan hesaplanır; migration
gerekmedi. Mevcut indeksler (`BehaviorLog @@index([teacherId])`,
`@@index([classroomId, createdAt])`) bu sorgulara yetiyor.

"Dikkat gereken öğrenci" üç kriterden herhangi biriyle listeye girer ve
sebep rozeti sayıyı da söyler ("2 ödev", "%30", "1 kırmızı"):
- **davranış** — pencerede kırmızı kart almış ya da eksi > artı
- **ödev** — süresi geçmiş, hâlâ tamamlanmamış 2+ teslimi var
- **sınav** — penceredeki resmî sınav ortalaması %50 altı

İki karar:

- Kriterler `Student.performanceScore` üzerinden DEĞİL, doğrudan
  `BehaviorLog`'dan hesaplanır. Basit şablonda notu öğretmen elle girer,
  kayıtlarla ilgisi yoktur; nota bakan bir kriter orada sessizce yanlış
  çalışırdı. Kayıttan saymak iki şablonda da doğrudur.
- **Gecikmiş ödev sayımı 30 günlük pencereye bakmaz.** Teslim edilmemiş bir
  ödev 30 gün geçince önemsizleşmez; panelin diğer sayıları penceredir, bu
  biriken iştir.

Şablon farkı arayüze de yansır: Basit şablonda kart sütunu ve kart ölçümleri
hiç gösterilmez ("Yıldız" yerine "Artı"), ortalama performans notu sütunu da
yoktur — o şablonda sınıf ortalaması olarak anlam taşımaz.

### QR ile akıllı tahta girişi
Tahtada `/giris` → "QR ile gir" → QR + 4 haneli kod. Öğretmen telefonundan
okutur, koddan doğrular, onaylar; tahta kendiliğinden girer. Parola sınıfın
önünde hiç görünmez.

**Tehdit modeli: QR'ı sınıfın tamamı görür ve fotoğraflayabilir.** Tasarımın
özü bunun etrafında:

- QR yalnızca eşleşmenin herkese açık `id`'sini taşır, tek başına işe yaramaz.
- Eşleşme açılırken TAHTANIN tarayıcısına ayrı bir giz httpOnly çerez olarak
  yazılır; veritabanında yalnızca SHA-256 özeti durur. **Oturumu ancak o
  çerezi geri getirebilen tarayıcı alabilir** — fotoğrafı çeken cihaz,
  öğretmen onaylasa bile alamaz.
- Onay için oturum şarttır; girişi olmayan cihaz onay ekranını açabilir ama
  onaylayamaz.
- Tahtada ve telefonda aynı 4 haneli kod görünür: öğretmenin, öğrencinin
  kendi ekranındaki bir QR'ı yanlışlıkla onaylamasını engeller.
- Tek kullanımlık ve 5 dakika geçerli. Tüketme koşullu yazmayla yapılır.
- Başarısız bir alma denemesi eşleşmeyi TÜKETMEZ; tahtanın hakkı durur.

Eşleşmenin durumu ayrı bir kolonda tutulmaz, üç zaman damgasından türetilir
(`expiresAt` / `approvedAt` / `consumedAt`) — kart durumunun ders
kayıtlarından hesaplanmasıyla aynı prensip. Tutarlılığı veritabanı kısıtları
korur: onaysız kayıt kullanılmış olamaz, onaylanmış kaydın öğretmeni olmak
zorundadır.

QR sayfada değil EYLEMDE üretilir: giz tahtanın çerezine yazılmalı, sunucu
bileşenleri ise çerez yazamaz. Sayfa yalnızca çerezdeki eşleşmeyi gösterir.

**Giriş sonrası dönüş (`?devam=`)** bu iş sırasında eklendi. QR'ı okutan
telefonun oturumu kapalıysa giriş sayfasına düşüp orada kalıyordu; artık
onay ekranına döner. Açık yönlendirme koruması ayrı ve saf bir modülde
(`devam-yolu.ts`): `devam` adres çubuğundan gelen, saldırganın yazabildiği
bir değerdir, site dışına çıkan her şey ana sayfaya düşürülür.

Bağımlılık: `qrcode-svg` (bağımlılığı yok, sunucuda çalışır, istemci
paketine girmez). QR'ı elde kodlamak Reed-Solomon demekti.

### Gelişim görünümü
Öğrenci sayfasındaki "Gelişim" bloğu **son iki dönemi** karşılaştırır ve üç
ölçüde sayı + yön oku verir: karne ortalaması, davranış, ödev tamamlama.
Dönem ayrı bir tabloda durmaz, `donemBul` ile tarihten türetilir — sınav
için zaten böyleydi, davranış ve ödev de aynı saf fonksiyona verilir.

Dört karar, her biri bir tuzağı kapatıyor:

- **Karşılaştırılan iki dönem bugünün tarihinden seçilmez**, veride kayıt
  bulunan son iki dönemden. Dönem ortasında bugüne bakmak, henüz verisi
  olmayan bir dönemi "düştü" gibi gösterirdi. Tek dönem varsa ok
  UYDURULMAZ, "en az iki dönem gerekir" yazar.
- **Davranış ders başına normalleştirilir.** 12 artı, 30 derslik bir dönemde
  ile 10 derslik bir dönemde aynı şey değil; ham sayı karşılaştırması
  sessizce yanlış olurdu. Test bunu özellikle sınıyor: ham sayı 10'dan 12'ye
  ÇIKARKEN ders sayısı 10'dan 20'ye çıktığı için yoğunluk düşer, ok aşağı
  bakar.
- **Yön sayının yönü, RENK iyileşmedir.** Eksi/kart azalınca ok aşağı bakar
  ama satır yeşildir; ikisi aynı şeye bağlansaydı "eksi azaldı" kırmızı
  görünürdü. Her ölçünün `iyiYon`'u kurallar dosyasında.
- **Kart şablonunda olumsuz sayı MINUS'tan gelmez.** Orada eksi düğmesi
  yoktur, her kırmızı kart yanında otomatik bir MINUS yazar, yani
  `MINUS - RED_CARD` her zaman sıfır çıkar ve ölçü sürekli boş görünürdü.
  Anlamlı sayı verilen kartlardır (sarı + kırmızı).

Eşikler: yüzdelerde 2 puan, ders başında 0.1; altındaki fark "aynı" sayılır,
yoksa %61'den %62'ye çıkış "gelişme" diye görünür ve ok anlamını yitirir.
Eşik karşılaştırmasında **kayan nokta payı** var: `0.6 - 0.5` ikili tabanda
tam 0.1 etmez (0.09999999999999998), pay olmadan TAM eşikteki değişim
sessizce "aynı" sayılıyordu — testte yakalandı.

Grafik bilerek yok: iki nokta arasına çizilen bir çizgi zaten grafik değil.

**Sınıf gelişimi** aynı bileşen ve aynı kurallarla çalışır; tek fark birim.
Davranış sayıları ders sayısının yanında **öğrenci sayısına da** bölünür:
25 kişilik bir sınıf doğal olarak 10 kişilikten çok yıldız toplar ve mevcut
dönemden döneme değişebilir. Öğrenci başına indirgeyince sayı öğrenci
gelişimindekiyle aynı birime gelir — bir öğrencinin 0.6'sı sınıfın 0.4'üyle
doğrudan karşılaştırılabilir.

Bilinen yaklaşıklık: mevcut sayısı BUGÜNÜN aktif öğrenci sayısıdır, dönem
dönem sınıf mevcudu tutulmuyor. İki dönem için de aynı bölen kullanıldığından
okun YÖNÜ bundan etkilenmez, yalnızca sayının büyüklüğü yaklaşıktır.

Sınıf gelişimi hem sınıf sayfasında (öğrenci listesinin altında) hem sınıf
raporunda görünür; kilitli tahtada hiç sorgulanmaz ve çıkmaz — yönetim
bilgisidir.

### Öğrenci raporu
`/ogrenci/[id]/rapor` — veli toplantısında masaya konacak ya da veliye
verilecek tek belge. Dört bölüm (davranış, sınavlar, ödevler, gelişim),
dönem açılır listeden seçilir ve seçim adreste taşınır (`?donem=2025-1`).

**Ayrı bir PDF üretici YOK.** Sayfa yazdırmaya hazır kurulur; "Yazdır / PDF"
düğmesi tarayıcının kendi yazdırma penceresini açar, oradan kağıda ya da
"PDF olarak kaydet"e gidilir. Tablette de çalışır. Puppeteer benzeri ağır
bir bağımlılık ve Vercel'de boyut/süre sınırı riski alınmadı.

Düğme sonradan eklendi ve gerekliydi: sayfanın yazdırılabilir olması
yetmiyor, tarayıcıların yazdır seçeneği menülerin içinde gömülü (Paylaş →
Yazdır) ve öğretmen onu arıyordu. **Yazdırılabilir bir sayfa yaparken ona
ulaşan düğmeyi de koy.**

Ekranda işe yarayıp kağıtta anlamsız olan her şey `yazdirma-gizle` sınıfını
taşır; kuralı `globals.css`'teki `@media print` bloğu uygular (menü, araç
çubuğu, dönem seçici, yazdır düğmesi, kart çerçeveleri).

Üç ayrıntı:

- **Varsayılan dönem bugünden değil, verisi olan en yeni dönemden** seçilir.
- **Rapordaki gelişim SEÇİLEN dönemi anlatır**, "son iki dönemi" değil:
  `ogrenciGelisimi` bunun için isteğe bağlı hedef dönem alır. Parametresiz
  çağrıldığında eski davranışı sürer.
- **Tarihsiz ödev hiçbir döneme düşmez**; hangi döneme ait olduğu bilinmiyor,
  rapora katmak onu keyfî bir döneme yazmak olurdu.

Gelişim bloğu öğrenci sayfasındakiyle aynı bileşendir; rapor ayrı bir
"gelişim" tanımı üretmez.

### Sınıf raporu
`/sinif/[id]/rapor` — aynı altyapı (dönem seçici, yazdırma, `@media print`),
öğrenci başına bir satır: yıldız/artı, kart/eksi, performans notu, karne
ortalaması, ödev oranı. Üstünde sınıf geneli özeti, altında sınıf gelişimi.

Üç karar:

- **Sıralama ALFABETİK, başarıya göre değil.** Sınıf sayfalarındaki "en düşük
  üstte" mantığı ekranda öğretmene "kime bakmalı" der; kâğıda dökülüp
  paylaşılan bir belgede aynı sıra bir başarı sıralamasına dönüşür.
- **"Dikkat gereken öğrenciler" listesi rapora girmez.** Rapor bir döküm, bir
  değerlendirme değil; o etiket kâğıda dökülüp başkasının eline geçince
  öğrenciyi damgalar. Sayılar zaten tabloda, liste panelde duruyor.
- **Sınıf ödev oranı öğrenci oranlarının ortalaması DEĞİL, bütün teslimlerin
  oranı.** Tek ödevi olup onu yapan bir öğrenci sınıf oranını olduğundan iyi
  göstermesin. Testte iki hesap birbirinden ayırt ediliyor (doğrusu %80,
  yanlışı %88) ve yanlış sonucun ekranda OLMADIĞI da kontrol ediliyor.

Karne ortalaması hem raporda hem sınıf gelişiminde aynı formülle hesaplanır
(önce öğrenci ortalaması, sonra öğrenciler arası) — aynı uygulamada iki farklı
"sınıf karne ortalaması" olmasın.

---

## Testler

Yirmi sekiz arayüz testi (gerçek tarayıcıda, Playwright) ve sekiz saf hesap
testi, toplam **1157 kontrol**. Hepsi geçiyor.

```
scripts/e2e-test.mjs                       sınıf/öğrenci ekleme, kalıcılık      35
scripts/template-ui-test.mjs               şablonlar, elle not                  25
scripts/behavior-ui-test.mjs               kart kuralları                       24
scripts/history-ui-test.mjs                öğrenci geçmişi                      16
scripts/auth-ui-test.mjs                   giriş ve veri ayrımı, `devam` dönüşü  28
scripts/card-buttons-ui-test.mjs           kart şablonunun düğmeleri            24
scripts/penalty-ui-test.mjs                teneffüs cezası ve kronometre        22
scripts/lesson-ui-test.mjs                 ders başlat/bitir, geçmiş, kısıt     39
scripts/optimistic-ui-test.mjs             iyimser güncelleme                   13
scripts/layout-ui-test.mjs                 telefon/tahta düzeni, sıralama       13
scripts/assignment-ui-test.mjs             ödev verme, atama, işaretleme        43
scripts/assignment-admin-ui-test.mjs       düzenleme, arşiv, silme, kopyalama   36
scripts/agenda-ui-test.mjs                 günlük gündem ve sayaç               24
scripts/exam-ui-test.mjs                   sınav açma, not girme, girmedi       40
scripts/lock-ui-test.mjs                   tahta PIN kilidi                     44
scripts/board-ui-test.mjs                  canlı tahta yansıması + ses; ders
                                            yokken açılan tahta, ders değişimi;
                                            arka planda bildirim, süre/boyut
                                            ölçümü, tahta penceresi (PiP) ve
                                            pencere boyutu seçimi                97
scripts/parent-message-ui-test.mjs         veli mesajı, WhatsApp, taslak        25
scripts/undo-ui-test.mjs                   davranış kaydını geri alma           40
scripts/student-name-edit-ui-test.mjs      öğrenci ad/soyad düzenleme           13
scripts/class-student-delete-ui-test.mjs   arşivleme/silme, hesap sıfırlama     28
scripts/class-goal-ui-test.mjs             sınıf hedefi aç/kapa, ilerleme,
                                            tamamlanma, kapatma, geçmiş         18
scripts/exp-ui-test.mjs                    EXP aç/kapa, yıldız/ödev EXP'i,
                                            geri alma, cift-EXP korumasi        17
scripts/exam-rules-test.mjs                ağırlıklı puan, net, dönem           29
scripts/parent-message-rules-test.mjs      telefon, WhatsApp, şablon üretimi    35
scripts/class-goal-rules-test.mjs          hedef/ödül geçerliliği, ilerleme %   21
scripts/exp-rules-test.mjs                 EXP sabitleri, seviye formülü        20
scripts/panel-ui-test.mjs                  genel panel: dört blok, üç kriter,
                                            pencere sınırı, öğretmen ayrımı     40
scripts/qr-login-ui-test.mjs               QR ile tahta girişi; fotoğraflayan
                                            cihazın oturumu alamaması           30
scripts/dashboard-rules-test.mjs           panel eşikleri ve dikkat kararı      30
scripts/pairing-rules-test.mjs             eşleşme durumu, kod biçimi, çerez,
                                            açık yönlendirme koruması           39
scripts/progress-ui-test.mjs               gelişim: iki dönem, ders başına
                                            normalleştirme, iyi yön, tek dönem  30
scripts/report-ui-test.mjs                 rapor: dönem seçimi, yazdırma kipi,
                                            yazdır düğmesi, öğretmen ayrımı     45
scripts/progress-rules-test.mjs            gelişim eşikleri, yön kararı,
                                            kapsama göre etiket               44
scripts/board-rules-test.mjs               tahta bildirimi: metin, süre, sıra
                                            baskısı, boyut, PiP renk kontrastı
                                            ve pencere ölçüleri                66
scripts/class-report-ui-test.mjs           sınıf raporu: alfabetik sıra,
                                            teslim bazlı oran, yazdırma       38
scripts/class-progress-ui-test.mjs         sınıf gelişimi: öğrenci başına
                                            normalleştirme, kilitli tahta     26
```

`exam-rules-test.mjs`, `parent-message-rules-test.mjs`,
`class-goal-rules-test.mjs`, `exp-rules-test.mjs`, `dashboard-rules-test.mjs`,
`pairing-rules-test.mjs`, `progress-rules-test.mjs` ve `board-rules-test.mjs`
diğerlerinden farklı:
tarayıcı açmaz, sunucu gerektirmez. Veritabanına da ekrana da bağlı olmayan saf kurallar
(ağırlıklı puan/net/dönem; telefon normalizasyonu, WhatsApp bağlantısı,
şablon üretimi; hedef/ödül geçerliliği ve ilerleme yüzdesi; EXP sabitleri
ve seviye formülü; panel eşikleri; eşleşme durumu ve açık yönlendirme
koruması; gelişim eşikleri ve yön kararı; tahta bildiriminin süresi, sıra
baskısı eşiği ve PiP renklerinin kontrastı) doğrudan sınanır. Kurallar TypeScript'te yazılı olduğundan test önce ilgili
`kurallar.ts` dosyasını geçici bir dizine derler. Tek başına da çalışır:
`node scripts/<ad>.mjs`.

`test-oturum.mjs`, `test-ders.mjs`, `test-form.mjs` ve `test-kayit.mjs`
testlerin ortak adımlarıdır (giriş, ders başlatma, katlı öğrenci formunu
açma, kaydın veritabanına düşmesini bekleme); ayrı test değildirler.

`test-kayit.mjs` neden var: kart şablonunda satırın görünür metni artık
değişmiyor (puan kalktı, kart renkle gösteriliyor), bu yüzden testler
"metin değişti" yerine kaydın yazıldığını bekler.

### Çalıştırma (bulut oturumunda)

```bash
# 0. Bagimliliklar (node_modules bos gelir)
npm install

# 1. Yerel PostgreSQL 16
PG_BIN=/usr/lib/postgresql/16/bin
PG_ROOT=/var/lib/postgresql/apptest
rm -rf "$PG_ROOT" && mkdir -p "$PG_ROOT" && chown postgres:postgres "$PG_ROOT"
su postgres -c "$PG_BIN/initdb -D $PG_ROOT/data -U postgres --auth=trust"
su postgres -c "$PG_BIN/pg_ctl -D $PG_ROOT/data -o '-p 15432 -c listen_addresses=127.0.0.1 -c unix_socket_directories=$PG_ROOT' -l $PG_ROOT/server.log start"
su postgres -c "$PG_BIN/psql -h 127.0.0.1 -p 15432 -U postgres -c 'CREATE DATABASE teacheros'"

# 2. Ortam ve derleme
export DATABASE_URL="postgresql://postgres@127.0.0.1:15432/teacheros?schema=public"
export DIRECT_URL="$DATABASE_URL"
export SESSION_SECRET="yerel-test-icin-uretilmis-en-az-32-karakterlik-anahtar"
npx prisma migrate deploy && npm run build && npx next start -p 3000 &

# 3. Playwright (bağımlılıklara EKLENMEZ, testte gerekir)
npm install --no-save playwright
export PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
export SQL_KOMUTU='psql "postgresql://postgres@127.0.0.1:15432/teacheros" -q -tA'

# 4. Her testten ONCE veritabani temizlenir (test verisi birikmesin)
su postgres -c "$PG_BIN/psql -h 127.0.0.1 -p 15432 -U postgres -d teacheros -q -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'"
npx prisma migrate deploy
node scripts/<test>.mjs
```

Testlerin çoğu SQL okur ya da yazar; `SQL_KOMUTU` her zaman tanımlı olmalı.
Puan ders ekranında gösterilmediği için testler puanı kayıttan okur. Testler
veri yazar — **üretim veritabanına karşı çalıştırılmaz.**

`class-student-delete-ui-test.mjs`'nin son bölümü hesabı **tamamen
sıfırlar**; bu yüzden test dosyası içinde en sonda çalışır, ondan sonra
aynı oturumda başka bir şey denenmemelidir.

### Test yazarken dokuz tuzak
- **`textContent("body")` kullanma, `innerText("body")` kullan.** İlki
  Next.js'in sayfaya gömdüğü RSC veri script'ini de döndürür; ekranda
  olmayan isimler orada geçer ve "şu öğrenci listede yok" gibi kontroller
  sessizce yanlış geçer. Yeni testler `innerText` kullanıyor.
- **`psql` ifade hatasında da 0 çıkış kodu döndürür** (`ON_ERROR_STOP` yok).
  "Veritabanı bunu reddetti" gibi kontroller hata mesajına değil
  **gözlenebilir sonuca** bakmalı: kayıt sayısı değişti mi.
- **Tarihleri Europe/Istanbul'a göre kur, UTC'ye göre değil.** Uygulama
  "bugün"ü öğretmenin saat diliminde sayar; sunucu UTC çalışır. İkisi
  21:00–24:00 UTC arasında farklı günleri gösterir, ve o saatlerde
  UTC'den kurulmuş bir "bugün" testi haksız yere kalır. Bu gerçekten oldu.
- **Beklerken ekranda ZATEN doğru olan bir metni bekleme.** `waitFor`
  anında geçer ve test eski değeri okur. Değişecek olanın kendisini
  bekle. Özellikle art arda gelen iki farklı hatanın **aynı metni**
  gösterdiği durumlarda: ikinci `waitForFunction` birincinin hâlâ ekranda
  duran düğümüne bakıp yanlışlıkla anında geçebilir. Bu gerçekten oldu
  (`e2e-test.mjs`, `class-student-delete-ui-test.mjs`); çözüm, ya eski
  düğümün DOM'dan düşmesini önce beklemek ya da ikinci bekleyişte
  önceki metinle çakışmayan bir ayrıntı aramak.
- **Bir `<details>` bölümü sayfada tek olmayabilir.** `locator("details.katlanir")`
  gibi genel bir seçici, sayfaya ikinci bir katlanır bölüm (ör. "Sınıfı
  yönet") eklendiğinde strict-mode hatasına döner. Yeni testler
  `.filter({ hasText: "..." })` ile belirli bölümü seçer.
- **`/ayarlar` sayfasında birden fazla form aynı düğme metnini kullanabilir.**
  Sınıf hedefleri anahtarı eklenince sayfadaki ikinci "Kaydet" düğmesi,
  davranış şablonu formunu hedefleyen ~10 mevcut testte strict-mode hatasına
  yol açtı (`getByRole("button", { name: "Kaydet" })` iki eşleşme buldu).
  Çözüm: `.locator(".sablon-formu").getByRole("button", ...)` gibi forma
  özgü bir seçiciyle daralt. Aynı sayfaya yeni bir form eklerken var olan
  testlerin düğme seçicilerini de gözden geçir.
- **Arka planda dönen bir yoklama, kontrolünü yarışa sokabilir.** QR
  testinde "başarısız hırsızlık eşleşmeyi yakmadı" kontrolü kırmızı yandı;
  sebep kod değildi — tahtanın 2 saniyelik yoklaması eşleşmeyi bu arada
  MEŞRU şekilde tüketmişti. Böyle bir durumda kontrolü gevşetme; yoklayan
  sayfayı geçici olarak bırak (`goto("about:blank")`), ölçümü yap, sonra
  geri dön. Çerez bağlamda kaldığı için akış kaldığı yerden devam eder.
- **Kurulum SQL'ini satır sayısıyla DOĞRULA.** `psql` ifade hatasında da 0
  çıkış kodu döndürdüğü için hatalı bir INSERT sessizce düşer ve test sonra
  anlamsız bir sonuca bakar. Bu gerçekten oldu: enum kolonuna `CASE` ile
  yazarken cast unutulmuştu (`CASE ... END` sonucu `text`tir, enum'a örtük
  dönüşmez), teslimler hiç oluşmadı ve ölçü "karşılaştırılamaz" çıktı.
  Doğru assertion yakaladı; artık veri kuran testler `count(*)` ile kendi
  kurulumunu sınıyor.
- **Davranışı TAHMİN ETME, ölç.** Yazdırma için "CSS'e baktım, herhalde
  gizlenir" demek yeterli değildi: `emulateMedia({ media: "print" })` ile
  tarayıcı gerçekten yazdırma kipine alınıp menünün kaybolduğu, içeriğin
  durduğu doğrulanıyor. Aynı şekilde "yazdır düğmesi var" demek yerine
  `window.print` bir sayaçla değiştirilip düğmenin onu gerçekten çağırdığı
  ölçülüyor.

---

## UI'da bilinen bir CSS tuzağı

`.form button` kuralı (tek bir "Kaydet" düğmesi olan sıradan formlar için)
`.form` sınıflı BİRDEN FAZLA farklı düğmesi olan bir kapsayıcının içindeki
HER düğmeyi de eziyor — tip selektörü (`button`) onu, tek sınıflı özel
kurallardan (`.veli-sablon`, `.ders-dugme` vb.) daha spesifik yapıyor. Bu
gerçekten oldu: veli mesajı ekranındaki şablon düğmeleri ve "Taslak olarak
kaydet" düğmesi sessizce düz mavi göründü, kimse fark etmeden staging'e
kadar gitti. Çözüm deseni hep aynı: `.kapsayici .ozel-sinif` gibi iki
sınıflı bir seçiciyle geri al (bkz. `.ogrenci-adi-dugmeler .ders-dugme`,
`.tehlike-bolgesi .tehlike-dugmesi`, `.veli-sablon-satiri .veli-sablon`).
Bir forma birden fazla görsel rolde düğme eklerken bunu akılda tut.

---

## Durum

**Bitti:** veritabanı temeli, giriş sistemi ve veri ayrımı, sınıf/öğrenci
yönetimi (ekleme, ad düzenleme, arşivleme, silme), davranış şablonları
(basit +/− ve kart sistemi), sarı/kırmızı kart, davranış kaydını geri alma,
performans puanı, öğrenci geçmişi, teneffüs cezası ve kronometre, ders
yönetimi, ders ekranının telefon ve akıllı tahta için düzenlenmesi, akıllı
tahta PIN kilidi, telefondan verilen kartın tahtada canlı yansıması, **ödev
modülü**, **sınav modülü**, **günlük gündem**, **veli iletişimi** (rıza
akışı, WhatsApp taslakları, altı hazır şablon), hesap düzeyinde tam veri
sıfırlama, ayrı bir staging ortamı ve dallanma akışı, **sınıf hedefleri**
ve **EXP/seviye sistemi** (gamification'ın öğretmen bazlı açılıp kapanan
iki parçası, aynı anahtarla), performans notu tabanının 90'dan 80'e
indirilmesi, **genel panel**, **gelişim görünümü** (öğrenci ve sınıf),
**yazdırılabilir raporlar** (öğrenci ve sınıf), **QR ile akıllı tahta
girişi** ve giriş sonrası dönüş, **tahta bildirimlerinin üç kanalı** (sayfa
içi kutu, işletim sistemi bildirimi, tahta penceresi). v0.6'nın öğrenci ve
sınıf tarafı bitti.

**Hız:** Vercel fonksiyonları `vercel.json` ile `dub1`'de (Dublin) çalışır —
veritabanıyla aynı bölge. Varsayılan `iad1` (Washington) her sorguyu
Atlantik'ten geçiriyordu. Sayfalardaki bağımsız sorgular `Promise.all` ile
paralel gider. Davranış düğmeleri sunucuyu beklemeden ekranı günceller.

**Kurulum tamamlandı** — canlıda hesap mevcut, `/kurulum` kapalı.

v0.1–v0.3 canlıda gerçek kullanımla doğrulandı. v0.4 (sınav) ve v0.5 (veli
iletişimi) canlıda ama henüz birkaç haftalık gerçek kullanımla tam
sınanmadı. Akıllı tahta kilidi ve canlı yansıma en az bir gerçek ders
oturumunda denendi.

**24 Eylül, gerçek tahta:** arka plan bildirimleri gerçek derste denendi.
Sonuç: Windows bildirimi geldi ama küçüktü ve öğretmenin istediği
caydırıcılığı vermedi. Bu ölçüm tahta penceresini (PiP) doğurdu. Pencerenin
kendisi henüz gerçek tahtada denenmedi.

**YÖN DEĞİŞTİ (24 Eylül).** Öğretmenin kendi sözleriyle: okulun ana sistemi
K12NET, Teacher OS takip için değil "ileride oyunlaştırma ve virtual
classroom tarzı bir deneyim" için isteniyor. Bunun iki sonucu var:

1. **Sıradaki büyük iş artık v0.7 (AI Assistant) değil, oyunlaştırma.**
   Öğretmen üç yön seçti: avatar + sınıf haritası, takım yarışı, rozet ve
   ödül dükkânı. Ayrıntılı plan ROADMAP'te. Şu an **beklemede** — önce tahta
   bildirimleri bitirildi.
2. **Takip modülleri olduğu gibi kalır, dokunulmaz.** Öğretmenin kendi
   kararı. Silmek EXP'yi ve raporları kırardı, karşılığında bir şey
   kazandırmazdı. Sınav ve rapor tarafını hiç açmadan da kullanılabilir.

v0.6'dan geriye yalnızca **grafikler** kaldı; v0.4'ten beri bilerek
bekliyorlar. ROADMAP'in "Açık kalan küçük sorular" bölümünde de gerçek
kullanımdan gelebilecek küçük iyileştirmeler var.

**Sunuma gömülü entegrasyon gerekmedi (25 Eylül).** Öğretmen derste kendi
HTML sunumlarını kullanıyor (Claude'un ürettiği, menülü, çevrimdışı da
açılabilen tek dosyalar). "Kart slaydın içinde çıksın" için iki yol
düşünülmüştü — sunuma gömülecek bir betik (sınıfa özel yayın anahtarıyla,
çünkü oturum çerezi `sameSite: "lax"` ve siteler arası istekte gitmiyor) ya
da sunumu Teacher OS'te barındırmak. İkisi de yapılmadı: PiP penceresi
sunumun üstüne küçük bir alana konabiliyor ve bu yeterli görüldü. Ayrıca
gömülü betik sunumların ÇEVRİMDIŞI açılabilme özelliğini zayıflatırdı.

**K12NET entegrasyonu araştırıldı ve kapatıldı (24 Eylül).** Sebebi
"yapmaya değmez" değil, teknik olarak mümkün olmaması: `developers.k12net.com`
partner API'si yalnızca OKUMA yapıyor (öğrenci/öğretmen/şube bilgisi, SSO);
ödev, devamsızlık, not veya davranış için tek bir yazma endpoint'i yok.
Erişim ayrıca kurumsal partnerlik sözleşmesi gerektiriyor. K12NET'in kendi
toplu aktarım kanalı Excel ve E-Okul.

Not: çift giriş sorunu sanıldığı kadar geniş değil. Teacher OS'te olup
K12'de karşılığı olmayan şeyler (artı/eksi, kartlar, teneffüs cezası, EXP,
sınıf hedefleri, davranış geçmişi, canlı yansıma) zaten hiçbir zaman iki
yere girilmiyor. Örtüşen yalnızca **ödev, sınav notu ve devamsızlık** —
devamsızlık modülü Teacher OS'te zaten hiç yok.

**v0.6'nın hiçbir parçası gerçek veriyle denenmedi** ve bu, sıradaki işten
daha önemli olabilir. Testler bunların DOĞRU ÇALIŞTIĞINI gösteriyor; DOĞRU
ŞEYİ YAPTIKLARINI göstermiyor:
- Panelin eşikleri ayarlanmadı. "Dikkat gereken öğrenciler" listesi ya
  bomboş ya herkesle dolu çıkıyorsa `dashboard-rules.ts`'te tek satır.
- Gelişim oklarının gerçek veride mantıklı çıkıp çıkmadığı görülmedi;
  eşikler `progress-rules.ts`'te.
- Raporlar bir veli toplantısında kullanılmadı; kâğıt çıktısının gerçekten
  işe yarayıp yaramadığı, kalabalık bir sınıfta tablonun sığıp sığmadığı
  bilinmiyor.
- QR akışı gerçek bir akıllı tahtada denenmedi.
- ~~Tahta penceresi (PiP) gerçek tahtada denenmedi~~ **denendi, çalışıyor
  (25 Eylül)**. Aynı denemede kart süreleri de kısaltıldı. Hazır boyut
  düğmeleri denemeden SONRA eklendi; "Küçük" ölçü henüz tahtada görülmedi.

Bir sonraki büyük özelliğe geçmeden önce bir haftalık gerçek kullanım,
buradaki eşikleri ve tasarım kararlarını yeni bir modülden daha çok
düzeltir.

### Açık kalan küçük sorular
- ~~Akıllı tahtada üstüne başka bir uygulama açıkken canlı bildirimin
  görünür kalması~~ **yapıldı (25 Eylül)**: tahta penceresi (Document PiP).
  Ayrıntısı "Canlı tahta yansıması" bölümünde.
- Kart şablonunda ders sırasında öğrencinin birikimi görünmüyor (puan
  kaldırıldı, yıldız sayısı hiç yoktu). İstenirse "bu derste kaç yıldız"
  sayacı eklenebilir.
- Ders ekranında ödev ve sınav görünürlüğü yok: ders sırasında kimin ödevini
  yapmadığı görünmüyor. Ders ekranı bilerek sade tutulduğu için eklenmedi.
- Gerçek telefon bildirimi (uygulama kapalıyken) yok. Gündem yalnızca
  uygulama içi. Push için service worker + VAPID + izin akışı gerekir.
- Gündem yalnızca ödeve bakıyor; sınav gündeme düşmüyor.
- Karne ortalaması (resmî sınavların dönem ortalaması) hesaplanmıyor.
  Veri buna hazır: `scope` ve `donemBul` var, eksik olan yalnızca ekran.

---

## Çalışma yöntemi

`CLAUDE.md`'deki akışa uyulur: **incele → planla → onay al → uygula →
test et → kısa rapor ver.** Kullanıcı Türkçe konuşur ve onay almadan işlem
yapılmasını istemez. Kritik değişikliklerde önce neden ve çözüm anlatılır.

Kullanıcı tablet üzerinden çalışır; yerel bilgisayarı yoktur. Doğrulama
canlı deployment üzerinden yapılır. Ders sırasında uygulamayı telefondan
ya da akıllı tahtadan kullanır (tabletten değil).

### Dallanma ve staging

3 Eylül 2026'da kuruldu. `main`'in (production) yanında bir de `staging`
dalı var; Vercel'de ikisi de otomatik build ediliyor ama tamamen ayrı
ortamlar:

| | `main` (Production) | `staging` (Preview) |
|---|---|---|
| Vercel ortamı | Production | Preview |
| Supabase projesi | üretim | ayrı, izole test projesi |
| Adres | teacher-os-black.vercel.app | teacher-os-git-staging-doganalp-banci.vercel.app |

**Akış:** her özellik önce kendi `claude/...` dalında geliştirilir, `staging`'e
mergelenir. Öğretmen orada test edip onaylayınca `staging`, `main`'e
mergelenir. **`main`'e doğrudan merge yok.**

**Staging'de yeni kod görmek için dala gerçek bir commit push edilmelidir.**
Vercel'deki "Redeploy" var olan bir deployment'ı aynı commit'le yeniden
build eder, dal değiştirmez — bu yüzden bir ara "main" zannedilip yanlışlıkla
iki kez production redeploy edildi, `staging` hiç build olmadı. Yeni kodun
staging'e gitmesinin tek güvenilir yolu push'tur.

**Staging linkine bu bulut ortamından (curl vb.) erişilince Vercel'in kendi
giriş ekranı çıkar** ("Login – Vercel"), uygulamanın kendisi değil —
Deployment Protection nedeniyle, bir hata değil. Doğrulama öğretmenin kendi
(Vercel'e giriş yapmış) tarayıcısından yapılmalı.

**Şema değişikliği artık iki veritabanına gidiyor.** Migration üretilince
SQL hem production'da her zamanki akışla (onay → SQL Editor → verify-state)
hem de staging'in kendi Supabase SQL Editor'ünde ayrıca çalıştırılmalı;
aksi halde staging'in şeması production'dan sürüklenir ve orada test etmek
anlamsızlaşır.

### Bu ortamın tuzakları
- **Vercel bazen `main` push'unu kaçırıyor.** Deployment listesinde commit
  yalnızca Preview olarak görünüp Production eski sürümde kalabiliyor.
  Çözüm: Vercel → Deployments → ilgili satır → **Promote to Production**.
- **Yerel PostgreSQL ve `npm start` sunucusu, oturumlar arasında (bazen
  aynı oturum içinde bile) durabiliyor.** Her test koşusundan önce
  `pg_isready` ve `curl .../` ile ikisinin de ayakta olduğunu doğrula,
  gerekirse `pg_ctl start` ve `npm start &` ile yeniden başlat.
- **`pkill -f "next start"` kendi kabuğunu öldürür** (komut satırı eşleşir).
  Sunucuyu kapatmak için `ps -eo pid,cmd | grep next-server` ile pid bul,
  `kill <pid>` kullan. Eski sunucu ayakta kalırsa testler yeni build'i
  değil eskisini görür ve yanıltıcı sonuç verir.
- **Aynı `getByLabel` metni birden fazla forma denk gelebilir.** Örn.
  "Hesap parolanız" hem tahta PIN formunda hem hesap sıfırlama formunda
  vardı; `getByLabel` alt-dize eşleşmesi yaptığı için birini diğerinden
  ayırt edecek şekilde etiketleri **gerçekten farklı** yaz (yalnızca ekli
  parantez yetmez — "Hesap parolanız (X)" hâlâ "Hesap parolanız"ı içerir).
- **Öğretmene verilen "bunu SQL Editor'de çalıştır" görevleri takip
  kaybedebilir.** Bir oturumda arka arkaya birkaç manuel SQL istendiğinde
  (migration + bir de veri düzeltmesi gibi), bir sonrakine geçince öncekinin
  gerçekten çalıştırıldığı teyit edilmeden unutulabilir (bkz. yukarıdaki
  performans notu recompute notu). Her manuel adımdan sonra açıkça "çalıştı
  mı?" diye sorup onay almadan bir sonraki işe geçme.
- **Bu ders ikinci kez yaşandı ve bu sefer maliyeti staging'di.** EXP
  migration'ında yalnızca production onayı alındı, staging sorulmadı; staging
  günlerce eksik şemayla çalıştı (bkz. yukarıdaki migration notu). Şema
  değişikliği **iki** veritabanına gider — tek bir "tamam" cevabı yetmez,
  **hangi veritabanı** olduğu sorulmalı. Yalnızca verify çıktısının tamamını
  istemek yeterli değildi; hangi projeden geldiğini de sor.
- **Öğretmen "staging'e gerek yok, direkt main" diyebilir — şema
  değişikliği varsa bu ayrı bir şeydir.** Kodun staging'de test edilmemesi
  öğretmenin kararıdır; ama migration yine de iki veritabanına da
  uygulanmalı, yoksa staging'in şeması sürüklenir ve oraya bir sonraki
  merge'de orası kırılır. QR işinde tam bu ayrım yapıldı: test staging'de
  yapılmadı, SQL yine de ikisine de gitti.
- **`sleep`'i beklemek için kullanma; ortam engelliyor.** Bir koşulu
  beklemek gerekiyorsa `until <kontrol>; do sleep 5; done` gibi bir döngü
  kullan (Vercel deploy'unu beklemek için gerekti).

### Derlemenin yakalayamadığı iki hata sınıfı
Sınav modülünde ikisi de yaşandı; `npm run build` temiz geçtiği hâlde sayfa
çalışmıyordu. Yeni modülde **mutlaka tarayıcı testi yaz**, derleme yeterli
değil.

- **İstemci/sunucu sınırı.** Sunucu bileşeni, `"use client"` modülünden
  export edilmiş bir fonksiyonu çağıramaz; sayfa çalışma zamanında 500
  verir. Ortak yardımcılar `src/lib/` altında, `"use client"` taşımayan bir
  dosyada durmalı (`exam-rules.ts` böyle).
- **Form nesnesini doğrudan Prisma'ya yaymak.** `...b` ile yayılan form
  satırı, düzenleme için taşınan `id` gibi fazladan alanları da götürür ve
  kayıt reddedilir. TypeScript yakalamaz: fazladan alan kontrolü yalnızca
  nesne değişmezlerinde çalışır, geniş tipli bir değişken geçilince değil.
  `create`/`update` içinde alanları tek tek yaz.
