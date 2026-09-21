// Sınıf gelişimi: son iki dönem, sınıf sayfasında ve sınıf raporunda.
//
// Testin can alıcı noktaları:
//   - Birim ÖĞRENCİ BAŞINA DERS BAŞINA. Ham sayı ve ders sayısı aynı kalıp
//     yalnızca mevcut değişseydi bile sayı değişmeli; test bunu iki sınıfı
//     karşılaştırarak gösterir.
//   - Sınıf sayfasındaki blok ile rapordaki blok AYNI sayıları vermeli
//     (rapor varsayılan dönemde açıldığında).
//   - Kilitli tahtada blok HİÇ çıkmamalı: yönetim bilgisi.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. npm run build && npm start
//   3. npm install --no-save playwright
//   4. SQL_KOMUTU='psql "$DATABASE_URL" -q -tA' node scripts/class-progress-ui-test.mjs
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import { oturumHazirla } from "./test-oturum.mjs";
import { ogrenciFormunuAc } from "./test-form.mjs";

const T = process.env.TEMEL_ADRES ?? "http://127.0.0.1:3000";
let gecti = 0, kaldi = 0;
function ok(ad, kosul, ayrinti = "") {
  if (kosul) { gecti++; console.log(`  GECTI  ${ad}`); }
  else { kaldi++; console.log(`  KALDI  ${ad}${ayrinti ? "  -> " + ayrinti : ""}`); }
}

const SQL_KOMUTU = process.env.SQL_KOMUTU ?? 'psql "$DATABASE_URL" -q -tA';
const sql = (m) => execSync(SQL_KOMUTU, { input: m, shell: "/bin/bash" }).toString().trim();

const D1 = "2025-11-15";  // 2025-2026 · 1. donem
const D2 = "2026-04-15";  // 2025-2026 · 2. donem

const tarayici = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
const sayfa = await (await tarayici.newContext({ viewport: { width: 1024, height: 900 } })).newPage();
await oturumHazirla(sayfa, T);

async function bekle(metin) {
  await sayfa.waitForFunction((m) => document.body.innerText.includes(m), metin, { timeout: 10000 });
}
async function govde() { return sayfa.innerText("body"); }
async function olcuSatiri(etiket) {
  const li = sayfa.locator(".gelisim-satir").filter({ hasText: etiket });
  if ((await li.count()) === 0) return null;
  return (await li.first().innerText()).replace(/\s+/g, " ").trim();
}
async function okSinifi(etiket) {
  const li = sayfa.locator(".gelisim-satir").filter({ hasText: etiket });
  if ((await li.count()) === 0) return null;
  return await li.first().locator(".gelisim-ok").getAttribute("class");
}

/** Bir sınıf açar, öğrencilerini ekler, id'sini döndürür. */
async function sinifKur(ad, ogrenciAdlari) {
  await sayfa.goto(T, { waitUntil: "networkidle" });
  await sayfa.getByLabel("Sınıf adı").fill(ad);
  await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
  await bekle(ad);
  await sayfa.getByRole("link", { name: new RegExp(ad) }).click();
  await sayfa.waitForURL(/\/sinif\//, { timeout: 10000 });
  const id = new URL(sayfa.url()).pathname.split("/").pop();
  for (const isim of ogrenciAdlari) {
    await ogrenciFormunuAc(sayfa);
    await sayfa.getByLabel("Ad", { exact: true }).fill(isim);
    await sayfa.getByLabel("Soyad").fill("Ogrenci");
    await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
    await bekle(isim);
  }
  return id;
}

// --- Kurulum ---
console.log("\nKurulum");
// A sinifi: 2 ogrenci. B sinifi: 4 ogrenci. Ayni ders sayisi, AYNI ham yildiz.
// Ogrenci basina bolunmeseydi ikisi ayni gorunurdu.
const A = await sinifKur("Gel-A", ["Ali", "Ayse"]);
const B = await sinifKur("Gel-B", ["Bora", "Buse", "Berk", "Bade"]);
const OGRETMEN = sql(`SELECT id FROM "Teacher" ORDER BY "createdAt" ASC LIMIT 1;`);

for (const [sinifId, onek] of [[A, "ga"], [B, "gb"]]) {
  sql(`
    INSERT INTO "Lesson" (id,"classroomId",date,"endedAt","createdAt")
    SELECT '${onek}d1-'||g,'${sinifId}','${D1}'::timestamp + (g||' days')::interval,
           '${D1}'::timestamp + (g||' days')::interval, now() FROM generate_series(1,10) g;
    INSERT INTO "Lesson" (id,"classroomId",date,"endedAt","createdAt")
    SELECT '${onek}d2-'||g,'${sinifId}','${D2}'::timestamp + (g||' days')::interval,
           '${D2}'::timestamp + (g||' days')::interval, now() FROM generate_series(1,10) g;
  `);
}

// A sinifi (2 ogrenci, 10 ders/donem):
//   1. donem 20 yildiz -> 20/(10*2) = 1.0
//   2. donem 30 yildiz -> 30/(10*2) = 1.5   YUKSELDI
const ALI = sql(`SELECT id FROM "Student" WHERE "firstName"='Ali';`);
sql(`
  INSERT INTO "BehaviorLog" (id,"studentId","teacherId","classroomId","lessonId",type,points,"createdAt")
  SELECT 'ga1-'||g,'${ALI}','${OGRETMEN}','${A}','gad1-1','PLUS',1,'${D1}'::timestamp
  FROM generate_series(1,20) g;
  INSERT INTO "BehaviorLog" (id,"studentId","teacherId","classroomId","lessonId",type,points,"createdAt")
  SELECT 'ga2-'||g,'${ALI}','${OGRETMEN}','${A}','gad2-1','PLUS',1,'${D2}'::timestamp
  FROM generate_series(1,30) g;
`);

// B sinifi (4 ogrenci, 10 ders/donem): A ile AYNI ham sayilar.
//   1. donem 20 yildiz -> 20/(10*4) = 0.5
//   2. donem 30 yildiz -> 30/(10*4) = 0.75
// Ham sayi ayni oldugu halde A'nin degerleri B'ninkinin iki kati cikmali.
const BORA = sql(`SELECT id FROM "Student" WHERE "firstName"='Bora';`);
sql(`
  INSERT INTO "BehaviorLog" (id,"studentId","teacherId","classroomId","lessonId",type,points,"createdAt")
  SELECT 'gb1-'||g,'${BORA}','${OGRETMEN}','${B}','gbd1-1','PLUS',1,'${D1}'::timestamp
  FROM generate_series(1,20) g;
  INSERT INTO "BehaviorLog" (id,"studentId","teacherId","classroomId","lessonId",type,points,"createdAt")
  SELECT 'gb2-'||g,'${BORA}','${OGRETMEN}','${B}','gbd2-1','PLUS',1,'${D2}'::timestamp
  FROM generate_series(1,30) g;
`);

// A sinifinda eksi: 1. donem 12 -> 0.6 ; 2. donem 2 -> 0.1  IYILESME
sql(`
  INSERT INTO "BehaviorLog" (id,"studentId","teacherId","classroomId","lessonId",type,points,"createdAt")
  SELECT 'gae1-'||g,'${ALI}','${OGRETMEN}','${A}','gad1-1','MINUS',-5,'${D1}'::timestamp
  FROM generate_series(1,12) g;
  INSERT INTO "BehaviorLog" (id,"studentId","teacherId","classroomId","lessonId",type,points,"createdAt")
  SELECT 'gae2-'||g,'${ALI}','${OGRETMEN}','${A}','gad2-1','MINUS',-5,'${D2}'::timestamp
  FROM generate_series(1,2) g;
`);
ok("Kurulum: A sinifinda 64 davranis", sql(`SELECT count(*) FROM "BehaviorLog" WHERE "classroomId"='${A}';`) === "64");
ok("Kurulum: B sinifinda 50 davranis", sql(`SELECT count(*) FROM "BehaviorLog" WHERE "classroomId"='${B}';`) === "50");
ok("Kurulum: A'da 2 ogrenci", sql(`SELECT count(*) FROM "Student" WHERE "classroomId"='${A}';`) === "2");
ok("Kurulum: B'de 4 ogrenci", sql(`SELECT count(*) FROM "Student" WHERE "classroomId"='${B}';`) === "4");

// --- A. Sinif sayfasinda gelisim blogu ---
console.log("\nA. Sinif sayfasi");
await sayfa.goto(`${T}/sinif/${A}`, { waitUntil: "networkidle" });
{
  const g = await govde();
  ok("Gelisim blogu var", g.includes("Gelişim"));
  ok("Iki donem karsilastiriliyor",
     g.includes("2025-2026 · 1. dönem →"), "gelisim basligi");
  ok("Birim 'ders başına öğrenci'", g.includes("ders başına öğrenci"),
     "sinif kapsaminda ogrenci sayisina da bolunmeli");
  ok("Ogrenci kapsaminin birimi kullanilmiyor",
     !/\(ders başına\)/.test(g), "sinifta '(ders başına)' yazmamali");
}

// --- B. Ogrenci basina normallestirme (asil kontrol) ---
console.log("\nB. Ogrenci basina normallestirme");
{
  const satir = await olcuSatiri("Yıldız");
  const artiSatiri = satir ?? (await olcuSatiri("Artı"));
  ok("Yildiz/arti satiri var", artiSatiri !== null, String(artiSatiri));
  ok("A sinifinda 1 → 1.5", artiSatiri?.includes("1 → 1.5"), String(artiSatiri));
  ok("Ham sayilar da yaziyor (20 → 30)", artiSatiri?.includes("20 → 30"), String(artiSatiri));
  ok("Ogrenci sayisi ayrintida", artiSatiri?.includes("2 öğrenci"), String(artiSatiri));
  ok("Yildiz artisi IYI", (await okSinifi("Yıldız") ?? await okSinifi("Artı"))?.includes("gelisim-iyi"));
}
{
  const eksi = await olcuSatiri("Eksi");
  ok("Eksi 0.6 → 0.1", eksi?.includes("0.6 → 0.1"), String(eksi));
  ok("Eksi azalisi IYI (yesil)", (await okSinifi("Eksi"))?.includes("gelisim-iyi"));
}

// Ayni ham sayilarla 4 ogrencili sinif YARIYI gostermeli.
await sayfa.goto(`${T}/sinif/${B}`, { waitUntil: "networkidle" });
{
  const artiSatiri = (await olcuSatiri("Yıldız")) ?? (await olcuSatiri("Artı"));
  ok("B sinifinda ham sayilar AYNI (20 → 30)", artiSatiri?.includes("20 → 30"), String(artiSatiri));
  ok(
    "Ama deger YARISI: 0.5 → 0.75",
    artiSatiri?.includes("0.5 → 0.75"),
    "ogrenci sayisina bolunmeseydi A ile ayni cikardi",
  );
  ok("Ogrenci sayisi 4 yaziyor", artiSatiri?.includes("4 öğrenci"), String(artiSatiri));
}

// --- C. Rapordaki blok ayni sayilari verir ---
console.log("\nC. Raporla tutarlilik");
await sayfa.goto(`${T}/sinif/${A}/rapor`, { waitUntil: "networkidle" });
{
  const g = await govde();
  ok("Raporda gelisim blogu var", g.includes("Gelişim"));
  const artiSatiri = (await olcuSatiri("Yıldız")) ?? (await olcuSatiri("Artı"));
  ok("Raporda da 1 → 1.5", artiSatiri?.includes("1 → 1.5"), String(artiSatiri));
  ok("Raporda da 'ders başına öğrenci'", g.includes("ders başına öğrenci"));
}

// --- D. Rapor gecmis donemde ok uydurmaz ---
console.log("\nD. Gecmis donem");
await sayfa.goto(`${T}/sinif/${A}/rapor?donem=2025-1`, { waitUntil: "networkidle" });
{
  const g = await govde();
  ok("1. donem secili", g.includes("2025-2026 · 1. dönem"));
  ok("Oncesi olmadigi icin uyari", g.includes("en az iki dönem gerekir"),
     "ilk donem kendisiyle kiyaslanamaz");
  ok("Ok hic yok", (await sayfa.locator(".gelisim-ok").count()) === 0);
}

// --- E. Kilitli tahtada blok cikmaz ---
console.log("\nE. Kilitli tahta");
await sayfa.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
{
  const pinFormu = sayfa.locator("form").filter({ has: sayfa.getByLabel("Hesap parolanız") });
  await pinFormu.getByLabel("Hesap parolanız").fill("uzunparola1");
  await pinFormu.getByLabel(/tahta PIN'i|Tahta PIN'i/).first().fill("2468");
  await pinFormu.getByLabel("PIN tekrar").fill("2468");
  await pinFormu.getByRole("button", { name: /PIN'i (belirle|değiştir)/ }).click();
  await sayfa.waitForSelector(".basari", { timeout: 10000 });
}
await sayfa.goto(`${T}/sinif/${A}`, { waitUntil: "networkidle" });
await sayfa.getByRole("button", { name: /Bu cihazı kilitle/ }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Tahta kilitli"), null, { timeout: 10000 });
{
  const g = await govde();
  ok("Kilitli tahtada gelisim blogu YOK", !g.includes("Gelişim"), "yonetim bilgisi");
  ok("Kilitli tahtada ok da yok", (await sayfa.locator(".gelisim-ok").count()) === 0);
}

console.log(`\n${gecti} gecti, ${kaldi} kaldi`);
await tarayici.close();
process.exit(kaldi === 0 ? 0 : 1);
