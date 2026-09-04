// Ders ekranı düzeni testi: telefonda sığması, akıllı tahtada okunması,
// Türkçe sıralama ve dokunma hedefi ölçüleri.
//
// Düzen kuralları CSS'te; bu test onları gerçek tarayıcıda ölçer. Ölçüler
// "iyi görünüyor" değil, sayıyla doğrulanır.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. SESSION_SECRET tanımlı olacak şekilde: npm run build && npm start
//   3. npm install --no-save playwright
//   4. SQL_KOMUTU='psql "$DATABASE_URL" -q -tA' node scripts/layout-ui-test.mjs
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import { oturumHazirla } from "./test-oturum.mjs";
import { dersBaslat } from "./test-ders.mjs";

const T = process.env.TEMEL_ADRES ?? "http://127.0.0.1:3000";
const SQL_KOMUTU = process.env.SQL_KOMUTU ?? 'psql "$DATABASE_URL" -q -tA';
const sql = (m) => execSync(SQL_KOMUTU, { input: m, shell: "/bin/bash" }).toString().trim();

// Dokunma hedefi alt sınırı. Ders sırasında hızlı ve yanlışsız basılmalı.
const EN_KUCUK_DUGME = 44;

let gecti = 0, kaldi = 0;
function ok(ad, kosul, ayrinti = "") {
  if (kosul) { gecti++; console.log(`  GECTI  ${ad}`); }
  else { kaldi++; console.log(`  KALDI  ${ad}${ayrinti ? "  -> " + ayrinti : ""}`); }
}

const tarayici = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);

// --- A: Hazirlik (telefon boyutunda) ---
console.log("\nA. Hazirlik");
const telefon = await tarayici.newContext({ viewport: { width: 390, height: 844 } });
const sayfa = await telefon.newPage();
await oturumHazirla(sayfa, T);

await sayfa.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
await sayfa.getByRole("radio", { name: /Kart sistemi/ }).check();
await sayfa.getByRole("button", { name: "Kaydet" }).click();
await sayfa.waitForSelector(".basari", { timeout: 10000 });

await sayfa.goto(T, { waitUntil: "networkidle" });
await sayfa.getByLabel("Sınıf adı").fill("Duzen-Test");
await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Duzen-Test"), null, { timeout: 10000 });
await sayfa.getByRole("link", { name: /Duzen-Test/ }).click();
await sayfa.getByRole("heading", { name: "Duzen-Test" }).waitFor();
const sinifAdresi = sayfa.url();

// Ders sirasinda ogrenci eklenmez; form kapali baslar. Sinif sayfasinda
// birden fazla katlanir bolum var (Yeni ogrenci, Sinifi yonet, ...);
// digerleriyle karismasin diye ozellikle "Yeni ogrenci" bolumu seciliyor.
const yeniOgrenciDetay = sayfa.locator("details.katlanir").filter({ hasText: "Yeni öğrenci" });
const formAcik = await yeniOgrenciDetay.evaluate((e) => e.open);
ok("Yeni ogrenci formu KAPALI basliyor", formAcik === false);
ok("Formun basligi goruluyor", await yeniOgrenciDetay.locator("summary").isVisible());

await yeniOgrenciDetay.locator("summary").click();
// Turkce harfli isimler: siralamanin dogru yerde tuttugunu gostermeli.
const ogrenciler = [
  ["Hale", "Aydın"], ["İrem", "Koç"], ["Kaan", "Öztürk"],
  ["Çisem", "Ak"], ["Ada", "Yıldırım"], ["Zeynep", "Uzunsoyadlıoğulları"],
];
for (const [a, s] of ogrenciler) {
  await sayfa.getByLabel("Ad", { exact: true }).fill(a);
  await sayfa.getByLabel("Soyad").fill(s);
  await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
  await sayfa.waitForFunction((x) => document.body.innerText.includes(x), a, { timeout: 10000 });
}
await sayfa.reload({ waitUntil: "networkidle" });

// --- B: Turkce siralama ---
console.log("\nB. Turkce siralama");
const adlar = async () =>
  sayfa.locator(".ogrenci-ad").evaluateAll((e) => e.map((x) => x.innerText.trim()));
const sirali = await adlar();
// Turkce alfabe: A, Ç, H, İ, K, Z
const beklenen = ["Ada", "Çisem", "Hale", "İrem", "Kaan", "Zeynep"];
ok("Turkce alfabeye gore siralandi",
   JSON.stringify(sirali.map((a) => a.split(" ")[0])) === JSON.stringify(beklenen),
   sirali.join(" | "));

// --- C: Telefonda satir ---
console.log("\nC. Telefon (390px)");
const satir = (ad) => sayfa.locator("li").filter({ hasText: ad });
await dersBaslat(sayfa);

const dugme = satir("Ada").getByRole("button", { name: "Sarı kart ver" });
const kutu = await dugme.boundingBox();
ok(`Dugme dokunma hedefi >= ${EN_KUCUK_DUGME}px`,
   kutu.width >= EN_KUCUK_DUGME && kutu.height >= EN_KUCUK_DUGME,
   `${Math.round(kutu.width)}x${Math.round(kutu.height)}`);

// Uzun soyadli ogrencinin adi kirpilmadan durmali: satir tasmamali.
const tasma = await sayfa.evaluate(() =>
  document.documentElement.scrollWidth <= window.innerWidth);
ok("Sayfa yatayda TASMIYOR", tasma);

const satirMetni = await satir("Ada").evaluate((e) => e.innerText);
ok("Puan ders ekraninda YOK", !satirMetni.includes("puan"), satirMetni.replace(/\s+/g, " "));

// --- D: Kart durumu satirin kendisinde ---
console.log("\nD. Kart durumu");
await dugme.click();
await sayfa.waitForFunction(
  () => document.querySelector(".ogrenci.kart-sari") !== null,
  null,
  { timeout: 10000 },
);
ok("Sari kart satiri isaretledi", (await satir("Ada").locator(".ogrenci.kart-sari").count()) === 1);
ok("Kart durumu ekran okuyucuya da yaziyor",
   (await satir("Ada").textContent()).includes("Sarı kart"));

// --- E: Akilli tahta ---
console.log("\nE. Akilli tahta (1920px)");
const tahta = await (await tarayici.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
await oturumHazirla(tahta, T);
await tahta.goto(sinifAdresi, { waitUntil: "networkidle" });
await tahta.getByRole("heading", { name: "Duzen-Test" }).waitFor();

const tahtaDugme = await tahta.locator(".davranis button").first().boundingBox();
ok("Tahtada dugme daha buyuk", tahtaDugme.width > EN_KUCUK_DUGME + 8,
   `${Math.round(tahtaDugme.width)}px`);

const adBoyu = await tahta.locator(".ogrenci-ad").first()
  .evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
ok("Tahtada isim uzaktan okunacak kadar buyuk", adBoyu >= 20, `${adBoyu}px`);

// Iki sutun: ogrenciler yan yana iki blokta durmali.
const sutunSayisi = await tahta.locator(".ogrenci-liste")
  .evaluate((e) => getComputedStyle(e).columnCount);
ok("Tahtada iki sutun", sutunSayisi === "2", `sutun=${sutunSayisi}`);

// Sutunlar dikey akmali: ilk ogrenci solda, listenin ortasindaki sagda.
const kutular = await tahta.locator(".ogrenci-ad").evaluateAll((e) =>
  e.map((x) => ({ ad: x.innerText.trim(), x: x.getBoundingClientRect().x })));
const solSutun = kutular.filter((k) => k.x < 960).map((k) => k.ad.split(" ")[0]);
ok("Sol sutun alfabenin basi (dikey akis)",
   JSON.stringify(solSutun) === JSON.stringify(["Ada", "Çisem", "Hale"]),
   solSutun.join(" | "));

// --- F: Puan ogrenci sayfasinda ---
console.log("\nF. Puan ogrenci sayfasinda");
const puan = sql(`SELECT "performanceScore" FROM "Student" WHERE "firstName"='Ada';`);
await sayfa.getByRole("link", { name: /Ada Yıldırım/ }).click();
await sayfa.getByRole("heading", { name: "Ada Yıldırım" }).waitFor();
const ogrenciMetni = await sayfa.textContent("body");
ok("Ogrenci sayfasinda puan var", ogrenciMetni.includes(puan), `beklenen=${puan}`);

await tarayici.close();
console.log(`\n=== SONUC: ${gecti} gecti, ${kaldi} kaldi ===`);
process.exit(kaldi === 0 ? 0 : 1);
