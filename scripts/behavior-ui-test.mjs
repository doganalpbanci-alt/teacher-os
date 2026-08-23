// Kart ve puan kurallarının arayüz testi: gerçek tarayıcıyla ders başlatır,
// +/- basar ve kuralların uygulandığını doğrular.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. npm run build && npm start
//   3. npm install --no-save playwright
//   4. node scripts/behavior-ui-test.mjs
import { chromium } from "playwright";
import { oturumHazirla } from "./test-oturum.mjs";
import { dersBaslat } from "./test-ders.mjs";

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

// Bir ogrencinin satirini bulur.
function satir(ad) {
  return sayfa.locator("li").filter({ hasText: ad });
}
async function puan(ad) {
  const m = (await satir(ad).textContent()).match(/(-?\d+) puan/);
  return m ? Number(m[1]) : null;
}
async function kart(ad) {
  const t = await satir(ad).textContent();
  if (t.includes("Kırmızı kart")) return "KIRMIZI";
  if (t.includes("Sarı kart")) return "SARI";
  return "YOK";
}
async function bas(ad, tur) {
  // Onceki degeri de innerText ile alinir; textContent ile karsilastirilirsa
  // ikisi bastan farkli oldugu icin bekleme aninda gecer.
  const oncekiMetin = await satir(ad).evaluate((el) => el.innerText);
  await satir(ad).getByRole("button", { name: tur === "PLUS" ? "Yıldız ver" : "Sarı kart ver" }).click();
  await sayfa.waitForFunction(
    ([isim, eski]) => {
      const li = [...document.querySelectorAll("li")].find((e) => e.innerText.includes(isim));
      return li && li.innerText !== eski;
    },
    [ad, oncekiMetin],
    { timeout: 10000 },
  );
  // Ikinci bir render daha gelebilir (sunucu agaci); durulmasi beklenir.
  await sayfa.waitForTimeout(400);
}

// --- Hazirlik ---
console.log("\nA. Hazirlik");
// Kart sistemi varsayilan degil; once ayarlardan secilir.
await sayfa.goto(`${TEMEL}/ayarlar`, { waitUntil: "networkidle" });
await sayfa.getByRole("radio", { name: /Kart sistemi/ }).check();
await sayfa.getByRole("button", { name: "Kaydet" }).click();
await sayfa.waitForSelector(".basari", { timeout: 10000 });
ok("Kart sistemi secildi", true);

await sayfa.goto(TEMEL, { waitUntil: "networkidle" });
await sayfa.getByLabel("Sınıf adı").fill("7-C");
await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("7-C"), null, { timeout: 10000 });
await sayfa.getByRole("link", { name: /7-C/ }).click();
await sayfa.getByRole("heading", { name: "7-C" }).waitFor();
for (const [ad, soyad] of [["Ela", "Kaya"], ["Bora", "Sen"]]) {
  await sayfa.getByLabel("Ad", { exact: true }).fill(ad);
  await sayfa.getByLabel("Soyad").fill(soyad);
  await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
  await sayfa.waitForFunction((a) => document.body.innerText.includes(a), ad, { timeout: 10000 });
}
ok("Iki ogrenci eklendi", (await sayfa.textContent("body")).includes("2 öğrenci"));
ok("Baslangic puani 90", (await puan("Ela")) === 90);

// --- B: Ders yokken ---
console.log("\nB. Ders baslatilmadan");
ok("Aktif ders yok uyarisi", (await sayfa.textContent("body")).includes("Aktif ders yok"));
ok("Arti dugmesi pasif", await satir("Ela").getByRole("button", { name: "Yıldız ver" }).isDisabled());
ok("Eksi dugmesi pasif", await satir("Ela").getByRole("button", { name: "Sarı kart ver" }).isDisabled());

// --- C: 1. ders ---
console.log("\nC. Birinci ders");
await dersBaslat(sayfa, "Aktif ders:");
ok("Ders basladi", (await sayfa.textContent("body")).includes("1. ders"));
ok("Arti dugmesi aktif", !(await satir("Ela").getByRole("button", { name: "Yıldız ver" }).isDisabled()));

await bas("Ela", "PLUS");
ok("PLUS puani 1 artirdi", (await puan("Ela")) === 91, `puan=${await puan("Ela")}`);
ok("PLUS kart vermedi", (await kart("Ela")) === "YOK");

await bas("Ela", "IHLAL");
ok("Ilk ihlal sari kart verdi", (await kart("Ela")) === "SARI", await kart("Ela"));
ok("Ilk ihlal puani DUSURMEDI", (await puan("Ela")) === 91, `puan=${await puan("Ela")}`);

await bas("Ela", "IHLAL");
ok("Ikinci ihlal kirmizi kart verdi", (await kart("Ela")) === "KIRMIZI", await kart("Ela"));
ok("Ikinci ihlal -5 puan", (await puan("Ela")) === 86, `puan=${await puan("Ela")}`);

await bas("Ela", "IHLAL");
ok("Ucuncu ihlal yine -5", (await puan("Ela")) === 81, `puan=${await puan("Ela")}`);
ok("Kart kirmizi kaldi", (await kart("Ela")) === "KIRMIZI");

ok("Diger ogrenci etkilenmedi", (await puan("Bora")) === 90 && (await kart("Bora")) === "YOK");

// --- D: 2. ders (ayni gun) ---
console.log("\nD. Ayni gun ikinci ders");
await dersBaslat(sayfa, "2. ders");
ok("Ayni gun ikinci ders acildi", (await sayfa.textContent("body")).includes("2. ders"));
ok("Sari/kirmizi kart sifirlandi", (await kart("Ela")) === "YOK", await kart("Ela"));
ok("Puan korundu (gecmis silinmedi)", (await puan("Ela")) === 81, `puan=${await puan("Ela")}`);

await bas("Ela", "IHLAL");
ok("Yeni derste ilk ihlal yine SARI", (await kart("Ela")) === "SARI", await kart("Ela"));
ok("Yeni derste ilk ihlal puan dusurmedi", (await puan("Ela")) === 81, `puan=${await puan("Ela")}`);

// --- E: Kalicilik ---
console.log("\nE. Kalicilik");
await sayfa.reload({ waitUntil: "networkidle" });
ok("Yenilemeden sonra kart duruyor", (await kart("Ela")) === "SARI");
ok("Yenilemeden sonra puan duruyor", (await puan("Ela")) === 81);

await tarayici.close();
console.log(`\n=== SONUC: ${gecti} gecti, ${kaldi} kaldi ===`);
process.exit(kaldi === 0 ? 0 : 1);
