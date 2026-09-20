// Sınıf raporu: tüm sınıfın dönemlik dökümü, öğrenci başına bir satır.
//
// Testin can alıcı noktaları:
//   - Sıralama ALFABETİK, başarıya göre değil. Kâğıda dökülen bir belgede
//     başarı sırası bir sıralama tablosuna dönüşürdü.
//   - "Dikkat gereken öğrenciler" listesi rapora GİRMEMELİ.
//   - Sınıf ödev oranı öğrenci oranlarının ortalaması DEĞİL, bütün
//     teslimlerin oranı: tek ödevi olup onu yapan bir öğrenci sınıf oranını
//     olduğundan iyi gösteremez.
//   - Yazdırma ölçülür, tahmin edilmez.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. npm run build && npm start
//   3. npm install --no-save playwright
//   4. SQL_KOMUTU='psql "$DATABASE_URL" -q -tA' node scripts/class-report-ui-test.mjs
import { execSync } from "node:child_process";
import bcrypt from "bcryptjs";
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
/** Tablodaki öğrenci adları, ekrandaki sırayla. */
async function tabloAdlari() {
  return sayfa.locator(".rapor-tablo tbody tr th").allInnerTexts();
}
async function ogrenciSatiri(ad) {
  const tr = sayfa.locator(".rapor-tablo tbody tr").filter({ hasText: ad });
  if ((await tr.count()) === 0) return null;
  return (await tr.first().innerText()).replace(/\s+/g, " ").trim();
}

// --- Kurulum ---
console.log("\nKurulum");
await sayfa.goto(T, { waitUntil: "networkidle" });
await sayfa.getByLabel("Sınıf adı").fill("SRapor-5A");
await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
await bekle("SRapor-5A");
await sayfa.getByRole("link", { name: /SRapor-5A/ }).click();
await sayfa.waitForURL(/\/sinif\//, { timeout: 10000 });
const SINIF_URL = sayfa.url();
const SINIF_ID = new URL(SINIF_URL).pathname.split("/").pop();

// Ekleme sirasi BILEREK alfabetik degil: siralamanin gercekten yapildigini
// gormek icin. Zeynep once, Ahmet sonra.
for (const [a, b] of [["Zeynep", "Son"], ["Ahmet", "Ilk"], ["Mehmet", "Orta"]]) {
  await ogrenciFormunuAc(sayfa);
  await sayfa.getByLabel("Ad", { exact: true }).fill(a);
  await sayfa.getByLabel("Soyad").fill(b);
  await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
  await bekle(a);
}
const ogr = (ad) => sql(`SELECT id FROM "Student" WHERE "firstName"='${ad}';`);
const ZEYNEP = ogr("Zeynep"), AHMET = ogr("Ahmet"), MEHMET = ogr("Mehmet");
const OGRETMEN = sql(`SELECT id FROM "Teacher" ORDER BY "createdAt" ASC LIMIT 1;`);

sql(`
  INSERT INTO "Lesson" (id,"classroomId",date,"endedAt","createdAt")
  SELECT 'sd1-'||g,'${SINIF_ID}','${D1}'::timestamp + (g||' days')::interval,
         '${D1}'::timestamp + (g||' days')::interval, now() FROM generate_series(1,8) g;
  INSERT INTO "Lesson" (id,"classroomId",date,"endedAt","createdAt")
  SELECT 'sd2-'||g,'${SINIF_ID}','${D2}'::timestamp + (g||' days')::interval,
         '${D2}'::timestamp + (g||' days')::interval, now() FROM generate_series(1,12) g;

  -- 2. donem: Zeynep 5 arti, Ahmet 2 arti + 3 eksi, Mehmet hic
  INSERT INTO "BehaviorLog" (id,"studentId","teacherId","classroomId","lessonId",type,points,"createdAt")
  SELECT 'sz-'||g,'${ZEYNEP}','${OGRETMEN}','${SINIF_ID}','sd2-1','PLUS',1,'${D2}'::timestamp
  FROM generate_series(1,5) g;
  INSERT INTO "BehaviorLog" (id,"studentId","teacherId","classroomId","lessonId",type,points,"createdAt")
  SELECT 'sa-'||g,'${AHMET}','${OGRETMEN}','${SINIF_ID}','sd2-1','PLUS',1,'${D2}'::timestamp
  FROM generate_series(1,2) g;
  INSERT INTO "BehaviorLog" (id,"studentId","teacherId","classroomId","lessonId",type,points,"createdAt")
  SELECT 'sae-'||g,'${AHMET}','${OGRETMEN}','${SINIF_ID}','sd2-1','MINUS',-5,'${D2}'::timestamp
  FROM generate_series(1,3) g;
  -- 1. donemde yalnizca Mehmet'in kaydi: donem secimi sinanabilsin
  INSERT INTO "BehaviorLog" (id,"studentId","teacherId","classroomId","lessonId",type,points,"createdAt")
  SELECT 'sm1-'||g,'${MEHMET}','${OGRETMEN}','${SINIF_ID}','sd1-1','PLUS',1,'${D1}'::timestamp
  FROM generate_series(1,7) g;

  -- Sinav: 2. donemde Zeynep 90, Ahmet 50. Mehmet girmedi.
  INSERT INTO "Exam" (id,"teacherId",title,"examDate","maxScore",scope,"createdAt")
  VALUES ('ss2','${OGRETMEN}','Ikinci donem yazilisi','${D2}',100,'OFFICIAL',now());
  INSERT INTO "ExamResult" (id,"examId","studentId",score,"isAbsent","createdAt")
  VALUES ('sr1','ss2','${ZEYNEP}',90,false,now()),
         ('sr2','ss2','${AHMET}',50,false,now());

  -- Odev: 2. donemde Zeynep'e 4 odev (3 yapildi), Ahmet'e 1 odev (yapildi).
  -- Sinif orani teslim bazli olmali: 4/5 = %80. Ogrenci oranlarinin
  -- ortalamasi alinsaydi (75 + 100) / 2 = %88 cikardi.
  INSERT INTO "Assignment" (id,"teacherId",title,"dueDate","isActive","createdAt","updatedAt")
  SELECT 'so-'||g,'${OGRETMEN}','Odev '||g,'${D2}'::timestamp,true,now(),now()
  FROM generate_series(1,4) g;
  INSERT INTO "Submission" (id,"assignmentId","studentId",status,"updatedAt")
  SELECT 'sz-t'||g,'so-'||g,'${ZEYNEP}',
         (CASE WHEN g=4 THEN 'MISSING' ELSE 'DONE' END)::"SubmissionStatus",now()
  FROM generate_series(1,4) g;
  INSERT INTO "Submission" (id,"assignmentId","studentId",status,"updatedAt")
  VALUES ('sa-t1','so-1','${AHMET}','DONE',now());
`);
// Kurulum SQL'i sessizce dusmus olmasin.
ok("Kurulum: 20 ders", sql(`SELECT count(*) FROM "Lesson" WHERE "classroomId"='${SINIF_ID}';`) === "20");
ok("Kurulum: 17 davranis", sql(`SELECT count(*) FROM "BehaviorLog" WHERE "classroomId"='${SINIF_ID}';`) === "17");
ok("Kurulum: 5 teslim", sql(`SELECT count(*) FROM "Submission";`) === "5");

// --- A. Sinif sayfasindan rapora gidis ---
console.log("\nA. Rapora gidis");
await sayfa.goto(SINIF_URL, { waitUntil: "networkidle" });
ok("Sinif sayfasinda Rapor baglantisi var", (await sayfa.getByRole("link", { name: /^Rapor/ }).count()) === 1);
await sayfa.getByRole("link", { name: /^Rapor/ }).click();
await sayfa.waitForURL(/\/sinif\/[^/]+\/rapor$/, { timeout: 10000 });
ok("Sinif raporu acildi", /\/sinif\/[^/]+\/rapor$/.test(sayfa.url()), sayfa.url());

// --- B. Alfabetik siralama (asil kontrol) ---
console.log("\nB. Alfabetik siralama");
{
  const adlar = await tabloAdlari();
  ok("Uc ogrenci de tabloda", adlar.length === 3, JSON.stringify(adlar));
  ok(
    "Alfabetik sirali (ekleme sirasi Zeynep, Ahmet, Mehmet'ti)",
    adlar.join("|") === "Ahmet Ilk|Mehmet Orta|Zeynep Son",
    JSON.stringify(adlar),
  );
  // En yuksek karne Zeynep'te; basariya gore siralansaydi o basta olurdu.
  ok("Basari sirasi DEGIL", adlar[0] !== "Zeynep Son", "alfabetik olmali");
}

// --- C. Sayilar dogru ve doneme bagli ---
console.log("\nC. Sayilar");
{
  const g = await govde();
  ok("En yeni donem secili", g.includes("2025-2026 · 2. dönem"), g.slice(0, 160));
  ok("Ogrenci sayisi 3", /3\s*\n?\s*öğrenci/.test(g));
  ok("2. donem ders sayisi 12", /12\s*\n?\s*ders/.test(g), "1. donemin 8 dersi sayilmamali");

  const zeynep = await ogrenciSatiri("Zeynep");
  ok("Zeynep 5 arti", zeynep?.includes(" 5 "), String(zeynep));
  ok("Zeynep karne %90", zeynep?.includes("%90"), String(zeynep));
  ok("Zeynep odev %75", zeynep?.includes("%75"), String(zeynep));

  const ahmet = await ogrenciSatiri("Ahmet");
  ok("Ahmet karne %50", ahmet?.includes("%50"), String(ahmet));
  ok("Ahmet odev %100", ahmet?.includes("%100"), String(ahmet));

  const mehmet = await ogrenciSatiri("Mehmet");
  ok("Mehmet'in 2. donemde verisi yok, tire", (mehmet?.match(/—/g) ?? []).length >= 2, String(mehmet));
}

// --- D. Sinif odev orani TESLIM bazli ---
console.log("\nD. Sinif odev orani");
{
  const g = await govde();
  // 5 teslimin 4'u yapildi = %80. Ogrenci oranlarinin ortalamasi %88 olurdu.
  ok(
    "Sinif odev orani %80 (teslim bazli)",
    g.includes("%80"),
    "ogrenci oranlarinin ortalamasi alinsaydi %88 cikardi",
  );
  ok("Yanlis hesap (%88) gorunmuyor", !g.includes("%88"));
  // Sinif karne ortalamasi: (90 + 50) / 2 = %70
  ok("Sinif karne ortalamasi %70", g.includes("%70"));
}

// --- E. Dikkat listesi rapora GIRMEMELI ---
console.log("\nE. Dikkat listesi yok");
{
  const g = await govde();
  ok("'Dikkat gereken' ifadesi raporda YOK", !g.includes("Dikkat gereken"),
     "rapor bir dokum, degerlendirme degil");
}

// --- F. Donem secimi ---
console.log("\nF. Donem secimi");
{
  ok("Donem secici var", (await sayfa.locator(".rapor-donem-secici select").count()) === 1);
  await sayfa.selectOption(".rapor-donem-secici select", "2025-1");
  // ADRESI bekle, metni DEGIL: donem etiketleri <select> secenekleri olarak
  // zaten sayfada, `innerText` onlari da doner ve "1. donem yaziyor mu"
  // beklemesi aninda gecer -- test henuz yonlendirme bitmeden olcum yapar.
  // (HANDOFF'taki "ekranda zaten dogru olan metni bekleme" tuzagi.)
  await sayfa.waitForURL(/donem=2025-1/, { timeout: 10000 });
  await sayfa.waitForLoadState("networkidle");
  const g = await govde();
  ok("Adres donemi tasiyor", sayfa.url().includes("donem=2025-1"), sayfa.url());
  ok("1. donem ders sayisi 8", /8\s*\n?\s*ders/.test(g));
  const mehmet = await ogrenciSatiri("Mehmet");
  ok("1. donemde Mehmet'in 7 artisi gorunuyor", mehmet?.includes(" 7 "), String(mehmet));
  const zeynep = await ogrenciSatiri("Zeynep");
  ok("1. donemde Zeynep'in karnesi tire", zeynep?.includes("—"), String(zeynep));
  ok("Alfabetik siralama korunuyor", (await tabloAdlari()).join("|") === "Ahmet Ilk|Mehmet Orta|Zeynep Son");
}

// --- G. Yazdirma ---
console.log("\nG. Yazdirma");
await sayfa.goto(`${T}/sinif/${SINIF_ID}/rapor`, { waitUntil: "networkidle" });
{
  await sayfa.evaluate(() => {
    window.__yazdirmaSayaci = 0;
    window.print = () => { window.__yazdirmaSayaci += 1; };
  });
  await sayfa.getByRole("button", { name: /Yazdır/ }).click();
  ok("Yazdir dugmesi window.print cagirdi",
     (await sayfa.evaluate(() => window.__yazdirmaSayaci ?? 0)) === 1);

  await sayfa.emulateMedia({ media: "print" });
  ok("Yazdirmada arac cubugu GIZLI",
     !(await sayfa.locator(".rapor-araclar").isVisible().catch(() => false)));
  ok("Yazdirmada ust menu GIZLI",
     !(await sayfa.locator(".ust-menu").isVisible().catch(() => false)));
  ok("Yazdirmada sinif adi DURUYOR",
     await sayfa.getByRole("heading", { name: "SRapor-5A" }).isVisible());
  ok("Yazdirmada ogrenci tablosu duruyor", (await tabloAdlari()).length === 3);
  await sayfa.emulateMedia({ media: "screen" });
}

// --- H. Kart sablonunda sutunlar degisir ---
console.log("\nH. Kart sablonu");
await sayfa.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
await sayfa.getByRole("radio", { name: /Kart sistemi/ }).check();
await sayfa.locator(".sablon-formu").getByRole("button", { name: "Kaydet" }).click();
await sayfa.waitForSelector(".basari", { timeout: 10000 });
await sayfa.goto(`${T}/sinif/${SINIF_ID}/rapor`, { waitUntil: "networkidle" });
{
  const g = await govde();
  ok("Kart sablonunda 'Yıldız' sutunu", g.includes("Yıldız"));
  ok("Kart sablonunda 'Sarı' ve 'Kırmızı' sutunlari", g.includes("Sarı") && g.includes("Kırmızı"));
  ok("Basit sablonun 'Eksi' sutunu gitti", !g.includes("Eksi"));
  ok("Alfabetik siralama korunuyor", (await tabloAdlari()).join("|") === "Ahmet Ilk|Mehmet Orta|Zeynep Son");
}

// --- I. Ogretmen ayrimi ---
console.log("\nI. Ogretmen ayrimi");
{
  const hash = bcrypt.hashSync("ikinci-parola-123", 12);
  sql(`
    INSERT INTO "Teacher" (id,email,name,"passwordHash","createdAt")
    VALUES ('t-srapor','ikinci-srapor@ornek.com','Ikinci Ogretmen','${hash}',now());
  `);
  const ikinciB = await tarayici.newContext();
  const ikinci = await ikinciB.newPage();
  await ikinci.goto(`${T}/giris`, { waitUntil: "networkidle" });
  await ikinci.getByLabel("E-posta").fill("ikinci-srapor@ornek.com");
  await ikinci.getByLabel("Parola").fill("ikinci-parola-123");
  await ikinci.getByRole("button", { name: "Giriş yap" }).click();
  await ikinci.waitForURL(`${T}/`, { timeout: 20000 });

  const yanit = await ikinci.goto(`${T}/sinif/${SINIF_ID}/rapor`, { waitUntil: "networkidle" });
  ok("Baskasinin sinif raporu 404", yanit?.status() === 404, String(yanit?.status()));
  ok("Ogrenci adlari sizmadi", !(await ikinci.innerText("body")).includes("Zeynep"));
  await ikinciB.close();
}

console.log(`\n${gecti} gecti, ${kaldi} kaldi`);
await tarayici.close();
process.exit(kaldi === 0 ? 0 : 1);
