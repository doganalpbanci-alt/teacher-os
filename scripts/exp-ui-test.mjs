// EXP (tecrübe puanı) ve seviye sistemi testi: yıldız/artı EXP verir, geri
// alma EXP'yi de geri alır, ödev tamamlama (DONE/LATE farklı miktarda) EXP
// verir, aynı teslim ikinci kez işaretlense bile EXP tekrar yazılmaz,
// gamification kapalıyken hiçbir EXP izi görünmez.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. npm run build && npm start
//   3. npm install --no-save playwright
//   4. SQL_KOMUTU='psql "$DATABASE_URL" -q -tA' node scripts/exp-ui-test.mjs
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import { oturumHazirla } from "./test-oturum.mjs";
import { dersBaslat } from "./test-ders.mjs";
import { ogrenciFormunuAc } from "./test-form.mjs";

const T = process.env.TEMEL_ADRES ?? "http://127.0.0.1:3000";
let gecti = 0, kaldi = 0;
function ok(ad, kosul, ayrinti = "") {
  if (kosul) { gecti++; console.log(`  GECTI  ${ad}`); }
  else { kaldi++; console.log(`  KALDI  ${ad}${ayrinti ? "  -> " + ayrinti : ""}`); }
}

const SQL_KOMUTU = process.env.SQL_KOMUTU ?? 'psql "$DATABASE_URL" -q -tA';
const sql = (m) => execSync(SQL_KOMUTU, { input: m, shell: "/bin/bash" }).toString().trim();
const expToplam = (ad) =>
  Number(sql(`SELECT "expTotal" FROM "Student" WHERE "firstName"='${ad}';`));
const expOlayi = (ad) =>
  Number(sql(`SELECT count(*) FROM "ExpEvent" e JOIN "Student" s ON s.id=e."studentId" WHERE s."firstName"='${ad}';`));

const tarayici = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
const sayfa = await tarayici.newPage();
await oturumHazirla(sayfa, T);

function satir(ad) { return sayfa.locator("li").filter({ hasText: ad }); }
const geriAlDugmesi = (ad) =>
  satir(ad).getByRole("button", { name: new RegExp(`^${ad}\\b.*son kaydı geri al$`) });
function gamificationFormu() {
  return sayfa.locator("form").filter({ hasText: "Sınıf hedeflerini kullan" });
}
async function bekle(metin) {
  await sayfa.waitForFunction((m) => document.body.innerText.includes(m), metin, { timeout: 10000 });
}
async function govde() { return sayfa.innerText("body"); }

async function artiVer(ad) {
  const onceki = await satir(ad).evaluate((el) => el.innerText);
  await satir(ad).getByRole("button", { name: "Artı ver" }).click();
  await sayfa.waitForFunction(
    ([isim, eski]) => {
      const li = [...document.querySelectorAll("li")].find((e) => e.innerText.includes(isim));
      return li && li.innerText !== eski;
    }, [ad, onceki], { timeout: 10000 });
  await sayfa.waitForTimeout(300);
}

// --- Kurulum ---
console.log("\nKurulum");
await sayfa.goto(T, { waitUntil: "networkidle" });
await sayfa.getByLabel("Sınıf adı").fill("Exp-Sinif");
await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
await bekle("Exp-Sinif");
await sayfa.getByRole("link", { name: /Exp-Sinif/ }).click();
await sayfa.getByRole("heading", { name: "Exp-Sinif" }).waitFor();
const SINIF_URL = sayfa.url();
for (const [a, b] of [["Deren", "Bir"], ["Ikinci", "Ogrenci"]]) {
  await ogrenciFormunuAc(sayfa);
  await sayfa.getByLabel("Ad", { exact: true }).fill(a);
  await sayfa.getByLabel("Soyad").fill(b);
  await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
  await bekle(a);
}
await dersBaslat(sayfa, ". ders");

// --- A. Gamification kapaliyken hic iz birakmaz ---
console.log("\nA. Gamification kapaliyken");
await artiVer("Deren");
ok("Kapaliyken EXP olayi yazilmadi", expOlayi("Deren") === 0, `olay=${expOlayi("Deren")}`);
ok("Kapaliyken seviye rozeti YOK", (await satir("Deren").locator(".rozet-seviye").count()) === 0);

// --- B. Modulu ac ---
console.log("\nB. Modulu ac");
await sayfa.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
await gamificationFormu().getByRole("checkbox").check();
await gamificationFormu().getByRole("button", { name: "Kaydet" }).click();
await bekle("Ayar kaydedildi.");
await sayfa.goto(SINIF_URL, { waitUntil: "networkidle" });

// --- C. Yildiz/arti EXP veriyor ---
console.log("\nC. Arti EXP veriyor");
await artiVer("Deren");
ok("Ilk arti 10 EXP yazdi", expToplam("Deren") === 10, `exp=${expToplam("Deren")}`);
ok("Seviye 1 rozeti goruluyor", (await satir("Deren").innerText()).includes("Sv.1"));

await artiVer("Deren");
ok("Iki artiyla 20 EXP (seviye esigi)", expToplam("Deren") === 20, `exp=${expToplam("Deren")}`);
ok("Seviye 2'ye atladi", (await satir("Deren").innerText()).includes("Sv.2"));

// --- D. Ogrenci sayfasinda EXP cubugu ---
console.log("\nD. Ogrenci sayfasinda gorunum");
await satir("Deren").getByRole("link", { name: /Deren/ }).click();
await sayfa.getByRole("heading", { name: "Deren Bir" }).waitFor();
ok("Seviye 2 yaziyor", (await govde()).includes("Seviye 2"));
ok("0/40 XP yaziyor", (await govde()).includes("0/40 XP"), (await govde()).replace(/\s+/g, " ").slice(0, 400));
await sayfa.goBack({ waitUntil: "networkidle" });

// --- E. Geri alma EXP'yi de geri aliyor ---
console.log("\nE. Geri alma");
await geriAlDugmesi("Deren").click();
await sayfa.waitForFunction(
  (isim) => {
    const li = [...document.querySelectorAll("li")].find((e) => e.innerText.includes(isim));
    return li && li.innerText.includes("Sv.1");
  }, "Deren", { timeout: 10000 });
ok("Geri alinca 10 EXP'ye dondu", expToplam("Deren") === 10, `exp=${expToplam("Deren")}`);
ok("Bir EXP olayi kaldi", expOlayi("Deren") === 1, `olay=${expOlayi("Deren")}`);

// --- F. Odev tamamlama EXP veriyor ---
console.log("\nF. Odev tamamlama");
await sayfa.goto(`${T}/odevler/yeni`, { waitUntil: "networkidle" });
await sayfa.getByLabel("Ödev başlığı").fill("Exp Odevi");
await sayfa.locator("fieldset").filter({ hasText: "Exp-Sinif" }).locator("input[type=checkbox]").first().check();
await sayfa.getByRole("button", { name: "Ödevi ver" }).click();
await bekle("tamamlanma");

const asliSatiri = sayfa.locator("li").filter({ hasText: "Deren" });
const ikinciSatiri = sayfa.locator("li").filter({ hasText: "Ikinci" });
await asliSatiri.getByRole("button", { name: "Yapıldı" }).click();
await sayfa.waitForFunction(() => {
  const li = [...document.querySelectorAll("li")].find((e) => e.innerText.includes("Deren"));
  return li && li.querySelector("button.secili.t-done");
}, null, { timeout: 10000 });
ok("Zamaninda odev +20 EXP verdi", expToplam("Deren") === 30, `exp=${expToplam("Deren")}`);

await ikinciSatiri.getByRole("button", { name: "Geç" }).click();
await sayfa.waitForFunction(() => {
  const li = [...document.querySelectorAll("li")].find((e) => e.innerText.includes("Ikinci"));
  return li && li.querySelector("button.secili.t-late");
}, null, { timeout: 10000 });
ok("Gec odev +10 EXP verdi (DONE'dan az)", expToplam("Ikinci") === 10, `exp=${expToplam("Ikinci")}`);

// --- G. Ayni teslim ikinci kez EXP vermiyor ---
console.log("\nG. Cift EXP korumasi");
await asliSatiri.getByRole("button", { name: "Bekliyor" }).click();
await sayfa.waitForFunction(() => {
  const li = [...document.querySelectorAll("li")].find((e) => e.innerText.includes("Deren"));
  return li && li.querySelector("button.secili.t-pending");
}, null, { timeout: 10000 });
await asliSatiri.getByRole("button", { name: "Yapıldı" }).click();
await sayfa.waitForFunction(() => {
  const li = [...document.querySelectorAll("li")].find((e) => e.innerText.includes("Deren"));
  return li && li.querySelector("button.secili.t-done");
}, null, { timeout: 10000 });
ok("Ikinci kez Yapildi EXP eklemedi", expToplam("Deren") === 30, `exp=${expToplam("Deren")}`);
ok("Odev icin tek EXP olayi var",
   Number(sql(`SELECT count(*) FROM "ExpEvent" WHERE source='ODEV_TAMAMLANDI' AND "referenceId" IN (SELECT s.id FROM "Submission" s JOIN "Student" st ON st.id=s."studentId" WHERE st."firstName"='Deren');`)) === 1);

// --- H. Modulu kapatinca gorunmuyor ---
console.log("\nH. Modulu kapat");
await sayfa.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
await gamificationFormu().getByRole("checkbox").uncheck();
await gamificationFormu().getByRole("button", { name: "Kaydet" }).click();
await bekle("Ayar kaydedildi.");
await sayfa.goto(SINIF_URL, { waitUntil: "networkidle" });
ok("Kapatinca seviye rozeti yok", (await satir("Deren").locator(".rozet-seviye").count()) === 0);
await satir("Deren").getByRole("link", { name: /Deren/ }).click();
await sayfa.getByRole("heading", { name: "Deren Bir" }).waitFor();
ok("Ogrenci sayfasinda da Seviye yazmiyor", !(await govde()).includes("Seviye"));
ok("Ama EXP veride duruyor (kaybolmadi)", expToplam("Deren") === 30, `exp=${expToplam("Deren")}`);

console.log(`\n${gecti} gecti, ${kaldi} kaldi`);
await tarayici.close();
process.exit(kaldi === 0 ? 0 : 1);
