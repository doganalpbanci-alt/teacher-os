# Devir Notu

Yeni bir oturuma başlarken önce bunu, sonra `CLAUDE.md` (kurallar) ve
`ROADMAP.md` (yön) dosyalarını oku. Bu belge **mevcut durumu** anlatır.

Son güncelleme: 25 Ağustos 2026 · anlatılan kod durumu `main` = `baad251`
(üstündeki commit'ler yalnızca bu notun kendisidir)

---

## Proje nedir

İngilizce öğretmenleri için öğrenci, sınıf, ders, ödev, davranış ve performans
takip paneli. Tek öğretmenin kişisel aracı olarak başladı, artık çok
öğretmenli çalışacak yapıda.

## Nerede çalışıyor

| | |
|---|---|
| Depo | `doganalpbanci-alt/teacher-os` |
| Deploy dalı | `main` — her push Vercel'de otomatik yayına girer |
| Çalışma dalı | her iş için yeni bir `claude/...` dalı; onaydan sonra merge |
| Canlı | https://teacher-os-black.vercel.app |
| Veritabanı | Supabase PostgreSQL |

Vercel ortam değişkenleri (Production + Preview): `DATABASE_URL`,
`DIRECT_URL`, `SESSION_SECRET`. `SESSION_SECRET` "sensitive" olduğu için
Development ortamında yoktur; gerekmiyor.

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

---

## Migration'lar (7)

```
20260821214524_init                    tablolar
20260822105533_harden_history_and_rls  RESTRICT silme kuralları + RLS
20260822235800_behavior_template       Teacher.behaviorTemplate + puan kısıtı gevşetildi
20260823144543_break_penalty           BreakPenalty tablosu
20260823174546_lesson_ended_at         Lesson.endedAt + eski dersler kapatıldı
20260825152117_assignment_module       Assignment sınıftan öğretmene taşındı
20260825191157_lesson_single_open      tek açık ders kısıtı + birikmiş dersler kapatıldı
```

Yedisi de Supabase'de uygulandı ve `verify-state.sql` ile doğrulandı
(25 satır, hepsi TAMAM). Bekleyen migration yok.

---

## Mimari

```
src/lib/
  prisma.ts           Prisma Client (tek örnek)
  session.ts          imzalı oturum çerezi (jose)
  auth.ts             parola hash (bcryptjs), oturum aç/kapat
  current-teacher.ts  oturumdaki öğretmen; yoksa /giris'e yönlendirir
  lesson.ts           aktif ders, ders başlat/bitir, ders geçmişi ve detayı
  behavior.ts         davranış kaydını yazan taraf (veritabanına dokunur)
  behavior-rules.ts   şablon kurallarının veritabanısız kısmı; ekran da bunu
                      kullanır, böylece kural iki yere kopyalanmaz
  penalty.ts          teneffüs cezası kuralları + kronometre durumu
  assignment.ts       ödev: oluşturma, atama, işaretleme, istatistik, gündem
  student-history.ts  öğrenci geçmişi ve dönem toplamları
  siralama.ts         Türkçe alfabe sıralaması
  form-state.ts       form durumu tipi

src/components/
  UstMenu.tsx            Sınıflarım · Ödevler · Ayarlar + gündem sayacı
  OgrenciSatiri.tsx      ders ekranındaki öğrenci satırı; iyimser güncelleme
  DavranisDugmeleri.tsx  şablona göre düğmeler, gönderimler sıraya girer
  DersKontrolu.tsx       duruma göre "Yeni ders başlat" ya da "Dersi bitir"
  CezaKontrolu.tsx       ceza rozeti + kronometre paneli
  OdevFormu.tsx          ödev oluşturma ve düzenleme (aynı form)
  HedefSecici.tsx        sınıf/öğrenci seçimi; sınıf kutusu üç durumlu
  TeslimDurumu.tsx       tek öğrencinin teslim durumu
  TopluIsaretle.tsx      sınıfın tamamını tek basışta işaretleme
  OdevIslemleri.tsx      düzenle · kopyala · arşivle · sil
  GundemPaneli.tsx       ana sayfadaki "Bugün kontrol edilecek"

src/app/
  page.tsx            gündem paneli + sınıf listesi
  sinif/[id]/         sınıf detayı: ders, davranış düğmeleri, ceza rozeti
  sinif/[id]/dersler/ ders geçmişi ve tek dersin kayıtları
  sinif/[id]/odevler/ sınıfın ödevleri + sınıf istatistiği + öğrenci dökümü
  odevler/            ödev listesi (aktif · gecikmiş · arşiv)
  odevler/yeni/       ödev verme; ?kaynak=<id> ile kopyalama
  odevler/[odevId]/   ödev detayı: sınıfa göre gruplu öğrenciler
  odevler/[odevId]/duzenle/
  ogrenci/[id]/       öğrenci: özet, not girme, ödevler, geçmiş, cezalar
  ayarlar/            davranış şablonu seçimi
  giris/ kurulum/     oturum ekranları
  actions.ts          sınıf, öğrenci, ders, davranış, ceza action'ları
  odev-actions.ts     ödev action'ları (ayrı dosya; modül tek başına büyük)
  oturum-actions.ts   giriş / kurulum / çıkış
  middleware.ts       oturumsuz istekleri /giris'e yollar
```

### Değişmez kurallar
- **Geçmiş silinmez.** Her davranış bir olay kaydıdır.
- **Sahiplik sorgunun parçasıdır.** Id alan her sorgu ve action
  `teacherId` şartı taşır; başkasının kaydı 404 döner. Bu unutulursa veri
  ayrımı sessizce delinir.
- **Düğme gizlemek yetki kontrolü değildir.** Hangi eylemin geçerli olduğu
  sunucuda öğretmenin şablonundan okunur.

### Ders ekranı
Ders sırasında kullanılan cihaz telefon ya da akıllı tahtadır. Düzen tek
ama üç boyuta ölçeklenir (`globals.css`): telefonda başlık tek satır,
tahtada (≥1280px) sütun genişler, yazı ve düğmeler büyür, sınıf iki sütuna
dikey akar. Dokunma hedefi en az 44px.

Performans puanı ders ekranında **gösterilmez**; öğrenci sayfasında görülür.
Ders sırasında karar kartlardan ve sayılardan verilir.

Öğrencinin sahip olduğu kart satırın kendisidir (renkli şerit + zemin);
düğmeler ayrı durur. İkisi birbirine benzerse liste bir bakışta okunmaz.

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

### Günlük gündem
Ana sayfadaki panel ve üst menüdeki sayaç. Bir ödev üç şart birden
sağlıyorsa gündemdedir: arşivlenmemiş + teslim günü gelmiş ya da geçmiş +
hâlâ işaretlenmemiş öğrenci var. Tarihsiz ödev hiç düşmez. Yapacak iş yoksa
panel **hiç render edilmez** — her gün duran boş kutu bir süre sonra
okunmaz olur.

---

## Testler

On üç arayüz testi, gerçek tarayıcıda (Playwright), toplam **338 kontrol**.
Hepsi geçiyor.

```
scripts/e2e-test.mjs                  sınıf ve öğrenci ekleme            33
scripts/template-ui-test.mjs          şablonlar, elle not                25
scripts/behavior-ui-test.mjs          kart kuralları                     24
scripts/history-ui-test.mjs           öğrenci geçmişi                    16
scripts/auth-ui-test.mjs              giriş ve veri ayrımı               26
scripts/card-buttons-ui-test.mjs      kart şablonunun üç düğmesi         24
scripts/penalty-ui-test.mjs           teneffüs cezası ve kronometre      22
scripts/lesson-ui-test.mjs            ders başlat/bitir, geçmiş, kısıt   39
scripts/optimistic-ui-test.mjs        iyimser güncelleme                 13
scripts/layout-ui-test.mjs            telefon/tahta düzeni, sıralama     13
scripts/assignment-ui-test.mjs        ödev verme, atama, işaretleme      43
scripts/assignment-admin-ui-test.mjs  düzenleme, arşiv, silme, kopyalama 36
scripts/agenda-ui-test.mjs            günlük gündem ve sayaç             24
```

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

### Test yazarken iki tuzak
- **`textContent("body")` kullanma, `innerText("body")` kullan.** İlki
  Next.js'in sayfaya gömdüğü RSC veri script'ini de döndürür; ekranda
  olmayan isimler orada geçer ve "şu öğrenci listede yok" gibi kontroller
  sessizce yanlış geçer. Yeni testler `innerText` kullanıyor.
- **`psql` ifade hatasında da 0 çıkış kodu döndürür** (`ON_ERROR_STOP` yok).
  "Veritabanı bunu reddetti" gibi kontroller hata mesajına değil
  **gözlenebilir sonuca** bakmalı: kayıt sayısı değişti mi.

---

## Durum

**Bitti:** veritabanı temeli, giriş sistemi ve veri ayrımı, sınıf/öğrenci
yönetimi, davranış şablonları (basit +/− ve kart sistemi), sarı/kırmızı kart,
performans puanı, öğrenci geçmişi, teneffüs cezası ve kronometre, ders
yönetimi, ders ekranının telefon ve akıllı tahta için düzenlenmesi, **ödev
modülü** (verme, çoklu sınıf/öğrenci atama, tarihler, işaretleme, toplu
işaretleme, düzenleme, arşiv/silme, kopyalama, istatistikler) ve **günlük
gündem**.

**Hız:** Vercel fonksiyonları `vercel.json` ile `dub1`'de (Dublin) çalışır —
veritabanıyla aynı bölge. Varsayılan `iad1` (Washington) her sorguyu
Atlantik'ten geçiriyordu. Sayfalardaki bağımsız sorgular `Promise.all` ile
paralel gider. Davranış düğmeleri sunucuyu beklemeden ekranı günceller.

**Kurulum tamamlandı** — canlıda hesap mevcut, `/kurulum` kapalı.

v0.1 ve v0.2 canlıda gerçek kullanımla doğrulandı. v0.3 (ödev) canlıda
doğrulandı; gündem paneli henüz birkaç gün gerçek kullanımla sınanmadı.

**Sırada:** `ROADMAP.md` v0.4 — sınav ve akademik takip. Şemada `Exam` ve
`ExamResult` hazır, ama `Exam` da `classroomId`'ye bağlı: ödevde çözdüğümüz
"tek sınıfa bağlılık" sorusu orada da çıkacak. Aynı kararı tekrar vermek
gerekecek.

### Açık kalan küçük sorular
- Kart şablonunda ders sırasında öğrencinin birikimi görünmüyor (puan
  kaldırıldı, yıldız sayısı hiç yoktu). İstenirse "bu derste kaç yıldız"
  sayacı eklenebilir.
- Ders ekranında ödev görünürlüğü yok: ders sırasında kimin ödevini
  yapmadığı görünmüyor. Ders ekranı bilerek sade tutulduğu için eklenmedi.
- Gerçek telefon bildirimi (uygulama kapalıyken) yok. Gündem yalnızca
  uygulama içi. Push için service worker + VAPID + izin akışı gerekir.

---

## Çalışma yöntemi

`CLAUDE.md`'deki akışa uyulur: **incele → planla → onay al → uygula →
test et → kısa rapor ver.** Kullanıcı Türkçe konuşur ve onay almadan işlem
yapılmasını istemez. Kritik değişikliklerde önce neden ve çözüm anlatılır.

Kullanıcı tablet üzerinden çalışır; yerel bilgisayarı yoktur. Doğrulama
canlı deployment üzerinden yapılır. Ders sırasında uygulamayı telefondan
ya da akıllı tahtadan kullanır (tabletten değil).

### Bu ortamın tuzakları
- **Preview deployment'lar ÜRETİM veritabanını kullanır.** Ortam
  değişkenleri Production + Preview olarak tanımlı. Yani merge edilmemiş bir
  daldan preview üzerinden girilen veri gerçek veridir. "Bu özellik merge
  edilmedi, tablo boştur" varsayımı yanlıştır — migration yazmadan önce
  kullanıcıya sor ya da veriyi koruyacak şekilde yaz.
- **Vercel bazen `main` push'unu kaçırıyor.** Deployment listesinde commit
  yalnızca Preview olarak görünüp Production eski sürümde kalabiliyor.
  Çözüm: Vercel → Deployments → ilgili satır → **Promote to Production**.
- **Yerel PostgreSQL test sırasında düşebiliyor.** Testler açıklanamayan
  şekilde zaman aşımına uğrarsa önce `pg_ctl status` bak, gerekirse yeniden
  başlat.
- **`pkill -f "next start"` kendi kabuğunu öldürür** (komut satırı eşleşir).
  Sunucuyu kapatmak için `ps -eo pid,cmd | grep next-server` ile pid bul.
  Eski sunucu ayakta kalırsa testler yeni build'i değil eskisini görür ve
  yanıltıcı sonuç verir.
