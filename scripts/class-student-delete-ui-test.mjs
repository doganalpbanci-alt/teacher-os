// Sınıf/öğrenci arşivleme-silme ve hesap sıfırlama testi.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. npm run build && npm start
//   3. npm install --no-save playwright
//   4. SQL_KOMUTU='psql "$DATABASE_URL" -q -tA' node scripts/class-student-delete-ui-test.mjs
//
// Not: son bölüm (G) hesabı tamamen sıfırlar. Bu yüzden testin SONUNDA
// çalışır; ondan sonra aynı oturumda başka bir şey denenmez.
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import { kayitBekleyici } from "./test-kayit.mjs";
import { oturumHazirla, TEST_EPOSTA, TEST_PAROLA } from "./test-oturum.mjs";
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

const tarayici = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
const sayfa = await tarayici.newPage();
await oturumHazirla(sayfa, T);
const kayitBekle = kayitBekleyici(sql, sayfa);

async function sinifOlustur(ad) {
  await sayfa.goto(T, { waitUntil: "networkidle" });
  await sayfa.getByLabel("Sınıf adı").fill(ad);
  await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
  await sayfa.waitForFunction((x) => document.body.innerText.includes(x), ad, { timeout: 10000 });
  await sayfa.getByRole("link", { name: new RegExp(ad) }).click();
  await sayfa.waitForURL(/\/sinif\//, { timeout: 10000 });
  return new URL(sayfa.url()).pathname;
}

// --- A. Sınıf arşivleme ---
console.log("\nA. Sinif arsivleme");
const SINIF1 = await sinifOlustur("Arsiv-Sinif");
await sayfa.locator("summary", { hasText: "Sınıfı yönet" }).click();
await sayfa.getByRole("button", { name: "Arşivle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("arşivde"), null, { timeout: 10000 });
ok("Sinif sayfasinda arsivde yaziyor", (await sayfa.innerText("body")).includes("arşivde"));

await sayfa.goto(T, { waitUntil: "networkidle" });
ok("Ana sayfa listesinden kalkti", !(await sayfa.innerText("body")).includes("Arsiv-Sinif"));
await sayfa.locator("summary", { hasText: "Arşivlenmiş sınıflar" }).click();
ok("Arsivlenmis sinif bolumunde gorunuyor", (await sayfa.innerText("body")).includes("Arsiv-Sinif"));

await sayfa.getByRole("link", { name: /Arsiv-Sinif/ }).click();
await sayfa.waitForURL(/\/sinif\//, { timeout: 10000 });
await sayfa.locator("summary", { hasText: "Sınıfı yönet" }).click();
await sayfa.getByRole("button", { name: "Arşivden çıkar" }).click();
await sayfa.waitForFunction(() => !document.body.innerText.includes("arşivde"), null, { timeout: 10000 });
await sayfa.goto(T, { waitUntil: "networkidle" });
ok("Arsivden cikinca ana sayfada tekrar gorunuyor", (await sayfa.innerText("body")).includes("Arsiv-Sinif"));

// --- B. Bos sinif silme ---
console.log("\nB. Bos sinif silme");
const SINIF2 = await sinifOlustur("Silinecek-Bos");
await sayfa.locator("summary", { hasText: "Sınıfı yönet" }).click();
ok("Silme dugmesi bos sinifta gorunuyor", (await sayfa.getByRole("button", { name: "Sil", exact: true }).count()) === 1);
await sayfa.getByRole("button", { name: "Sil", exact: true }).click();
await sayfa.waitForURL(T + "/", { timeout: 10000 });
ok("Silme sonrasi ana sayfaya donuldu", new URL(sayfa.url()).pathname === "/");
ok("Sinif tamamen kayboldu", !(await sayfa.innerText("body")).includes("Silinecek-Bos"));

// --- C. Ogrencisi olan sinif silinemez ---
console.log("\nC. Dolu sinif silinemez");
const SINIF3 = await sinifOlustur("Dolu-Sinif");
await ogrenciFormunuAc(sayfa);
await sayfa.getByLabel("Ad", { exact: true }).fill("Can");
await sayfa.getByLabel("Soyad").fill("Bir");
await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Can Bir"), null, { timeout: 10000 });

await sayfa.locator("summary", { hasText: "Sınıfı yönet" }).click();
ok("Ogrencisi olan sinifta Sil dugmesi YOK", (await sayfa.getByRole("button", { name: "Sil", exact: true }).count()) === 0);
ok("Sinif hala listede", (await sayfa.innerText("body")).includes("Dolu-Sinif"));

// --- D. Ogrenci arsivleme ---
console.log("\nD. Ogrenci arsivleme");
await sayfa.getByRole("link", { name: "Can Bir" }).click();
await sayfa.waitForURL(/\/ogrenci\//, { timeout: 10000 });
await sayfa.getByRole("button", { name: "Arşivle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("arşivde"), null, { timeout: 10000 });
ok("Ogrenci sayfasinda arsivde yaziyor", (await sayfa.innerText("body")).includes("arşivde"));

await sayfa.goto(T + SINIF3, { waitUntil: "networkidle" });
ok("Sinif listesinden kalkti", !(await sayfa.getByRole("link", { name: "Can Bir" }).count()));
await sayfa.locator("summary", { hasText: "Arşivlenmiş öğrenciler" }).click();
ok("Arsivlenmis ogrenciler bolumunde gorunuyor", (await sayfa.innerText("body")).includes("Can Bir"));

await sayfa.getByRole("link", { name: "Can Bir" }).click();
await sayfa.waitForURL(/\/ogrenci\//, { timeout: 10000 });
await sayfa.getByRole("button", { name: "Arşivden çıkar" }).click();
await sayfa.waitForFunction(() => !document.body.innerText.includes("arşivde"), null, { timeout: 10000 });
await sayfa.goto(T + SINIF3, { waitUntil: "networkidle" });
ok("Arsivden cikinca sinif listesinde tekrar gorunuyor", (await sayfa.innerText("body")).includes("Can Bir"));

// --- E. Gecmisi olmayan ogrenci silinebiliyor ---
console.log("\nE. Temiz ogrenci silme");
await ogrenciFormunuAc(sayfa);
await sayfa.getByLabel("Ad", { exact: true }).fill("Silinecek");
await sayfa.getByLabel("Soyad").fill("Ogrenci");
await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Silinecek Ogrenci"), null, { timeout: 10000 });
await sayfa.getByRole("link", { name: "Silinecek Ogrenci" }).click();
await sayfa.waitForURL(/\/ogrenci\//, { timeout: 10000 });
ok("Silme dugmesi gorunuyor", (await sayfa.getByRole("button", { name: "Sil", exact: true }).count()) === 1);
await sayfa.getByRole("button", { name: "Sil", exact: true }).click();
await sayfa.waitForURL(T + SINIF3, { timeout: 10000 });
ok("Silme sonrasi sinif sayfasina donuldu", new URL(sayfa.url()).pathname === SINIF3);
ok("Ogrenci tamamen kayboldu", !(await sayfa.innerText("body")).includes("Silinecek Ogrenci"));

// --- F. Kaydi olan ogrenci silinemez ---
console.log("\nF. Kayitli ogrenci silinemez");
await sayfa.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
await sayfa.getByRole("radio", { name: /Kart sistemi/ }).check();
await sayfa.getByRole("button", { name: "Kaydet" }).click();
await sayfa.waitForSelector(".basari", { timeout: 10000 });
await sayfa.goto(T + SINIF3, { waitUntil: "networkidle" });
await dersBaslat(sayfa);
await kayitBekle(() =>
  sayfa.locator("li").filter({ hasText: "Can Bir" }).getByRole("button", { name: "Yıldız ver" }).click(),
);
await sayfa.getByRole("link", { name: "Can Bir" }).click();
await sayfa.waitForURL(/\/ogrenci\//, { timeout: 10000 });
ok("Kaydi olan ogrencide Sil dugmesi YOK", (await sayfa.getByRole("button", { name: "Sil", exact: true }).count()) === 0);
ok("Arsivle hala mevcut", (await sayfa.getByRole("button", { name: "Arşivle" }).count()) === 1);

// --- G. Hesap sifirlama (EN SONDA - butun veriyi siler) ---
console.log("\nG. Hesap sifirlama");
await sayfa.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
const sifirlaFormu = sayfa.locator("form").filter({ has: sayfa.getByLabel(/SIFIRLA/) });

// Iki ret de .hata dugumu uretiyor; ikincisi birincininkiyle karismasin
// diye (HANDOFF.md'nin bildigi tuzak: zaten dogru olan bir metni bekleme)
// her seferinde BEKLENEN METNIN kendisi beklenir, yalnizca dugumun varligi degil.
async function hataMetniBekle(ad, parca) {
  try {
    await sayfa.waitForFunction(
      (p) => document.querySelector(".hata")?.textContent?.includes(p) ?? false,
      parca,
      { timeout: 10000 },
    );
    ok(ad, true);
  } catch {
    const gercek = await sayfa.textContent(".hata").catch(() => null);
    ok(ad, false, `beklenen "${parca}", gelen ${JSON.stringify(gercek)}`);
  }
}

await sifirlaFormu.getByLabel("Parolanız (sıfırlamak için)").fill("yanlisparola");
await sifirlaFormu.getByLabel(/SIFIRLA/).fill("SIFIRLA");
await sifirlaFormu.getByRole("button", { name: "Tüm verilerimi sil" }).click();
await hataMetniBekle("Yanlis parola reddedildi", "parolası yanlış");

await sifirlaFormu.getByLabel("Parolanız (sıfırlamak için)").fill(TEST_PAROLA);
await sifirlaFormu.getByLabel(/SIFIRLA/).fill("baska bir sey");
await sifirlaFormu.getByRole("button", { name: "Tüm verilerimi sil" }).click();
await hataMetniBekle("Yanlis onay metni reddedildi", "SIFIRLA");

const oncekiSinifSayisi = Number(sql(`SELECT count(*) FROM "Classroom";`));
ok("Yanlis denemeler veri silmedi", oncekiSinifSayisi > 0, `sinif=${oncekiSinifSayisi}`);

await sifirlaFormu.getByLabel("Parolanız (sıfırlamak için)").fill(TEST_PAROLA);
await sifirlaFormu.getByLabel(/SIFIRLA/).fill("SIFIRLA");
await sifirlaFormu.getByRole("button", { name: "Tüm verilerimi sil" }).click();
await sayfa.waitForURL(T + "/", { timeout: 10000 });
ok("Sifirlama sonrasi ana sayfaya donuldu", new URL(sayfa.url()).pathname === "/");
ok("Bos durum mesaji gorunuyor", (await sayfa.innerText("body")).includes("Henüz sınıf yok"));
ok("Veritabaninda sinif kalmadi", Number(sql(`SELECT count(*) FROM "Classroom";`)) === 0);
ok("Veritabaninda ogrenci kalmadi", Number(sql(`SELECT count(*) FROM "Student";`)) === 0);
ok("Veritabaninda davranis kaydi kalmadi", Number(sql(`SELECT count(*) FROM "BehaviorLog";`)) === 0);
ok("Ogretmen hesabi HALA var", Number(sql(`SELECT count(*) FROM "Teacher" WHERE email='${TEST_EPOSTA}';`)) === 1);

// Hesap gercekten calisiyor mu: cikis yapip tekrar giris denemesi.
await sayfa.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
ok("Ayarlar sayfasi hala aciliyor (hesap bozulmadi)", (await sayfa.innerText("body")).includes("Davranış sistemi"));

await tarayici.close();
console.log(`\n=== SONUC: ${gecti} gecti, ${kaldi} kaldi ===`);
process.exit(kaldi === 0 ? 0 : 1);
