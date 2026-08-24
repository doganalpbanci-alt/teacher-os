// Giriş sistemi ve veri ayrımı testi: kurulum akışı, giriş, çıkış, korumalı
// sayfalar ve başka bir öğretmenin verisine erişme denemeleri.
//
// Bu test veritabanına doğrudan SQL yazar (ikinci öğretmeni oluşturmak için),
// çünkü kurulum bir kez yapılır ve kayıt sayfası sonrasında kapalıdır.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla. Test veriyi
//      TRUNCATE eder; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. SESSION_SECRET tanımlı olacak şekilde: npm run build && npm start
//   3. npm install --no-save playwright
//   4. SQL_KOMUTU='psql "$DATABASE_URL" -q -tA' node scripts/auth-ui-test.mjs
//
// SQL_KOMUTU stdin'den SQL okuyan bir komuttur; verilmezse psql varsayılır.
import { execSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { chromium } from "playwright";
import { ogrenciFormunuAc } from "./test-form.mjs";

const T = process.env.TEMEL_ADRES ?? "http://127.0.0.1:3000";
// SQL calistirma komutu; stdin'den SQL okur.
const SQL_KOMUTU = process.env.SQL_KOMUTU ?? 'psql "$DATABASE_URL" -q';
const sql = (metin) =>
  execSync(SQL_KOMUTU, { input: metin, shell: "/bin/bash", stdio: ["pipe", "pipe", "pipe"] });

let gecti = 0, kaldi = 0;
function ok(ad, kosul, ayrinti = "") {
  if (kosul) { gecti++; console.log(`  GECTI  ${ad}`); }
  else { kaldi++; console.log(`  KALDI  ${ad}${ayrinti ? "  -> " + ayrinti : ""}`); }
}

// --- Hazirlik: giris sistemi ONCESINDE olusmus gibi veri ---
sql(`
TRUNCATE "BehaviorLog", "Lesson", "Student", "Classroom", "Teacher" CASCADE;
INSERT INTO "Teacher" (id, email, name, "passwordHash", "createdAt")
VALUES ('t-gecici', 'ogretmen@teacher-os.local', 'Öğretmen', '!giris-sistemi-yok', now());
INSERT INTO "Classroom" (id, "teacherId", name, "isActive", "createdAt")
VALUES ('c-eski', 't-gecici', '12-A', true, now());
INSERT INTO "Student" (id, "classroomId", "firstName", "lastName", "performanceScore", "isActive", "createdAt")
VALUES ('s-eski', 'c-eski', 'Eski', 'Kayit', 90, true, now());
`);

const tarayici = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
const s = await tarayici.newPage();

// --- A: Hesap yokken ---
console.log("\nA. Hesap yokken");
await s.goto(T, { waitUntil: "networkidle" });
ok("Ana sayfa kuruluma yonlendirdi", s.url().endsWith("/kurulum"), s.url());
await s.goto(`${T}/sinif/c-eski`, { waitUntil: "networkidle" });
ok("Sinif sayfasi da korumali", s.url().endsWith("/kurulum"), s.url());
await s.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
ok("Ayarlar da korumali", s.url().endsWith("/kurulum"), s.url());

// --- B: Kurulum dogrulamalari ---
console.log("\nB. Kurulum dogrulamalari");
await s.goto(`${T}/kurulum`, { waitUntil: "networkidle" });
await s.getByLabel("Adınız").fill("Doğanalp");
await s.getByLabel("E-posta", { exact: true }).fill("gecersiz-eposta");
await s.getByLabel("Parola", { exact: true }).fill("uzunparola1");
await s.getByLabel("Parola tekrar").fill("uzunparola1");
await s.getByRole("button", { name: "Hesabı oluştur" }).click();
await s.waitForTimeout(1200);
ok("Tarayici gecersiz e-postayi gondermedi",
  (await s.getByLabel("E-posta", { exact: true }).evaluate((el) => el.checkValidity())) === false);

// type="email" kaldirilirsa sunucu koruyor mu? Yazma ve gonderme tek adimda.
await s.getByLabel("E-posta", { exact: true }).evaluate((el) => {
  el.removeAttribute("type");
  const yaz = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  yaz.call(el, "gecersiz-eposta");
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.form.requestSubmit();
});
await s.waitForSelector(".hata", { timeout: 10000 });
ok("Sunucu gecersiz e-postayi reddetti", (await s.textContent(".hata")).includes("Geçerli bir e-posta"));

await s.getByLabel("E-posta", { exact: true }).fill("test@ornek.com");
await s.getByLabel("Parola", { exact: true }).fill("kisa");
await s.getByLabel("Parola tekrar").fill("kisa");
await s.getByRole("button", { name: "Hesabı oluştur" }).click();
await s.waitForTimeout(1500);
ok("Kisa parola reddedildi", (await s.textContent(".hata")).includes("en az 8 karakter"));

await s.getByLabel("Parola", { exact: true }).fill("uzunparola1");
await s.getByLabel("Parola tekrar").fill("baskaparola1");
await s.getByRole("button", { name: "Hesabı oluştur" }).click();
await s.waitForTimeout(1500);
ok("Eslesmeyen parola reddedildi", (await s.textContent(".hata")).includes("aynı değil"));
ok("Ad korundu", (await s.getByLabel("Adınız").inputValue()) === "Doğanalp");

// --- C: Kurulum ---
console.log("\nC. Kurulum");
await s.getByLabel("Parola", { exact: true }).fill("uzunparola1");
await s.getByLabel("Parola tekrar").fill("uzunparola1");
await s.getByRole("button", { name: "Hesabı oluştur" }).click();
await s.waitForURL(`${T}/`, { timeout: 20000 });
const govde = await s.textContent("body");
ok("ESKI VERI DEVRALINDI (12-A goruluyor)", govde.includes("12-A"), govde.replace(/\s+/g, " ").slice(0, 200));
const kayitSayisi = sql(`SELECT count(*) FROM "Teacher";`).toString().match(/\d+/)?.[0];
ok("Yeni ogretmen ACILMADI, mevcut devralindi", kayitSayisi === "1", `ogretmen sayisi=${kayitSayisi}`);
await s.goto(`${T}/kurulum`, { waitUntil: "networkidle" });
// Kurulum -> giris -> (zaten oturum acik oldugu icin) ana sayfa.
ok("Kurulum sayfasi artik kapali", !s.url().includes("/kurulum"), s.url());
ok("Kurulum formu goruntulenmiyor",
  (await s.getByRole("button", { name: "Hesabı oluştur" }).count()) === 0);

// --- D: Cikis ---
console.log("\nD. Cikis");
await s.goto(T, { waitUntil: "networkidle" });
await s.getByRole("button", { name: "Çıkış" }).click();
await s.waitForURL(/\/giris$/, { timeout: 10000 });
ok("Cikis giris sayfasina goturdu", s.url().endsWith("/giris"));
await s.goto(`${T}/sinif/c-eski`, { waitUntil: "networkidle" });
ok("Cikis sonrasi sayfalar korumali", s.url().endsWith("/giris"), s.url());

// --- E: Giris ---
console.log("\nE. Giris");
await s.getByLabel("E-posta").fill("test@ornek.com");
await s.getByLabel("Parola").fill("yanlisparola");
await s.getByRole("button", { name: "Giriş yap" }).click();
await s.waitForSelector(".hata", { timeout: 10000 });
ok("Yanlis parola reddedildi", (await s.textContent(".hata")) === "E-posta veya parola hatalı.");
await s.getByLabel("E-posta").fill("yok@ornek.com");
await s.getByLabel("Parola").fill("uzunparola1");
await s.getByRole("button", { name: "Giriş yap" }).click();
await s.waitForTimeout(1500);
ok("Olmayan hesap AYNI mesaji verdi", (await s.textContent(".hata")) === "E-posta veya parola hatalı.");
await s.getByLabel("E-posta").fill("test@ornek.com");
await s.getByLabel("Parola").fill("uzunparola1");
await s.getByRole("button", { name: "Giriş yap" }).click();
await s.waitForURL(`${T}/`, { timeout: 20000 });
ok("Dogru parola ile girildi", (await s.textContent("body")).includes("12-A"));

// --- F: Veri ayrimi ---
console.log("\nF. Veri ayrimi");
const hash = bcrypt.hashSync("ikinci-parola-123", 12);
sql(`
INSERT INTO "Teacher" (id, email, name, "passwordHash", "createdAt")
VALUES ('t-ikinci', 'ikinci@ornek.com', 'İkinci Öğretmen', '${hash}', now());
INSERT INTO "Classroom" (id, "teacherId", name, "isActive", "createdAt")
VALUES ('c-ikinci', 't-ikinci', 'Kendi Sınıfım', true, now());
`);

const s2 = await (await tarayici.newContext()).newPage();
await s2.goto(`${T}/giris`, { waitUntil: "networkidle" });
await s2.getByLabel("E-posta").fill("ikinci@ornek.com");
await s2.getByLabel("Parola").fill("ikinci-parola-123");
await s2.getByRole("button", { name: "Giriş yap" }).click();
await s2.waitForURL(`${T}/`, { timeout: 20000 });
const g2 = await s2.textContent("body");
ok("Ikinci ogretmen kendi sinifini goruyor", g2.includes("Kendi Sınıfım"));
ok("Ilk ogretmenin sinifini GORMUYOR", !g2.includes("12-A"), g2.replace(/\s+/g, " ").slice(0, 200));

let y = await s2.goto(`${T}/sinif/c-eski`, { waitUntil: "networkidle" });
ok("Baskasinin sinif adresi 404", y.status() === 404, `durum=${y.status()}`);
y = await s2.goto(`${T}/ogrenci/s-eski`, { waitUntil: "networkidle" });
ok("Baskasinin ogrenci adresi 404", y.status() === 404, `durum=${y.status()}`);

// --- G: Sunucu tarafi yetki ---
console.log("\nG. Form kurcalayarak yetki asma denemesi");
await s2.goto(`${T}/sinif/c-ikinci`, { waitUntil: "networkidle" });
await ogrenciFormunuAc(s2);
await s2.getByLabel("Ad", { exact: true }).fill("Sizinti");
await s2.getByLabel("Soyad").fill("Denemesi");
// Sayfada iki form da sinifId tasiyor; ogrenci formundaki degistirilir.
const ogrenciFormu = s2.locator("form").filter({ hasText: "Öğrenci ekle" });
await ogrenciFormu.locator('input[name="sinifId"]').evaluate((el) => {
  const yaz = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  yaz.call(el, "c-eski");
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
await s2.getByRole("button", { name: "Öğrenci ekle" }).click();
await s2.waitForSelector(".hata", { timeout: 10000 });
ok("Baskasinin sinifina ogrenci EKLENEMEDI",
   (await s2.textContent(".hata")).includes("bulunamadı"), await s2.textContent(".hata"));

// Ayni sekilde baskasinin sinifinda ders baslatilamamali.
await s2.goto(`${T}/sinif/c-ikinci`, { waitUntil: "networkidle" });
const dersFormu = s2.locator("form").filter({ hasText: "Yeni ders başlat" });
await dersFormu.locator('input[name="sinifId"]').evaluate((el) => {
  const yaz = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  yaz.call(el, "c-eski");
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.form.requestSubmit();
});
await s2.waitForSelector(".hata", { timeout: 10000 });
ok("Baskasinin sinifinda ders BASLATILAMADI",
   (await s2.textContent(".hata")).includes("bulunamadı"), await s2.textContent(".hata"));
const dersSayisi = sql(`SELECT count(*) FROM "Lesson" WHERE "classroomId"='c-eski';`).toString().match(/\d+/)?.[0];
ok("Veritabaninda ders olusmadi", dersSayisi === "0", `bulunan=${dersSayisi}`);
const sizinti = sql(`SELECT count(*) FROM "Student" WHERE "firstName"='Sizinti';`).toString().match(/\d+/)?.[0];
ok("Veritabaninda da olusmadi", sizinti === "0", `bulunan=${sizinti}`);

await s.reload({ waitUntil: "networkidle" });
await s.getByRole("link", { name: /12-A/ }).click();
await s.getByRole("heading", { name: "12-A" }).waitFor();
ok("Ilk ogretmenin sinifi bozulmamis", !(await s.textContent("body")).includes("Sizinti"));

await tarayici.close();
console.log(`\n=== SONUC: ${gecti} gecti, ${kaldi} kaldi ===`);
process.exit(kaldi === 0 ? 0 : 1);
