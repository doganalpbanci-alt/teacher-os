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
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import { kayitBekleyici } from "./test-kayit.mjs";
import { oturumHazirla } from "./test-oturum.mjs";
import { dersBaslat } from "./test-ders.mjs";
import { ogrenciFormunuAc } from "./test-form.mjs";

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
  await kayitBekle(() => satir(ad).getByRole("button", { name: etiket }).click());
}
// Performans puanı artık ders ekranında gösterilmiyor (ders sırasında karar
// kartlara göre verilir), bu yüzden puan kaydın kendisinden okunur.
const SQL_KOMUTU = process.env.SQL_KOMUTU ?? 'psql "$DATABASE_URL" -q -tA';
const sql = (m) => execSync(SQL_KOMUTU, { input: m, shell: "/bin/bash" }).toString().trim();
const kayitBekle = kayitBekleyici(sql, sayfa);
const puan = (ad) =>
  Number(sql(`SELECT "performanceScore" FROM "Student" WHERE "firstName"='${ad}';`));
async function kart(ad) {
  const s = await satir(ad).innerHTML();
  if (s.includes("kart-kirmizi")) return "KIRMIZI";
  if (s.includes("kart-sari")) return "SARI";
  return "YOK";
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
  await ogrenciFormunuAc(sayfa);
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
await dersBaslat(sayfa);

// --- B: Dogrudan sari ---
console.log("\nB. Dogrudan sari kart");
await bas("Ali", "Sarı kart ver");
ok("Sari kart sembolu geldi", (await kart("Ali")) === "SARI", await kart("Ali"));
ok("Puan degismedi", (puan("Ali")) === 90, `puan=${puan("Ali")}`);

// --- C: Sari ustune sari -> kirmizi ---
console.log("\nC. Sari ustune sari");
await bas("Ali", "Sarı kart ver");
ok("KIRMIZIYA dondu", (await kart("Ali")) === "KIRMIZI", await kart("Ali"));
ok("-5 puan", (puan("Ali")) === 85, `puan=${puan("Ali")}`);

// --- D: Dogrudan kirmizi ---
console.log("\nD. Dogrudan kirmizi kart");
await bas("Ece", "Kırmızı kart ver");
ok("Kart yokken bile kirmizi", (await kart("Ece")) === "KIRMIZI", await kart("Ece"));
ok("-5 puan", (puan("Ece")) === 85, `puan=${puan("Ece")}`);

// --- E: Sari ustune dogrudan kirmizi ---
console.log("\nE. Sari ustune dogrudan kirmizi");
await bas("Can", "Sarı kart ver");
ok("Once sari", (await kart("Can")) === "SARI");
await bas("Can", "Kırmızı kart ver");
ok("Kirmiziya dondu", (await kart("Can")) === "KIRMIZI", await kart("Can"));
ok("-5 puan", (puan("Can")) === 85, `puan=${puan("Can")}`);

// --- F: Yildiz ---
console.log("\nF. Yildiz");
await bas("Sude", "Yıldız ver");
ok("Yildiz +1", (puan("Sude")) === 91, `puan=${puan("Sude")}`);
ok("Yildiz kart vermedi", (await kart("Sude")) === "YOK");

// --- G: Yeni derste sifirlanma ---
console.log("\nG. Yeni ders");
await dersBaslat(sayfa);
ok("Ali'nin karti sifirlandi", (await kart("Ali")) === "YOK", await kart("Ali"));
ok("Ali'nin puani korundu", (puan("Ali")) === 85, `puan=${puan("Ali")}`);
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
// Geri alma düğmesi ayrı bir kapsayıcıda durur (`.geri-al`); davranış
// düğmeleriyle karışmasın diye sayım `.davranis` içine daraltılır.
ok(
  "Basit sablonda iki dugme",
  (await satir("Ali").locator(".davranis").getByRole("button").count()) === 2,
);

// Dugmenin degerini kurcalayip SARI_KART gondermeyi dene
const oncekiPuan = puan("Ece");
await satir("Ece").locator('button[value="MINUS"]').evaluate((el) => {
  el.setAttribute("value", "KIRMIZI_KART");
  el.form.requestSubmit(el);
});
await sayfa.waitForSelector(".hata", { timeout: 10000 });
ok("Sunucu KIRMIZI_KART istegini REDDETTI",
   (await sayfa.textContent(".hata")).includes("Geçersiz"), await sayfa.textContent(".hata"));
ok("Puan degismedi", (puan("Ece")) === oncekiPuan, `puan=${puan("Ece")}`);

await tarayici.close();
console.log(`\n=== SONUC: ${gecti} gecti, ${kaldi} kaldi ===`);
process.exit(kaldi === 0 ? 0 : 1);
