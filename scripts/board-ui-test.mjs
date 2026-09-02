// Tahtanın canlı yayını: telefondan verilen kart genişçe bir ekranda anında
// görünür, ses çalar; dar ekranda (telefon) hiç etkinleşmez.
//
// Ayrı bir "tahta sayfası" yok — bkz. HANDOFF. Bileşen, sınıf ekranına
// eklenir ve globals.css'teki aynı 1280px eşiğinde kendini açar.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. SESSION_SECRET tanımlı olacak şekilde: npm run build && npm start
//   3. npm install --no-save playwright
//   4. node scripts/board-ui-test.mjs
import { execSync } from "node:child_process";
import bcrypt from "bcryptjs";
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

const tarayici = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);

// "Tahta" ve "telefon" ayrı bağlam VE ayrı viewport: bileşen genişliğe göre
// kendini açıp kapatıyor, bunu gerçekten iki farklı ekran boyutuyla sınamak
// gerekir.
const tahtaBaglami = await tarayici.newContext({ viewport: { width: 1366, height: 900 } });
const tahta = await tahtaBaglami.newPage();
await oturumHazirla(tahta, T);

const telefonBaglami = await tarayici.newContext({ viewport: { width: 390, height: 844 } });
const telefon = await telefonBaglami.newPage();
await oturumHazirla(telefon, T);

// --- A. Hazirlik ---
console.log("\nA. Hazirlik");
await tahta.goto(T, { waitUntil: "networkidle" });
await tahta.getByLabel("Sınıf adı").fill("Canli-Test");
await tahta.getByRole("button", { name: "Sınıf ekle" }).click();
await tahta.waitForFunction(() => document.body.innerText.includes("Canli-Test"), null, { timeout: 10000 });
await tahta.getByRole("link", { name: /Canli-Test/ }).click();
await tahta.waitForURL(/\/sinif\//, { timeout: 10000 });
const SINIF_ADRESI = new URL(tahta.url()).pathname;
ok("Sinif sayfasi acildi", /^\/sinif\/[^/]+$/.test(SINIF_ADRESI), SINIF_ADRESI);

await ogrenciFormunuAc(tahta);
await tahta.getByLabel("Ad", { exact: true }).fill("Elif");
await tahta.getByLabel("Soyad").fill("Demir");
await tahta.getByRole("button", { name: "Öğrenci ekle" }).click();
await tahta.waitForFunction(() => document.body.innerText.includes("Elif"), null, { timeout: 10000 });
await dersBaslat(tahta);
ok("Ders basladi", (await tahta.innerText("body")).includes(". ders"));

await telefon.goto(`${T}${SINIF_ADRESI}`, { waitUntil: "networkidle" });

const satir = (sayfa, ad) => sayfa.locator("li").filter({ hasText: ad });
const sesSayaci = (sayfa) => sayfa.evaluate(() => window.__tahtaSesSayaci ?? 0);
const yoklamaSayaci = (sayfa) => sayfa.evaluate(() => window.__tahtaYoklamaSayaci ?? 0);

// --- B. Genislik esigi ---
console.log("\nB. Genislik esigi");
await tahta.reload({ waitUntil: "networkidle" });
await tahta.waitForSelector(".canli-ses-dugmesi", { timeout: 10000 });
ok("Genis ekranda ses dugmesi var", (await tahta.locator(".canli-ses-dugmesi").count()) === 1);

await telefon.reload({ waitUntil: "networkidle" });
await telefon.waitForTimeout(1000);
ok("Dar ekranda ses dugmesi YOK", (await telefon.locator(".canli-ses-dugmesi").count()) === 0);
ok("Telefon hic yoklama yapmadi", (await yoklamaSayaci(telefon)) === 0);

// --- C. Telefondan verilen kart tahtada goruluyor ---
console.log("\nC. Canli yansima");
const yoklamaOncesi = await yoklamaSayaci(tahta);
await satir(telefon, "Elif").getByRole("button", { name: /Artı ver|Yıldız ver/ }).click();
await tahta.waitForFunction(
  () => document.querySelector(".canli-bildirim")?.innerText.includes("Elif"),
  null,
  { timeout: 8000 },
);
const bildirimMetni = await tahta.locator(".canli-bildirim").innerText();
ok("Bildirim ogrenci adini tasiyor", bildirimMetni.includes("Elif"));
ok("Yoklama gercekten calisiyordu", (await yoklamaSayaci(tahta)) > yoklamaOncesi);

await tahta.waitForFunction(() => document.querySelector(".canli-bildirim") === null, null, { timeout: 5000 });
ok("Bildirim kendiliginden kapandi", (await tahta.locator(".canli-bildirim").count()) === 0);

// Bildirim geciciydi; asil mesele altindaki listenin de tazelenmesi. Tahta
// bir ilan panosu gibi acik dururken sinifin okudugu sey o liste.
await tahta
  .locator("li")
  .filter({ hasText: "Elif" })
  .filter({ hasText: "1 artı" })
  .waitFor({ timeout: 8000 })
  .catch(() => {});
ok(
  "Alttaki liste de tazelendi (yenilemeden)",
  (await satir(tahta, "Elif").innerText()).includes("1 artı"),
  (await satir(tahta, "Elif").innerText()).replace(/\s+/g, " "),
);

// --- D. Ses yalnizca acilinca calar ---
console.log("\nD. Ses acma");
const sesOncesi = await sesSayaci(tahta);
await satir(telefon, "Elif").getByRole("button", { name: /Artı ver|Yıldız ver/ }).click();
await tahta.waitForFunction(() => document.querySelector(".canli-bildirim") !== null, null, { timeout: 8000 });
ok("Ses acilmadan sayac artmadi", (await sesSayaci(tahta)) === sesOncesi);

await tahta.getByRole("button", { name: /Sesi aç/ }).click();
await tahta.waitForSelector('button:has-text("Ses açık")', { timeout: 5000 });
await satir(telefon, "Elif").getByRole("button", { name: /Artı ver|Yıldız ver/ }).click();
await tahta.waitForFunction(
  (onceki) => (window.__tahtaSesSayaci ?? 0) > onceki,
  sesOncesi,
  { timeout: 8000 },
);
ok("Ses acilinca sayac artti", (await sesSayaci(tahta)) > sesOncesi);

// --- E. Kart sablonu: sari/kirmizi bildirimleri ve kirmizinin tekilligi ---
console.log("\nE. Kart sablonu");
await telefon.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
await telefon.getByRole("radio", { name: /Kart sistemi/ }).check();
await telefon.getByRole("button", { name: "Kaydet" }).click();
await telefon.waitForSelector(".basari", { timeout: 10000 });
await telefon.goto(`${T}${SINIF_ADRESI}`, { waitUntil: "networkidle" });
await tahta.reload({ waitUntil: "networkidle" });
await tahta.getByRole("button", { name: /Sesi aç/ }).click();

const sesOncesiKart = await sesSayaci(tahta);

await satir(telefon, "Elif").getByRole("button", { name: "Sarı kart ver" }).click();
await tahta.waitForFunction(
  () => document.querySelector(".canli-bildirim")?.innerText.includes("sarı kart"),
  null,
  { timeout: 8000 },
);
ok("Sari kart bildirimi goruldu", (await tahta.locator(".canli-bildirim").innerText()).includes("sarı kart"));
await tahta.waitForFunction(() => document.querySelector(".canli-bildirim") === null, null, { timeout: 5000 });

// Sari ustune sari kirmizidir: RED_CARD + otomatik MINUS tek olay yazar
// (davranisKaydet ikisini tek createMany ile, ayni createdAt ile yazar),
// tek bildirim gorunmeli, iki degil.
await satir(telefon, "Elif").getByRole("button", { name: "Sarı kart ver" }).click();
await tahta.waitForFunction(
  () => document.querySelector(".canli-bildirim")?.innerText.includes("kırmızı kart"),
  null,
  { timeout: 8000 },
);
ok("Kirmiziya yukselme bildirimi goruldu", (await tahta.locator(".canli-bildirim").innerText()).includes("kırmızı kart"));
await tahta.waitForFunction(() => document.querySelector(".canli-bildirim") === null, null, { timeout: 5000 });
// Ikinci bir bildirim gelseydi burada tekrar "canli-bildirim" belirirdi;
// gelmediginden emin olmak icin kisa bir sure daha beklenir.
await tahta.waitForTimeout(1500);
ok("Ayni eylem icin IKINCI bildirim gelmedi", (await tahta.locator(".canli-bildirim").count()) === 0);
ok(
  "Iki ogretmen eylemi tam iki ses caldi (otomatik MINUS ucuncu ses uretmedi)",
  (await sesSayaci(tahta)) === sesOncesiKart + 2,
  `${sesOncesiKart} -> ${await sesSayaci(tahta)}`,
);

// --- F. Kilitliyken de calisir ---
console.log("\nF. Kilitli tahtada canli yayin");
await tahta.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
const pinFormu = tahta.locator("form").filter({ has: tahta.getByLabel("Hesap parolanız") });
await pinFormu.getByLabel("Hesap parolanız").fill("uzunparola1");
await pinFormu.getByLabel(/tahta PIN'i|Tahta PIN'i/).first().fill("1357");
await pinFormu.getByLabel("PIN tekrar").fill("1357");
await pinFormu.getByRole("button", { name: /PIN'i (belirle|değiştir)/ }).click();
await tahta.waitForSelector(".basari", { timeout: 10000 });

await tahta.goto(`${T}${SINIF_ADRESI}`, { waitUntil: "networkidle" });
await tahta.getByRole("button", { name: /Bu cihazı kilitle/ }).click();
await tahta.waitForFunction(() => document.body.innerText.includes("Tahta kilitli"), null, { timeout: 10000 });
await tahta.getByRole("button", { name: /Sesi aç/ }).click();

await satir(telefon, "Elif").getByRole("button", { name: "Yıldız ver" }).click();
await tahta.waitForFunction(
  () => document.querySelector(".canli-bildirim")?.innerText.includes("yıldız"),
  null,
  { timeout: 8000 },
);
ok("Kilitli tahta yine de bildirim gosterdi", (await tahta.locator(".canli-bildirim").innerText()).includes("yıldız"));

// --- G. Sekme arka plandayken yoklama durur ---
console.log("\nG. Arka plan");
await tahta.waitForFunction(() => document.querySelector(".canli-bildirim") === null, null, { timeout: 5000 });
const gizlenmedenOnce = await yoklamaSayaci(tahta);
await tahta.evaluate(() => {
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
});
await tahta.waitForTimeout(3000);
const gizliyken = await yoklamaSayaci(tahta);
ok("Gizliyken yoklama durdu", gizliyken === gizlenmedenOnce, `${gizlenmedenOnce} -> ${gizliyken}`);

await tahta.evaluate(() => {
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
});
await tahta.waitForTimeout(3000);
ok("Tekrar gorununce yoklama devam etti", (await yoklamaSayaci(tahta)) > gizliyken);

// --- H. Yetki: oturumsuz ve baska ogretmen ---
console.log("\nH. Yetki");
const dersId = sql(`SELECT id FROM "Lesson" WHERE "endedAt" IS NULL LIMIT 1;`);
ok("Aktif ders bulundu", dersId.length > 0);

const oturumsuzBaglami = await tarayici.newContext();
const oturumsuz = await oturumsuzBaglami.newPage();
await oturumsuz.goto(`${T}/giris`, { waitUntil: "networkidle" });
const oturumsuzYanit = await oturumsuz.evaluate(
  async (id) => {
    const r = await fetch(`/api/ders/${id}/olaylar`);
    return { durum: r.status };
  },
  dersId,
);
ok("Oturumsuz istek 401 doner", oturumsuzYanit.durum === 401, JSON.stringify(oturumsuzYanit));
await oturumsuzBaglami.close();

const hash = bcrypt.hashSync("ikinci-parola-123", 12);
sql(`
INSERT INTO "Teacher" (id, email, name, "passwordHash", "createdAt")
VALUES ('t-ikinci-tahta', 'ikinci-tahta@ornek.com', 'İkinci Öğretmen', '${hash}', now());
`);
const ikinciBaglami = await tarayici.newContext();
const ikinci = await ikinciBaglami.newPage();
await ikinci.goto(`${T}/giris`, { waitUntil: "networkidle" });
await ikinci.getByLabel("E-posta").fill("ikinci-tahta@ornek.com");
await ikinci.getByLabel("Parola").fill("ikinci-parola-123");
await ikinci.getByRole("button", { name: "Giriş yap" }).click();
await ikinci.waitForURL(`${T}/`, { timeout: 20000 });

const ikinciYanit = await ikinci.evaluate(
  async (id) => {
    const r = await fetch(`/api/ders/${id}/olaylar`);
    return { durum: r.status, gövde: await r.json() };
  },
  dersId,
);
ok("Baska ogretmenin dersi bos doner (bulundugu sizdirilmaz)",
  ikinciYanit.durum === 200 && ikinciYanit.gövde.olaylar.length === 0,
  JSON.stringify(ikinciYanit));
await ikinciBaglami.close();

console.log(`\nSonuc: ${gecti} gecti, ${kaldi} kaldi\n`);
await tarayici.close();
process.exit(kaldi === 0 ? 0 : 1);
