// Kart şablonunun dört düğmesi: yıldız, uyarı, doğrudan sarı, doğrudan
// kırmızı. Yükselme kuralını (sarı üstüne sarı kırmızıdır) ve basit şablonda
// kart eylemlerinin sunucuda reddedildiğini doğrular.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. SESSION_SECRET tanımlı olacak şekilde: npm run build && npm start
//   3. npm install --no-save playwright
//   4. node scripts/card-buttons-ui-test.mjs
import { chromium } from "playwright";
import { oturumHazirla } from "./test-oturum.mjs";

const T = process.env.TEMEL_ADRES ?? "http://127.0.0.1:3000";
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
async function puan(ad) { return Number((await metin(ad)).match(/(-?\d+) puan/)?.[1]); }
async function kart(ad) {
  const s = await satir(ad).innerHTML();
  if (s.includes("kart-kirmizi")) return "KIRMIZI";
  if (s.includes("kart-sari")) return "SARI";
  return "YOK";
}
async function dersBaslat() {
  const onceki = await sayfa.textContent("body");
  await sayfa.getByRole("button", { name: "Yeni ders başlat" }).click();
  await sayfa.waitForFunction((x) => document.body.innerText !== x, onceki, { timeout: 10000 });
  await sayfa.waitForTimeout(400);
}

// --- Hazirlik: kart sistemi + sinif + ogrenciler ---
console.log("\nA. Hazirlik");
await sayfa.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
await sayfa.getByRole("radio", { name: /Kart sistemi/ }).check();
await sayfa.getByRole("button", { name: "Kaydet" }).click();
await sayfa.waitForSelector(".basari", { timeout: 10000 });
await sayfa.goto(T, { waitUntil: "networkidle" });
await sayfa.getByLabel("Sınıf adı").fill("Kart-Test");
await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Kart-Test"), null, { timeout: 10000 });
await sayfa.getByRole("link", { name: /Kart-Test/ }).click();
await sayfa.getByRole("heading", { name: "Kart-Test" }).waitFor();
for (const [a, b] of [["Ali", "Bir"], ["Ece", "Iki"], ["Can", "Uc"], ["Sude", "Dort"]]) {
  await sayfa.getByLabel("Ad", { exact: true }).fill(a);
  await sayfa.getByLabel("Soyad").fill(b);
  await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
  await sayfa.waitForFunction((x) => document.body.innerText.includes(x), a, { timeout: 10000 });
}
ok("Uc dugme goruluyor", (await satir("Ali").getByRole("button").count()) === 3,
   `dugme=${await satir("Ali").getByRole("button").count()}`);
ok("Uyari dugmesi KALDIRILDI", (await satir("Ali").getByRole("button", { name: "Uyarı ver" }).count()) === 0);
for (const e of ["Yıldız ver", "Sarı kart ver", "Kırmızı kart ver"]) {
  ok(`"${e}" dugmesi var`, await satir("Ali").getByRole("button", { name: e }).isVisible());
}
await dersBaslat();

// --- B: Dogrudan sari ---
console.log("\nB. Dogrudan sari kart");
await bas("Ali", "Sarı kart ver");
ok("Sari kart sembolu geldi", (await kart("Ali")) === "SARI", await kart("Ali"));
ok("Puan degismedi", (await puan("Ali")) === 90, `puan=${await puan("Ali")}`);

// --- C: Sari ustune sari -> kirmizi ---
console.log("\nC. Sari ustune sari");
await bas("Ali", "Sarı kart ver");
ok("KIRMIZIYA dondu", (await kart("Ali")) === "KIRMIZI", await kart("Ali"));
ok("-5 puan", (await puan("Ali")) === 85, `puan=${await puan("Ali")}`);

// --- D: Dogrudan kirmizi ---
console.log("\nD. Dogrudan kirmizi kart");
await bas("Ece", "Kırmızı kart ver");
ok("Kart yokken bile kirmizi", (await kart("Ece")) === "KIRMIZI", await kart("Ece"));
ok("-5 puan", (await puan("Ece")) === 85, `puan=${await puan("Ece")}`);

// --- E: Sari ustune dogrudan kirmizi ---
console.log("\nE. Sari ustune dogrudan kirmizi");
await bas("Can", "Sarı kart ver");
ok("Once sari", (await kart("Can")) === "SARI");
await bas("Can", "Kırmızı kart ver");
ok("Kirmiziya dondu", (await kart("Can")) === "KIRMIZI", await kart("Can"));
ok("-5 puan", (await puan("Can")) === 85, `puan=${await puan("Can")}`);

// --- F: Yildiz ---
console.log("\nF. Yildiz");
await bas("Sude", "Yıldız ver");
ok("Yildiz +1", (await puan("Sude")) === 91, `puan=${await puan("Sude")}`);
ok("Yildiz kart vermedi", (await kart("Sude")) === "YOK");

// --- G: Yeni derste sifirlanma ---
console.log("\nG. Yeni ders");
await dersBaslat();
ok("Ali'nin karti sifirlandi", (await kart("Ali")) === "YOK", await kart("Ali"));
ok("Ali'nin puani korundu", (await puan("Ali")) === 85, `puan=${await puan("Ali")}`);
await bas("Ali", "Sarı kart ver");
ok("Yeni derste dogrudan sari yine SARI", (await kart("Ali")) === "SARI", await kart("Ali"));

// --- H: Gecmis ---
console.log("\nH. Gecmis");
await sayfa.getByRole("link", { name: /Ali Bir/ }).click();
await sayfa.getByRole("heading", { name: "Ali Bir" }).waitFor();
const gecmis = (await sayfa.locator("section").filter({ hasText: "Geçmiş" }).last().innerText()).replace(/\s+/g, " ");
ok("Gecmiste iki sari bir kirmizi", (gecmis.match(/Sarı kart/g) || []).length === 2 && gecmis.includes("Kırmızı kart -5"), gecmis.slice(0, 200));

// --- I: Basit sablonda gizli VE sunucuda reddediliyor ---
console.log("\nI. Basit sablonda koruma");
await sayfa.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
await sayfa.getByRole("radio", { name: /Basit/ }).check();
await sayfa.getByRole("button", { name: "Kaydet" }).click();
await sayfa.waitForSelector(".basari", { timeout: 10000 });
await sayfa.goto(T, { waitUntil: "networkidle" });
await sayfa.getByRole("link", { name: /Kart-Test/ }).click();
await sayfa.getByRole("heading", { name: "Kart-Test" }).waitFor();
ok("Kart dugmeleri gizlendi", (await satir("Ali").getByRole("button", { name: /kart ver/ }).count()) === 0);
ok("Basit sablonda iki dugme", (await satir("Ali").getByRole("button").count()) === 2);

// Dugmenin degerini kurcalayip SARI_KART gondermeyi dene
const oncekiPuan = await puan("Ece");
await satir("Ece").locator('button[value="MINUS"]').evaluate((el) => {
  el.setAttribute("value", "KIRMIZI_KART");
  el.form.requestSubmit(el);
});
await sayfa.waitForSelector(".hata", { timeout: 10000 });
ok("Sunucu KIRMIZI_KART istegini REDDETTI",
   (await sayfa.textContent(".hata")).includes("Geçersiz"), await sayfa.textContent(".hata"));
ok("Puan degismedi", (await puan("Ece")) === oncekiPuan, `puan=${await puan("Ece")}`);

await tarayici.close();
console.log(`\n=== SONUC: ${gecti} gecti, ${kaldi} kaldi ===`);
process.exit(kaldi === 0 ? 0 : 1);
