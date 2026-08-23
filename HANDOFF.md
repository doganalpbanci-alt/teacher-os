# Devir Notu

Yeni bir oturuma başlarken önce bunu, sonra `CLAUDE.md` (kurallar) ve
`ROADMAP.md` (yön) dosyalarını oku. Bu belge **mevcut durumu** anlatır.

Son güncelleme: 23 Ağustos 2026 · `main` = `3544bb6`

---

## Proje nedir

İngilizce öğretmenleri için öğrenci, sınıf, ders, davranış ve performans
takip paneli. Tek öğretmenin kişisel aracı olarak başladı, artık çok
öğretmenli çalışacak yapıda.

## Nerede çalışıyor

| | |
|---|---|
| Depo | `doganalpbanci-alt/teacher-os` |
| Deploy dalı | `main` — her push Vercel'de otomatik yayına girer |
| Çalışma dalı | `claude/supabase-pooler-check-k6378x` |
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
4. **Ancak ondan sonra** `main`'e merge edilir ve deploy tetiklenir.

Sıra ters olursa uygulama olmayan bir sütunu arar ve kırılır.

Uygulanmış bir `migration.sql` **asla** elle değiştirilmez; checksum tutmaz.
Veritabanının beklenen durumda olduğu `prisma/verify-state.sql` ile kontrol
edilir (kullanıcı SQL Editor'de çalıştırır, her satır "TAMAM" olmalı).

Prisma **6.19.3'te sabit**. Prisma 7 `url`/`directUrl` alanlarını
`schema.prisma`'dan kaldırdı; yükseltilirse şema geçersiz olur.

---

## Migration'lar (5)

```
20260821214524_init                    tablolar
20260822105533_harden_history_and_rls  RESTRICT silme kuralları + RLS
20260822235800_behavior_template       Teacher.behaviorTemplate + puan kısıtı gevşetildi
20260823144543_break_penalty           BreakPenalty tablosu
20260823174546_lesson_ended_at         Lesson.endedAt + eski dersler kapatıldı   ← BEKLİYOR
```

İlk dördü Supabase'de uygulandı ve `verify-state.sql` ile doğrulandı.

**Beşincisi henüz uygulanmadı.** `prisma/pending-sql-editor.sql` içeriği
Supabase SQL Editor'de çalıştırılmadan `main`'e merge edilmemeli; uygulama
olmayan bir sütunu arar ve kırılır. Migration mevcut derslerin hepsini
kapatır, yani öğretmen ilk kullanımda "Yeni ders başlat" der.

---

## Mimari

```
src/lib/
  prisma.ts           Prisma Client (tek örnek)
  session.ts          imzalı oturum çerezi (jose)
  auth.ts             parola hash (bcryptjs), oturum aç/kapat
  current-teacher.ts  oturumdaki öğretmen; yoksa /giris'e yönlendirir
  lesson.ts           aktif ders, ders başlat/bitir, ders geçmişi ve detayı
  behavior.ts         davranış kuralları + puan sabitleri (tek modül)
  penalty.ts          teneffüs cezası kuralları + kronometre durumu
  student-history.ts  öğrenci geçmişi ve dönem toplamları
  form-state.ts       form durumu tipi

src/app/
  page.tsx            sınıf listesi
  sinif/[id]/         sınıf detayı: ders, davranış düğmeleri, ceza rozeti
  sinif/[id]/dersler/ ders geçmişi ve tek dersin kayıtları
  ogrenci/[id]/       öğrenci: özet, not girme, geçmiş, cezalar
  ayarlar/            davranış şablonu seçimi
  giris/ kurulum/     oturum ekranları
  actions.ts          veri server action'ları
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

### Ders kuralı
Bir sınıfın bitmemiş dersi (`Lesson.endedAt` boş) aktif derstir. Sınıfın aynı
anda tek dersi olur; süren ders bitmeden yenisi başlatılamaz ve bitmiş derse
kayıt yazılamaz. Bu kontroller `lesson.ts` ve `behavior.ts` içinde, kaydın
yazıldığı en alt katmandadır.

---

## Testler

Sekiz arayüz testi, gerçek tarayıcıda (Playwright), toplam **207 kontrol**.
Hepsi geçiyor.

```
scripts/e2e-test.mjs             sınıf ve öğrenci ekleme          33
scripts/template-ui-test.mjs     şablonlar, elle not              25
scripts/behavior-ui-test.mjs     kart kuralları                   24
scripts/history-ui-test.mjs      öğrenci geçmişi                  16
scripts/auth-ui-test.mjs         giriş ve veri ayrımı             26
scripts/card-buttons-ui-test.mjs kart şablonunun üç düğmesi       24
scripts/penalty-ui-test.mjs      teneffüs cezası ve kronometre    22
scripts/lesson-ui-test.mjs       ders başlat/bitir, geçmiş, detay 37
```

`test-oturum.mjs` ve `test-ders.mjs` testlerin ortak adımlarıdır (giriş ve
ders başlatma); ayrı test değildirler.

### Çalıştırma (bulut oturumunda)

```bash
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
export SQL_KOMUTU='su postgres -c "'$PG_BIN'/psql -h 127.0.0.1 -p 15432 -U postgres -d teacheros -q -tA"'

# 4. Her testten önce veritabanı temizlenir
node scripts/<test>.mjs
```

`auth-ui-test`, `penalty-ui-test` ve `lesson-ui-test` doğrudan SQL yazar;
`SQL_KOMUTU` tanımlı olmalı. Testler veri yazar — **üretim veritabanına karşı
çalıştırılmaz.**

---

## Durum

**Bitti:** veritabanı temeli, giriş sistemi ve veri ayrımı, sınıf/öğrenci
yönetimi, davranış şablonları (basit +/− ve kart sistemi), sarı/kırmızı kart,
performans puanı, öğrenci geçmişi, teneffüs cezası ve kronometre, ders
yönetimi (başlat/bitir, ders geçmişi, ders detayı).

**Kurulum tamamlandı** — canlıda hesap mevcut, `/kurulum` kapalı.

v0.1 canlıda gerçek kullanımla doğrulandı: kırmızı kart ceza üretiyor, ⏱
rozeti çıkıyor ve kronometre çalışıyor.

**Sırada:** beşinci migration'ın Supabase'de çalıştırılması, sonra ders
yönetiminin canlıda doğrulanması. Ardından v0.2'nin kalanı: kullanım deneyimi
ve arayüz tasarımı. Arayüz şu ana kadar bilerek sade tutuldu.

---

## Çalışma yöntemi

`CLAUDE.md`'deki akışa uyulur: **incele → planla → onay al → uygula →
test et → kısa rapor ver.** Kullanıcı Türkçe konuşur ve onay almadan işlem
yapılmasını istemez. Kritik değişikliklerde önce neden ve çözüm anlatılır.

Kullanıcı tablet üzerinden çalışır; yerel bilgisayarı yoktur. Doğrulama
canlı deployment üzerinden yapılır.
