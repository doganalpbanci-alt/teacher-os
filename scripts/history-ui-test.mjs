// Öğrenci geçmişi ekranının testi: kayıtların listelenmesi, derslere göre
// gruplanma, kırmızı kartın tek satırda birleşmesi ve dönem toplamları.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. npm run build && npm start
//   3. npm install --no-save playwright
//   4. node scripts/history-ui-test.mjs
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import { kayitBekleyici } from "./test-kayit.mjs";
import { oturumHazirla } from "./test-oturum.mjs";
import { dersBaslat } from "./test-ders.mjs";
import { ogrenciFormunuAc } from "./test-form.mjs";
const TEMEL = process.env.TEMEL_ADRES ?? "http://127.0.0.1:3000";
let gecti = 0, kaldi = 0;
function ok(ad, kosul, ayrinti = "") {
  if (kosul) { gecti++; console.log(`  GECTI  ${ad}`); }
  else { kaldi++; console.log(`  KALDI  ${ad}${ayrinti ? "  -> " + ayrinti : ""}`); }
}
const tarayici = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM }
    : {},
);
const sayfa = await tarayici.newPage();

// Uygulama giris istiyor; once hesap kurulur ya da girilir.
await oturumHazirla(sayfa, TEMEL);
function satir(ad) { return sayfa.locator("li").filter({ hasText: ad }); }
const SQL_KOMUTU = process.env.SQL_KOMUTU ?? 'psql "$DATABASE_URL" -q -tA';
const sql = (m) => execSync(SQL_KOMUTU, { input: m, shell: "/bin/bash" }).toString().trim();
const kayitBekle = kayitBekleyici(sql, sayfa);
async function bas(ad, etiket) {
  await kayitBekle(() => satir(ad).getByRole("button", { name: etiket }).click());
}
async function ozet() {
  // Her olcum "deger" + "etiket" seklinde iki ayri eleman; birlestirip okunur.
  return sayfa.locator(".olcum").evaluateAll((ler) =>
    ler.map((el) => el.innerText.replace(/\s+/g, " ").trim()).join(" | "),
  );
}
async function gecmisMetni() {
  return (await sayfa.locator("section").filter({ hasText: "Geçmiş" }).last().innerText()).replace(/\s+/g, " ");
}

// --- A: Bos gecmis ---
console.log("\nA. Kayitsiz ogrenci");
await sayfa.goto(TEMEL, { waitUntil: "networkidle" });
await sayfa.getByLabel("Sınıf adı").fill("10-B");
await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("10-B"), null, { timeout: 10000 });
await sayfa.getByRole("link", { name: /10-B/ }).click();
await sayfa.getByRole("heading", { name: "10-B" }).waitFor();
await ogrenciFormunuAc(sayfa);
await sayfa.getByLabel("Ad", { exact: true }).fill("Naz");
await sayfa.getByLabel("Soyad").fill("Er");
await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Naz"), null, { timeout: 10000 });
await sayfa.getByRole("link", { name: /Naz Er/ }).click();
await sayfa.getByRole("heading", { name: "Naz Er" }).waitFor();
ok("Bos gecmis mesaji", (await gecmisMetni()).includes("henüz kayıt yok"));

// --- B: Basit sistemde gecmis ---
console.log("\nB. Basit sistemde kayitlar");
await sayfa.goBack({ waitUntil: "networkidle" });
await dersBaslat(sayfa, ". ders");
await bas("Naz", "Artı ver");
await bas("Naz", "Artı ver");
await bas("Naz", "Eksi ver");
await sayfa.getByRole("link", { name: /Naz Er/ }).click();
await sayfa.getByRole("heading", { name: "Naz Er" }).waitFor();
let g = await gecmisMetni();
ok("Uc kayit listelendi", (g.match(/Artı/g) || []).length === 2 && g.includes("Eksi"), g.slice(0, 200));
const o1 = await ozet();
ok("Ozet: 2 arti", /2 artı/.test(o1), o1);
ok("Ozet: 1 eksi", /1 eksi/.test(o1), o1);
ok("Basit sistemde puan etkisi yok", !g.includes("+1") && !g.includes("-5"), g.slice(0, 200));

// --- C: Kart sisteminde gecmis ---
console.log("\nC. Kart sisteminde kayitlar");
await sayfa.goto(`${TEMEL}/ayarlar`, { waitUntil: "networkidle" });
await sayfa.getByRole("radio", { name: /Kart sistemi/ }).check();
await sayfa.getByRole("button", { name: "Kaydet" }).click();
await sayfa.waitForSelector(".basari", { timeout: 10000 });
await sayfa.goto(TEMEL, { waitUntil: "networkidle" });
await sayfa.getByRole("link", { name: /10-B/ }).click();
await sayfa.getByRole("heading", { name: "10-B" }).waitFor();
await bas("Naz", "Yıldız ver");
await bas("Naz", "Sarı kart ver");
await bas("Naz", "Sarı kart ver");
await sayfa.getByRole("link", { name: /Naz Er/ }).click();
await sayfa.getByRole("heading", { name: "Naz Er" }).waitFor();
g = await gecmisMetni();
ok("Sari kart gecmiste", g.includes("Sarı kart"));
ok("Kirmizi kart gecmiste", g.includes("Kırmızı kart"));
ok("Kirmizi kart -5 ile tek satir", /Kırmızı kart -5/.test(g), g.slice(0, 300));
ok("Ayri MINUS satiri yok", (g.match(/Eksi/g) || []).length === 1, g.slice(0, 300));
ok("Yildiz +1 gosteriliyor", /Artı \+1/.test(g), g.slice(0, 300));
const o2 = await ozet();
ok("Ozet: 1 sari kart", /1 sarı kart/.test(o2), o2);
ok("Ozet: 1 kirmizi kart", /1 kırmızı kart/.test(o2), o2);
ok("Ozet: 3 yildiz", /3 yıldız/.test(o2), o2);
ok("Ozet: 86 puan (90 +1 -5)", /86 performans notu/.test(o2), o2);

// --- D: Eski kayitlar korunuyor ---
console.log("\nD. Sablon degisimi gecmisi bozmuyor");
ok("Basit donemin kayitlari duruyor", (g.match(/Artı/g) || []).length >= 3, g.slice(0, 300));

// --- E: Ders gruplama ---
console.log("\nE. Ders gruplama");
await sayfa.goBack({ waitUntil: "networkidle" });
await dersBaslat(sayfa, "2. ders");
await bas("Naz", "Yıldız ver");
await sayfa.getByRole("link", { name: /Naz Er/ }).click();
await sayfa.getByRole("heading", { name: "Naz Er" }).waitFor();
const basliklar = await sayfa.locator(".gecmis-baslik").count();
ok("Iki ders grubu var", basliklar === 2, `grup=${basliklar}`);

await tarayici.close();
console.log(`\n=== SONUC: ${gecti} gecti, ${kaldi} kaldi ===`);
process.exit(kaldi === 0 ? 0 : 1);
