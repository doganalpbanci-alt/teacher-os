// Ders yönetimi testi: ders başlatma ve bitirme, aynı anda tek ders kuralı,
// bitmiş derse kayıt yazılamaması, ders geçmişi ve ders detayı.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. SESSION_SECRET tanımlı olacak şekilde: npm run build && npm start
//   3. npm install --no-save playwright
//   4. SQL_KOMUTU='psql "$DATABASE_URL" -q -tA' node scripts/lesson-ui-test.mjs
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
// Iki sekme ayni oturumu paylassin: eskimis form gonderimleri boyle denenir.
const baglam = await tarayici.newContext();
const sayfa = await baglam.newPage();
await oturumHazirla(sayfa, T);

const satir = (ad) => sayfa.locator("li").filter({ hasText: ad });
const govde = () => sayfa.textContent("body");
async function bas(ad, etiket) {
  const onceki = await satir(ad).evaluate((e) => e.innerText);
  await satir(ad).getByRole("button", { name: etiket }).click();
  await sayfa.waitForFunction(([n, x]) => {
    const e = [...document.querySelectorAll("li")].find((q) => q.innerText.includes(n));
    return e && e.innerText !== x;
  }, [ad, onceki], { timeout: 10000 });
  await sayfa.waitForTimeout(300);
}
const acikDers = () => sql(`SELECT count(*) FROM "Lesson" WHERE "endedAt" IS NULL;`);
const toplamDers = () => sql(`SELECT count(*) FROM "Lesson";`);

// --- A: Hazirlik ---
console.log("\nA. Hazirlik");
await sayfa.goto(T, { waitUntil: "networkidle" });
await sayfa.getByLabel("Sınıf adı").fill("Ders-Test");
await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Ders-Test"), null, { timeout: 10000 });
await sayfa.getByRole("link", { name: /Ders-Test/ }).click();
await sayfa.getByRole("heading", { name: "Ders-Test" }).waitFor();
const sinifAdresi = sayfa.url();
for (const [a, b] of [["Ada", "Bir"], ["Efe", "Iki"]]) {
  await ogrenciFormunuAc(sayfa);
  await sayfa.getByLabel("Ad", { exact: true }).fill(a);
  await sayfa.getByLabel("Soyad").fill(b);
  await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
  await sayfa.waitForFunction((x) => document.body.innerText.includes(x), a, { timeout: 10000 });
}
ok("Baslangicta ders yok", toplamDers() === "0", `ders=${toplamDers()}`);

// --- B: Ders yokken ---
console.log("\nB. Ders yokken");
ok("Aktif ders yok uyarisi", (await govde()).includes("Aktif ders yok"));
ok("Baslat dugmesi var", (await sayfa.getByRole("button", { name: "Yeni ders başlat" }).count()) === 1);
ok("Bitir dugmesi YOK", (await sayfa.getByRole("button", { name: "Dersi bitir" }).count()) === 0);
ok("Davranis dugmesi pasif", await satir("Ada").getByRole("button", { name: "Artı ver" }).isDisabled());

// Ikinci sekme bu haliyle bekletilir: icindeki "ders baslat" formu eskiyecek.
const ikinci = await baglam.newPage();
await ikinci.goto(sinifAdresi, { waitUntil: "networkidle" });

await sayfa.getByRole("link", { name: /Ders geçmişi/ }).click();
await sayfa.getByRole("heading", { name: "Ders geçmişi" }).waitFor();
ok("Bos gecmis mesaji", (await govde()).includes("henüz ders işlenmedi"));
await sayfa.goBack({ waitUntil: "networkidle" });

// --- C: Ders baslatma ---
console.log("\nC. Ders baslatma");
await sayfa.getByRole("button", { name: "Yeni ders başlat" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("1. ders"), null, { timeout: 10000 });
ok("Ders basladi", (await govde()).includes("1. ders"));
ok("Bitir dugmesi geldi", (await sayfa.getByRole("button", { name: "Dersi bitir" }).count()) === 1);
ok("Baslat dugmesi kalkti", (await sayfa.getByRole("button", { name: "Yeni ders başlat" }).count()) === 0);
ok("Davranis dugmesi aktif", !(await satir("Ada").getByRole("button", { name: "Artı ver" }).isDisabled()));
ok("Veritabaninda acik ders var", acikDers() === "1", `acik=${acikDers()}`);

await bas("Ada", "Artı ver");
await bas("Ada", "Artı ver");
await bas("Efe", "Eksi ver");
ok("Kayitlar islendi", (await satir("Ada").evaluate((e) => e.innerText)).includes("2 artı"));

// --- D: Ayni anda tek ders ---
console.log("\nD. Ayni anda tek ders");
// Eskimis sekmedeki form hala "yeni ders baslat" diyor; sunucu reddetmeli.
await ikinci.getByRole("button", { name: "Yeni ders başlat" }).click();
await ikinci.waitForSelector(".hata", { timeout: 10000 });
ok("Ikinci ders ACILMADI", (await ikinci.textContent(".hata")).includes("süren bir ders var"),
   await ikinci.textContent(".hata"));
ok("Veritabaninda tek ders", toplamDers() === "1", `ders=${toplamDers()}`);

// Uygulama kontrolu atlansa bile veritabani ikinci acik dersi kabul etmemeli.
// Kural iki katmanli: buradaki dogrudan INSERT, uygulamayi devre disi birakip
// yalnizca veritabani garantisini sinar. Bu kisit olmadan telefon ve akilli
// tahtadan ayni anda basmak iki ders aciyordu.
// Hata mesajina degil sonuca bakilir: psql ifade hatasinda da 0 donebilir,
// o yuzden "kayit olustu mu" sorusu tek guvenilir olcut.
const sinifIdSql = sql(`SELECT "classroomId" FROM "Lesson" LIMIT 1;`);
const yarismaOncesi = toplamDers();
try {
  sql(`INSERT INTO "Lesson" (id,"classroomId",date,"createdAt")
       VALUES ('l-yarisma','${sinifIdSql}', now(), now());`);
} catch {
  // Kisit reddetti; beklenen.
}
ok("Veritabani ikinci acik dersi REDDETTI", toplamDers() === yarismaOncesi,
   `once=${yarismaOncesi} sonra=${toplamDers()}`);
ok("Yarisma sonrasi hala tek ders", toplamDers() === "1", `ders=${toplamDers()}`);

// --- E: Ders bitirme ---
console.log("\nE. Ders bitirme");
// Ikinci sekme aktif dersi gorsun: bitirildikten sonra eskimis kayit denemesi
// buradan yapilacak.
await ikinci.reload({ waitUntil: "networkidle" });
await sayfa.getByRole("button", { name: "Dersi bitir" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Aktif ders yok"), null, { timeout: 10000 });
ok("Ders bitti", (await govde()).includes("Aktif ders yok"));
ok("Bitis veritabanina yazildi", acikDers() === "0", `acik=${acikDers()}`);
ok("Ders kaydi silinmedi", toplamDers() === "1", `ders=${toplamDers()}`);
ok("Davranis dugmesi yine pasif", await satir("Ada").getByRole("button", { name: "Artı ver" }).isDisabled());

// --- F: Bitmis derse kayit yazilamaz ---
console.log("\nF. Bitmis ders");
const kayitSayisi = () => sql(`SELECT count(*) FROM "BehaviorLog";`);
const oncekiKayit = kayitSayisi();
await ikinci.locator("li").filter({ hasText: "Ada" })
  .getByRole("button", { name: "Artı ver" }).click();
await ikinci.waitForSelector(".hata", { timeout: 10000 });
ok("Bitmis derse kayit REDDEDILDI", (await ikinci.textContent(".hata")).includes("Bu ders bitmiş"),
   await ikinci.textContent(".hata"));
ok("Kayit sayisi degismedi", kayitSayisi() === oncekiKayit, `once=${oncekiKayit} sonra=${kayitSayisi()}`);
await ikinci.close();

// --- G: Ikinci ders ---
console.log("\nG. Ikinci ders");
await sayfa.getByRole("button", { name: "Yeni ders başlat" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("2. ders"), null, { timeout: 10000 });
ok("Ayni gun ikinci ders acildi", (await govde()).includes("2. ders"));
await bas("Ada", "Artı ver");
ok("Yeni derse kayit yazildi", kayitSayisi() === "4", `kayit=${kayitSayisi()}`);

// --- H: Ders gecmisi ---
console.log("\nH. Ders gecmisi");
await sayfa.getByRole("link", { name: /Ders geçmişi/ }).click();
await sayfa.getByRole("heading", { name: "Ders geçmişi" }).waitFor();
const gecmis = await govde();
ok("Iki ders listelendi", (await sayfa.locator(".liste li").count()) === 2,
   String(await sayfa.locator(".liste li").count()));
ok("Suren ders isaretli", gecmis.includes("Sürüyor"));
ok("Biten dersin bitis saati var", /bitiş \d{2}:\d{2}/.test(gecmis), gecmis.replace(/\s+/g, " ").slice(0, 300));
const ilkDersSatiri = sayfa.locator(".liste li").filter({ hasText: "1. ders" });
ok("Biten dersin sayimlari dogru",
   (await ilkDersSatiri.innerText()).includes("2 artı · 1 eksi"), await ilkDersSatiri.innerText());
ok("Suren derste sayim guncel",
   (await sayfa.locator(".liste li").filter({ hasText: "2. ders" }).innerText()).includes("1 artı"),
   await sayfa.locator(".liste li").filter({ hasText: "2. ders" }).innerText());

// --- I: Ders detayi ---
console.log("\nI. Ders detayi");
await ilkDersSatiri.getByRole("link").click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Bitiş"), null, { timeout: 10000 });
const detay = await govde();
ok("Ders basligi dogru", detay.includes("1. ders"));
ok("Bitis saati yazili", /Bitiş \d{2}:\d{2}/.test(detay), detay.replace(/\s+/g, " ").slice(0, 200));
ok("Iki ogrenci listelendi", (await sayfa.locator(".gecmis-baslik").count()) === 2,
   String(await sayfa.locator(".gecmis-baslik").count()));
const adaBolumu = sayfa.locator(".gecmis section, section").filter({ hasText: "Ada Bir" }).last();
ok("Ada'nin iki artisi var", ((await adaBolumu.innerText()).match(/Artı/g) || []).length === 2,
   await adaBolumu.innerText());
ok("Efe'nin eksisi var", detay.includes("Eksi"));
ok("Sonraki dersin kaydi SIZMADI", ((detay.match(/Artı/g) || []).length) === 2,
   `artı=${(detay.match(/Artı/g) || []).length}`);
const dersAdresi = sayfa.url();
const dersId = dersAdresi.split("/").pop();

// --- J: Sahiplik ---
console.log("\nJ. Sahiplik");
let yanit = await sayfa.goto(`${sinifAdresi}/dersler/olmayan-ders`, { waitUntil: "networkidle" });
ok("Olmayan ders 404", yanit.status() === 404, `durum=${yanit.status()}`);

sql(`
INSERT INTO "Teacher" (id, email, name, "passwordHash", "createdAt")
VALUES ('t-yabanci', 'yabanci@ornek.com', 'Yabancı', '!parola-yok', now());
INSERT INTO "Classroom" (id, "teacherId", name, "isActive", "createdAt")
VALUES ('c-yabanci', 't-yabanci', 'Yabancı Sınıf', true, now());
INSERT INTO "Lesson" (id, "classroomId", date, "createdAt")
VALUES ('l-yabanci', 'c-yabanci', now(), now());
`);
yanit = await sayfa.goto(`${T}/sinif/c-yabanci/dersler`, { waitUntil: "networkidle" });
ok("Baskasinin ders gecmisi 404", yanit.status() === 404, `durum=${yanit.status()}`);
yanit = await sayfa.goto(`${T}/sinif/c-yabanci/dersler/l-yabanci`, { waitUntil: "networkidle" });
ok("Baskasinin ders detayi 404", yanit.status() === 404, `durum=${yanit.status()}`);
// Ders id dogru ama sinif baska: adres uydurularak baska derse bakilamaz.
yanit = await sayfa.goto(`${T}/sinif/c-yabanci/dersler/${dersId}`, { waitUntil: "networkidle" });
ok("Yanlis sinif altinda ders 404", yanit.status() === 404, `durum=${yanit.status()}`);

await tarayici.close();
console.log(`\n=== SONUC: ${gecti} gecti, ${kaldi} kaldi ===`);
process.exit(kaldi === 0 ? 0 : 1);
