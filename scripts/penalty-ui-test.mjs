// Teneffüs cezası ve kronometre testi: süre ilerlemesi (2/3/5), temiz ders
// sonrası sıfırlanma, elle süre ekleme/çıkarma/ayarlama ve erken bitirme.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. SESSION_SECRET tanımlı olacak şekilde: npm run build && npm start
//   3. npm install --no-save playwright
//   4. SQL_KOMUTU='psql "$DATABASE_URL" -q -tA' node scripts/penalty-ui-test.mjs
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import { oturumHazirla } from "./test-oturum.mjs";

const T = process.env.TEMEL_ADRES ?? "http://127.0.0.1:3000";
const SQL_KOMUTU = process.env.SQL_KOMUTU ?? 'psql "$DATABASE_URL" -q -tA';
const sql = (m) => execSync(SQL_KOMUTU, { input: m, shell: "/bin/bash" }).toString().trim();

let gecti = 0, kaldi = 0;
function ok(ad, kosul, ayrinti = "") {
  if (kosul) { gecti++; console.log(`  GECTI  ${ad}`); }
  else { kaldi++; console.log(`  KALDI  ${ad}${ayrinti ? "  -> " + ayrinti : ""}`); }
}

const tarayici = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
const sayfa = await tarayici.newPage();
await oturumHazirla(sayfa, T);

const satir = (ad) => sayfa.locator("li").filter({ hasText: ad });
const rozet = (ad) => satir(ad).getByRole("button", { name: /Teneffüs cezası/ });
async function metin(ad) { return satir(ad).evaluate((e) => e.innerText); }
async function bas(ad, etiket) {
  const onceki = await metin(ad);
  await satir(ad).getByRole("button", { name: etiket }).click();
  await sayfa.waitForFunction(([n, x]) => {
    const e = [...document.querySelectorAll("li")].find((q) => q.innerText.includes(n));
    return e && e.innerText !== x;
  }, [ad, onceki], { timeout: 10000 });
  await sayfa.waitForTimeout(400);
}
async function dersBaslat() {
  const o = await sayfa.textContent("body");
  await sayfa.getByRole("button", { name: "Yeni ders başlat" }).click();
  await sayfa.waitForFunction((x) => document.body.innerText !== x, o, { timeout: 10000 });
  await sayfa.waitForTimeout(400);
}
const cezaSaniye = (ad) =>
  sql(`SELECT COALESCE((SELECT p.seconds FROM "BreakPenalty" p
       JOIN "Student" s ON s.id=p."studentId"
       WHERE s."firstName"='${ad}' AND p."completedAt" IS NULL), -1);`);

// --- A: Hazirlik ---
console.log("\nA. Hazirlik");
await sayfa.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
await sayfa.getByRole("radio", { name: /Kart sistemi/ }).check();
await sayfa.getByRole("button", { name: "Kaydet" }).click();
await sayfa.waitForSelector(".basari", { timeout: 10000 });
await sayfa.goto(T, { waitUntil: "networkidle" });
await sayfa.getByLabel("Sınıf adı").fill("Ceza-Test");
await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Ceza-Test"), null, { timeout: 10000 });
await sayfa.getByRole("link", { name: /Ceza-Test/ }).click();
await sayfa.getByRole("heading", { name: "Ceza-Test" }).waitFor();
for (const [a, b] of [["Arda", "Bir"], ["Berk", "Iki"]]) {
  await sayfa.getByLabel("Ad", { exact: true }).fill(a);
  await sayfa.getByLabel("Soyad").fill(b);
  await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
  await sayfa.waitForFunction((x) => document.body.innerText.includes(x), a, { timeout: 10000 });
}
await dersBaslat();
ok("Baslangicta ceza yok", (await rozet("Arda").count()) === 0);

// --- B: Sari kart ceza uretmiyor ---
console.log("\nB. Sari kart");
await bas("Arda", "Sarı kart ver");
ok("Sari kart ceza URETMEDI", (await rozet("Arda").count()) === 0);

// --- C: 1. kirmizi -> 2 dk ---
console.log("\nC. Ilk kirmizi kart");
await bas("Arda", "Kırmızı kart ver");
ok("Ceza rozeti geldi", (await rozet("Arda").count()) === 1);
ok("Ilk kirmizi 2 dakika", cezaSaniye("Arda") === "120", `saniye=${cezaSaniye("Arda")}`);
ok("Rozette 2 dk yaziyor", (await rozet("Arda").innerText()).includes("2 dk"), await rozet("Arda").innerText());

// --- D: 2. kirmizi -> +3 dk (toplam 5) ---
console.log("\nD. Ikinci kirmizi (ayni ders)");
await bas("Arda", "Kırmızı kart ver");
ok("Ikinci kirmizi 3 dakika ekledi", cezaSaniye("Arda") === "300", `saniye=${cezaSaniye("Arda")}`);

// --- E: 3. kirmizi -> +5 dk (toplam 10) ---
console.log("\nE. Ucuncu kirmizi");
await bas("Arda", "Kırmızı kart ver");
ok("Ucuncu kirmizi 5 dakika ekledi", cezaSaniye("Arda") === "600", `saniye=${cezaSaniye("Arda")}`);
await bas("Arda", "Kırmızı kart ver");
ok("Dorduncu de 5 dakika (tavan)", cezaSaniye("Arda") === "900", `saniye=${cezaSaniye("Arda")}`);

// --- F: Elle sure kontrolu ---
console.log("\nF. Elle sure kontrolu");
await rozet("Arda").click();
await sayfa.waitForSelector(".ceza-panel", { timeout: 5000 });
await sayfa.getByRole("button", { name: "+1 dk" }).click();
await sayfa.waitForTimeout(1500);
ok("+1 dk ekledi", cezaSaniye("Arda") === "960", `saniye=${cezaSaniye("Arda")}`);
ok("Panel ACIK KALDI", await sayfa.locator(".ceza-panel").isVisible());

await sayfa.getByRole("button", { name: "−1 dk" }).click();
await sayfa.waitForTimeout(1500);
ok("-1 dk cikardi", cezaSaniye("Arda") === "900", `saniye=${cezaSaniye("Arda")}`);
await sayfa.getByRole("button", { name: "−1 dk" }).click();
await sayfa.waitForTimeout(1500);
ok("Panel kapanmadan ikinci kez basilabildi", cezaSaniye("Arda") === "840", `saniye=${cezaSaniye("Arda")}`);

await sayfa.getByLabel("Süreyi dakika olarak ayarla").fill("3");
await sayfa.getByRole("button", { name: "Süreyi ayarla" }).click();
await sayfa.waitForTimeout(1500);
ok("Sure 3 dakikaya ayarlandi", cezaSaniye("Arda") === "180", `saniye=${cezaSaniye("Arda")}`);

// --- G: Kronometre ---
console.log("\nG. Kronometre");
await sayfa.getByRole("button", { name: "Başlat", exact: true }).click();
await sayfa.waitForTimeout(2500);
const basladi = sql(`SELECT ("startedAt" IS NOT NULL) FROM "BreakPenalty" p
  JOIN "Student" s ON s.id=p."studentId" WHERE s."firstName"='Arda' AND p."completedAt" IS NULL;`);
ok("Baslangic zamani veritabanina yazildi", basladi === "t", `deger=${basladi}`);
const rozetMetni = await rozet("Arda").innerText();
ok("Rozet geri sayima gecti", /\d+:\d{2}/.test(rozetMetni), rozetMetni);

await sayfa.reload({ waitUntil: "networkidle" });
await sayfa.waitForTimeout(500);
const yenidenMetin = await rozet("Arda").innerText();
ok("Yenilemeden sonra kaldigi yerden devam", /2:\d{2}/.test(yenidenMetin), yenidenMetin);

// --- H: Erken bitirme ---
console.log("\nH. Erken bitirme");
await rozet("Arda").click();
await sayfa.waitForSelector(".ceza-panel", { timeout: 5000 });
await sayfa.getByRole("button", { name: "Bitir" }).click();
await sayfa.waitForTimeout(1800);
ok("Ceza kapandi", cezaSaniye("Arda") === "-1", `saniye=${cezaSaniye("Arda")}`);
ok("Rozet kayboldu", (await rozet("Arda").count()) === 0);

// --- I: Temiz ders sayaci sifirliyor ---
console.log("\nI. Temiz ders sonrasi sayac");
await dersBaslat();  // Arda bu derste kart almayacak: temiz ders
await bas("Berk", "Kırmızı kart ver");
ok("Berk'in ilki 2 dakika", cezaSaniye("Berk") === "120", `saniye=${cezaSaniye("Berk")}`);
await dersBaslat();
await bas("Arda", "Kırmızı kart ver");
ok("Arda temiz dersten sonra YINE 2 dakika", cezaSaniye("Arda") === "120", `saniye=${cezaSaniye("Arda")}`);

// --- J: Basit sablonda ceza yok ---
console.log("\nJ. Basit sablon");
await sayfa.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
await sayfa.getByRole("radio", { name: /Basit/ }).check();
await sayfa.getByRole("button", { name: "Kaydet" }).click();
await sayfa.waitForSelector(".basari", { timeout: 10000 });
await sayfa.goto(T, { waitUntil: "networkidle" });
await sayfa.getByRole("link", { name: /Ceza-Test/ }).click();
await sayfa.getByRole("heading", { name: "Ceza-Test" }).waitFor();
ok("Basit sablonda ceza rozeti gizli", (await rozet("Arda").count()) === 0);
const oncekiSaniye = cezaSaniye("Arda");
await bas("Arda", "Eksi ver");
ok("Basit sablonda eksi ceza uretmedi", cezaSaniye("Arda") === oncekiSaniye,
   `once=${oncekiSaniye} sonra=${cezaSaniye("Arda")}`);

await tarayici.close();
console.log(`\n=== SONUC: ${gecti} gecti, ${kaldi} kaldi ===`);
process.exit(kaldi === 0 ? 0 : 1);
