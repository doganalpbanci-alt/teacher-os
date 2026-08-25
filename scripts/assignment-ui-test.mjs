// Ödev modülü testi: ödev oluşturma, öğrenci bazlı teslim kaydı, öğrenci
// sayfasındaki ödev geçmişi, sahiplik ve geriye dönük ekleme yapılmaması.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. SESSION_SECRET tanımlı olacak şekilde: npm run build && npm start
//   3. npm install --no-save playwright
//   4. SQL_KOMUTU='psql "$DATABASE_URL" -q -tA' node scripts/assignment-ui-test.mjs
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import { oturumHazirla } from "./test-oturum.mjs";
import { ogrenciFormunuAc } from "./test-form.mjs";

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
const baglam = await tarayici.newContext();
const sayfa = await baglam.newPage();
await oturumHazirla(sayfa, T);

const govde = () => sayfa.textContent("body");
const submissionSayisi = () => sql(`SELECT count(*) FROM "Submission";`);
const assignmentSayisi = () => sql(`SELECT count(*) FROM "Assignment";`);

// --- A: Hazirlik ---
console.log("\nA. Hazirlik");
await sayfa.goto(T, { waitUntil: "networkidle" });
await sayfa.getByLabel("Sınıf adı").fill("Odev-Test");
await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Odev-Test"), null, { timeout: 10000 });
await sayfa.getByRole("link", { name: /Odev-Test/ }).click();
await sayfa.getByRole("heading", { name: "Odev-Test" }).waitFor();
const sinifAdresi = sayfa.url();
for (const [a, b] of [["Ada", "Bir"], ["Efe", "Iki"]]) {
  await ogrenciFormunuAc(sayfa);
  await sayfa.getByLabel("Ad", { exact: true }).fill(a);
  await sayfa.getByLabel("Soyad").fill(b);
  await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
  await sayfa.waitForFunction((x) => document.body.innerText.includes(x), a, { timeout: 10000 });
}
ok("Baslangicta odev yok", assignmentSayisi() === "0", `odev=${assignmentSayisi()}`);

// --- B: Bos liste ---
console.log("\nB. Bos liste");
await sayfa.getByRole("link", { name: /Ödevler/ }).click();
await sayfa.getByRole("heading", { name: "Ödevler" }).waitFor();
ok("Bos liste mesaji", (await govde()).includes("henüz ödev yok"));

// --- C: Odev olusturma ---
console.log("\nC. Odev olusturma");
await sayfa.locator("summary").filter({ hasText: "Yeni ödev" }).click();
await sayfa.getByLabel("Ödev başlığı").fill("Unit 4 workbook");
await sayfa.getByLabel("Açıklama").fill("Sayfa 12-14");
await sayfa.getByLabel("Son teslim tarihi").fill("2026-09-01");
await sayfa.getByRole("button", { name: "Ödev ekle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Unit 4 workbook"), null, { timeout: 10000 });
ok("Odev listede", (await govde()).includes("Unit 4 workbook"));
ok("Veritabaninda bir odev var", assignmentSayisi() === "1", `odev=${assignmentSayisi()}`);
ok("Iki ogrenciye teslim kaydi acildi", submissionSayisi() === "2", `teslim=${submissionSayisi()}`);
const listeSatiri = sayfa.locator(".liste li").filter({ hasText: "Unit 4 workbook" });
ok("Baslangicta ikisi de bekliyor", (await listeSatiri.innerText()).includes("2 bekliyor"),
   await listeSatiri.innerText());

// --- D: Odev detayi ve durum guncelleme ---
console.log("\nD. Odev detayi ve durum guncelleme");
await listeSatiri.click();
await sayfa.getByRole("heading", { name: "Unit 4 workbook" }).waitFor();
ok("Aciklama gorunuyor", (await govde()).includes("Sayfa 12-14"));
ok("Son teslim tarihi gorunuyor", (await govde()).includes("1 Eylül 2026"));

const adaSatiri = sayfa.locator(".liste li").filter({ hasText: "Ada" });
const efeSatiri = sayfa.locator(".liste li").filter({ hasText: "Efe" });
await adaSatiri.getByRole("button", { name: "Yapıldı" }).click();
await sayfa.waitForFunction(() => {
  const li = [...document.querySelectorAll("li")].find((e) => e.innerText.includes("Ada"));
  return li && li.querySelector("button.secili.t-done");
}, null, { timeout: 10000 });
ok("Ada yapildi olarak isaretlendi", await adaSatiri.locator("button.secili.t-done").isVisible());

await efeSatiri.getByRole("button", { name: "Eksik" }).click();
await sayfa.waitForFunction(() => {
  const li = [...document.querySelectorAll("li")].find((e) => e.innerText.includes("Efe"));
  return li && li.querySelector("button.secili.t-missing");
}, null, { timeout: 10000 });
ok("Efe eksik olarak isaretlendi", await efeSatiri.locator("button.secili.t-missing").isVisible());

const durumlar = () => sql(`SELECT "status" FROM "Submission" ORDER BY "status";`);
ok("Veritabaninda durumlar dogru", durumlar() === "DONE\nMISSING", durumlar());

// --- E: Liste sayimlari guncellendi ---
console.log("\nE. Liste sayimlari guncellendi");
await sayfa.getByRole("link", { name: /Ödevler/ }).click();
await sayfa.getByRole("heading", { name: "Ödevler" }).waitFor();
const guncelSatir = sayfa.locator(".liste li").filter({ hasText: "Unit 4 workbook" });
ok("Sayimlar guncellendi", (await guncelSatir.innerText()).includes("1 yapıldı · 1 eksik"),
   await guncelSatir.innerText());

// --- F: Ogrenci sayfasinda odev gorunuyor ---
console.log("\nF. Ogrenci sayfasinda odev gorunuyor");
await sayfa.goto(sinifAdresi, { waitUntil: "networkidle" });
await sayfa.locator("li").filter({ hasText: "Ada" }).getByRole("link", { name: "Ada Bir" }).click();
await sayfa.getByRole("heading", { name: "Ada Bir" }).waitFor();
ok("Odev bolumu var", (await govde()).includes("Unit 4 workbook"));
ok("Durum yapildi gorunuyor", (await sayfa.locator(".teslim-rozet.t-done").innerText()) === "Yapıldı");

// --- G: Sonradan eklenen ogrenciye eski odev acilmaz ---
console.log("\nG. Sonradan eklenen ogrenciye eski odev acilmaz");
await sayfa.goto(sinifAdresi, { waitUntil: "networkidle" });
await ogrenciFormunuAc(sayfa);
await sayfa.getByLabel("Ad", { exact: true }).fill("Mert");
await sayfa.getByLabel("Soyad").fill("Uc");
await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Mert"), null, { timeout: 10000 });
ok("Teslim sayisi degismedi (yeni ogrenci eklenmedi)", submissionSayisi() === "2", `teslim=${submissionSayisi()}`);
await sayfa.getByRole("link", { name: /Ödevler/ }).click();
await sayfa.getByRole("link", { name: /Unit 4 workbook/ }).click();
await sayfa.getByRole("heading", { name: "Unit 4 workbook" }).waitFor();
ok("Mert listede yok", !(await govde()).includes("Mert Uc"));

// --- H: Sahiplik ---
console.log("\nH. Sahiplik");
let yanit = await sayfa.goto(`${sinifAdresi}/odevler/olmayan-odev`, { waitUntil: "networkidle" });
ok("Olmayan odev 404", yanit.status() === 404, `durum=${yanit.status()}`);

const odevAdresi = sayfa.url();
sql(`
INSERT INTO "Teacher" (id, email, name, "passwordHash", "createdAt")
VALUES ('t-odev-yabanci', 'odev-yabanci@ornek.com', 'Yabancı', '!parola-yok', now());
INSERT INTO "Classroom" (id, "teacherId", name, "isActive", "createdAt")
VALUES ('c-odev-yabanci', 't-odev-yabanci', 'Yabancı Sınıf', true, now());
`);
yanit = await sayfa.goto(`${T}/sinif/c-odev-yabanci/odevler`, { waitUntil: "networkidle" });
ok("Baskasinin odev listesi 404", yanit.status() === 404, `durum=${yanit.status()}`);

await sayfa.goto(sinifAdresi, { waitUntil: "networkidle" });
await sayfa.getByRole("link", { name: /Ödevler/ }).click();
await sayfa.getByRole("link", { name: /Unit 4 workbook/ }).click();
await sayfa.getByRole("heading", { name: "Unit 4 workbook" }).waitFor();
const gercekOdevId = sayfa.url().split("/").pop();
yanit = await sayfa.goto(`${T}/sinif/c-odev-yabanci/odevler/${gercekOdevId}`, { waitUntil: "networkidle" });
ok("Yanlis sinif altinda odev 404", yanit.status() === 404, `durum=${yanit.status()}`);

await tarayici.close();
console.log(`\n=== SONUC: ${gecti} gecti, ${kaldi} kaldi ===`);
process.exit(kaldi === 0 ? 0 : 1);
