# Devir Notu

Yeni bir oturuma başlarken önce bunu, sonra `CLAUDE.md` (kurallar) ve
`ROADMAP.md` (yön) dosyalarını oku. Bu belge **mevcut durumu** anlatır.

Son güncelleme: 4 Eylül 2026 · anlatılan kod durumu `main` = `265e694`
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

## Migration'lar (11)

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
```

Hepsi hem production hem staging Supabase'inde uygulandı ve
`verify-state.sql` ile doğrulandı (41 satır, hepsi TAMAM). Bekleyen
migration yok.

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
  parent-message.ts / parent-message-rules.ts
                         veli mesajı: WhatsApp bağlantısı, şablonlar, geçmiş
  account-reset.ts       tüm hesap verisini silme (öğretmen kalır)
  assignment.ts          ödev: oluşturma, atama, işaretleme, istatistik, gündem
  exam.ts                sınav: oluşturma, atama, not girme, ortalama, istatistik
  exam-rules.ts          sınav hesabının veritabanısız kısmı: şablonlar, net,
                         ağırlıklı puan, dönem, bileşen form satırı
  student-history.ts     öğrenci geçmişi ve dönem toplamları
  siralama.ts            Türkçe alfabe sıralaması
  form-state.ts          form durumu tipi

src/components/  (~35 dosya; öne çıkanlar)
  UstMenu.tsx              Sınıflarım · Ödevler · Sınavlar · Veli · Ayarlar + sayaçlar
  OgrenciSatiri.tsx        ders ekranındaki öğrenci satırı; iyimser güncelleme
  DavranisDugmeleri.tsx    şablona göre düğmeler, gönderimler sıraya girer
  GeriAlDugmesi.tsx        süren dersteki son kaydı geri alır
  DersKontrolu.tsx         duruma göre "Yeni ders başlat" ya da "Dersi bitir"
  CezaKontrolu.tsx         ceza rozeti + kronometre paneli
  TahtaKilidi.tsx          PIN pad'i, kilit rozeti, kilit/aç akışı
  SinifCanliBildirimleri.tsx  telefonda verilen kartın tahtada canlı yansıması + ses
  OgrenciAdiFormu.tsx      öğrenci sayfası başlığı; "Düzenle" ile ad/soyad düzeltme
  SinifYonetimi.tsx / OgrenciYonetimi.tsx  arşivle/arşivden çıkar/sil
  HesapSifirlamaFormu.tsx  Ayarlar'daki "Tehlike bölgesi"
  VeliMesajFormu.tsx       hazır şablon + WhatsApp bağlantısı + taslak/gönderildi
  OdevIslemleri.tsx / SinavIslemleri.tsx  düzenle · kopyala · arşivle · sil
  GundemPaneli.tsx         ana sayfadaki "Bugün kontrol edilecek"

src/app/
  page.tsx                gündem paneli + sınıf listesi + arşivlenmiş sınıflar
  sinif/[id]/             sınıf detayı: ders, davranış düğmeleri, ceza rozeti,
                          canlı yayın, arşivlenmiş öğrenciler, sınıfı yönet
  sinif/[id]/dersler/     ders geçmişi ve tek dersin kayıtları
  sinif/[id]/odevler/     sınıfın ödevleri + sınıf istatistiği + öğrenci dökümü
  sinif/[id]/sinavlar/    sınıfın sınavları + ortalama + öğrenci dökümü
  odevler/, sinavlar/     ödev/sınav listeleri, yeni/düzenle sayfaları
  veli/                   öğrenci seç → mesaj oluştur ekranı
  ogrenci/[id]/           öğrenci: özet, ad düzenleme, not girme, ödevler,
                          sınavlar, geçmiş, cezalar, veli mesajı, yönet
  ayarlar/                davranış şablonu, tahta kilidi, tehlike bölgesi
  giris/ kurulum/         oturum ekranları
  api/ders/[dersId]/olaylar/  canlı yayının yokladığı uç nokta (middleware'den muaf)
  actions.ts              sınıf, öğrenci, ders, davranış, ceza, arşiv/sil, sıfırlama
  odev-actions.ts         ödev action'ları (ayrı dosya; modül tek başına büyük)
  sinav-actions.ts        sınav action'ları
  kilit-actions.ts        tahta PIN kurulum/aç action'ları
  veli-actions.ts         veli mesajı action'ları
  oturum-actions.ts       giriş / kurulum / çıkış
  middleware.ts           oturumsuz istekleri /giris'e, kilitli cihazı sınıf
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
+ `/api/ders/[dersId]/olaylar`) ile görünür ve 8-bit bir ses çalar
(`board-sound.ts`, WebAudio). Websocket/Supabase Realtime kullanılmaz:
tarayıcıdan doğrudan veritabanına erişim sahiplik kontrolünü atlardı.

Etkinlik üç şeyden birine bağlıdır: ekran 1280px eşiğini geçmişse, öğretmen
elle "Tahta modu" açmışsa, ya da **cihaz kilitliyse** (kilitli cihaz tanım
gereği tahtadır — genişlik tahmini yanılabilir, kilit her zaman kazanır).

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

---

## Testler

Yirmi arayüz testi (gerçek tarayıcıda, Playwright) ve iki saf hesap testi,
toplam **~624 kontrol**. Hepsi geçiyor.

```
scripts/e2e-test.mjs                       sınıf/öğrenci ekleme, kalıcılık      35
scripts/template-ui-test.mjs               şablonlar, elle not                  25
scripts/behavior-ui-test.mjs               kart kuralları                       24
scripts/history-ui-test.mjs                öğrenci geçmişi                      16
scripts/auth-ui-test.mjs                   giriş ve veri ayrımı                 26
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
scripts/board-ui-test.mjs                  canlı tahta yansıması + ses          30
scripts/parent-message-ui-test.mjs         veli mesajı, WhatsApp, taslak        25
scripts/undo-ui-test.mjs                   davranış kaydını geri alma           40
scripts/student-name-edit-ui-test.mjs      öğrenci ad/soyad düzenleme           13
scripts/class-student-delete-ui-test.mjs   arşivleme/silme, hesap sıfırlama     28
scripts/exam-rules-test.mjs                ağırlıklı puan, net, dönem           29
scripts/parent-message-rules-test.mjs      telefon, WhatsApp, şablon üretimi    35
```

`exam-rules-test.mjs` ve `parent-message-rules-test.mjs` diğerlerinden
farklı: tarayıcı açmaz, sunucu gerektirmez. Veritabanına da ekrana da bağlı
olmayan saf kurallar (ağırlıklı puan/net/dönem; telefon normalizasyonu,
WhatsApp bağlantısı, şablon üretimi) doğrudan sınanır. Kurallar
TypeScript'te yazılı olduğundan test önce ilgili `kurallar.ts` dosyasını
geçici bir dizine derler. Tek başına da çalışır: `node scripts/<ad>.mjs`.

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

### Test yazarken beş tuzak
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
sıfırlama, ayrı bir staging ortamı ve dallanma akışı.

**Hız:** Vercel fonksiyonları `vercel.json` ile `dub1`'de (Dublin) çalışır —
veritabanıyla aynı bölge. Varsayılan `iad1` (Washington) her sorguyu
Atlantik'ten geçiriyordu. Sayfalardaki bağımsız sorgular `Promise.all` ile
paralel gider. Davranış düğmeleri sunucuyu beklemeden ekranı günceller.

**Kurulum tamamlandı** — canlıda hesap mevcut, `/kurulum` kapalı.

v0.1–v0.3 canlıda gerçek kullanımla doğrulandı. v0.4 (sınav) ve v0.5 (veli
iletişimi) canlıda ama henüz birkaç haftalık gerçek kullanımla tam
sınanmadı. Akıllı tahta kilidi ve canlı yansıma en az bir gerçek ders
oturumunda denendi.

**Sırada:** `ROADMAP.md`'de resmî sıradaki adım v0.6 (Dashboard &
Raporlama); ROADMAP'in "Açık kalan küçük sorular" bölümünde de gerçek
kullanımdan gelebilecek küçük iyileştirmeler var.

### Açık kalan küçük sorular
- Akıllı tahtada üstüne başka bir uygulama (PowerPoint vb.) açıkken canlı
  bildirimin görünür kalması (PiP/overlay) denendi ama ölçüm sonucu
  paylaşılmadı; tanı sayfası kod tabanından kaldırıldı. Gerçekten istenirse
  yeniden ele alınabilir.
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
