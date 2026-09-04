// Öğrenci ad/soyad düzenleme testi: ekleme sırasında yapılan bir yazım
// hatasının tek düzeltme yolu SQL'di, artık öğrenci sayfasından yapılabiliyor.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. npm run build && npm start
//   3. npm install --no-save playwright
//   4. SQL_KOMUTU='psql "$DATABASE_URL" -q -tA' node scripts/student-name-edit-ui-test.mjs
import { chromium } from "playwright";
import { oturumHazirla } from "./test-oturum.mjs";
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

// --- A. Hazirlik ---
console.log("\nA. Hazirlik");
await sayfa.goto(T, { waitUntil: "networkidle" });
await sayfa.getByLabel("Sınıf adı").fill("Ad-Test");
await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Ad-Test"), null, { timeout: 10000 });
await sayfa.getByRole("link", { name: /Ad-Test/ }).click();
await sayfa.waitForURL(/\/sinif\//, { timeout: 10000 });
await ogrenciFormunuAc(sayfa);
await sayfa.getByLabel("Ad", { exact: true }).fill("Yalnız");
await sayfa.getByLabel("Soyad").fill("Yazım");
await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Yalnız"), null, { timeout: 10000 });

await sayfa.getByRole("link", { name: "Yalnız Yazım" }).click();
await sayfa.waitForURL(/\/ogrenci\//, { timeout: 10000 });
ok("Baslikta yanlis yazilan isim var", (await sayfa.locator("h1").innerText()).includes("Yalnız Yazım"));

// --- B. Duzenleme acilip kapanabiliyor ---
console.log("\nB. Duzen modu");
ok("Baslangicta form yok", (await sayfa.locator(".ogrenci-adi-formu").count()) === 0);
await sayfa.getByRole("button", { name: "Düzenle" }).click();
ok("Duzenle sonrasi form acildi", (await sayfa.locator(".ogrenci-adi-formu").count()) === 1);
ok("Alanlar mevcut degerle dolu", (await sayfa.getByLabel("Ad", { exact: true }).inputValue()) === "Yalnız");

await sayfa.getByRole("button", { name: "Vazgeç" }).click();
ok("Vazgectikten sonra form kapandi", (await sayfa.locator(".ogrenci-adi-formu").count()) === 0);
ok("Isim degismedi", (await sayfa.locator("h1").innerText()).includes("Yalnız Yazım"));

// --- C. Bos ad/soyad reddi ---
console.log("\nC. Sunucu dogrulamasi");
await sayfa.getByRole("button", { name: "Düzenle" }).click();
const adiFormu = sayfa.locator(".ogrenci-adi-formu");
await adiFormu.getByLabel("Ad", { exact: true }).fill("");
await adiFormu.getByRole("button", { name: "Kaydet" }).click();
await sayfa.waitForSelector(".hata", { timeout: 10000 });
ok("Bos ad reddedildi", (await sayfa.textContent(".hata")).includes("boş olamaz"));
ok("Hata sonrasi form hala acik", (await sayfa.locator(".ogrenci-adi-formu").count()) === 1);

// --- D. Duzeltme kaydediliyor ---
console.log("\nD. Duzeltme");
await adiFormu.getByLabel("Ad", { exact: true }).fill("Umut");
await adiFormu.getByLabel("Soyad").fill("Doğru");
await adiFormu.getByRole("button", { name: "Kaydet" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Umut Doğru"), null, { timeout: 10000 });
ok("Yeni isim baslikta", (await sayfa.locator("h1").innerText()).includes("Umut Doğru"));
ok("Kayittan sonra form otomatik kapandi", (await sayfa.locator(".ogrenci-adi-formu").count()) === 0);

await sayfa.reload({ waitUntil: "networkidle" });
ok("Yenilemeden sonra da kalici", (await sayfa.locator("h1").innerText()).includes("Umut Doğru"));

// --- E. Sinif listesine de yansiyor ---
console.log("\nE. Sinif listesi");
await sayfa.getByRole("link", { name: /Ad-Test/ }).click();
await sayfa.waitForURL(/\/sinif\//, { timeout: 10000 });
ok("Sinif listesinde yeni isim var", (await sayfa.innerText("body")).includes("Umut Doğru"));
ok("Eski isim kalmadi", !(await sayfa.innerText("body")).includes("Yalnız Yazım"));

await tarayici.close();
console.log(`\n=== SONUC: ${gecti} gecti, ${kaldi} kaldi ===`);
process.exit(kaldi === 0 ? 0 : 1);
