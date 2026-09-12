// Sınıf hedefleri arayüz testi: modülün açılıp kapanması, hedef oluşturma,
// ilerlemenin BehaviorLog'dan (PLUS) türetilmesi, tamamlanma, kapatma ve
// geçmiş hedefler listesi.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. npm run build && npm start
//   3. npm install --no-save playwright
//   4. node scripts/class-goal-ui-test.mjs
import { chromium } from "playwright";
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
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
const sayfa = await tarayici.newPage();
await oturumHazirla(sayfa, TEMEL);

function satir(ad) { return sayfa.locator("li").filter({ hasText: ad }); }
async function bekle(metin) {
  await sayfa.waitForFunction((m) => document.body.innerText.includes(m), metin, { timeout: 10000 });
}
async function govde() { return sayfa.textContent("body"); }

async function artiVer(ad) {
  const oncekiSatir = await satir(ad).evaluate((el) => el.innerText);
  await satir(ad).getByRole("button", { name: "Artı ver" }).click();
  await sayfa.waitForFunction(
    ([isim, eski]) => {
      const li = [...document.querySelectorAll("li")].find((e) => e.innerText.includes(isim));
      return li && li.innerText !== eski;
    }, [ad, oncekiSatir], { timeout: 10000 });
  await sayfa.waitForTimeout(300);
}

// --- Kurulum: sınıf + öğrenci ---
console.log("\nKurulum");
await sayfa.goto(TEMEL, { waitUntil: "networkidle" });
await sayfa.getByLabel("Sınıf adı").fill("Hedef-Sinif");
await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
await bekle("Hedef-Sinif");
await sayfa.getByRole("link", { name: /Hedef-Sinif/ }).click();
await sayfa.getByRole("heading", { name: "Hedef-Sinif" }).waitFor();
const SINIF_URL = sayfa.url();
await ogrenciFormunuAc(sayfa);
await sayfa.getByLabel("Ad", { exact: true }).fill("Ece");
await sayfa.getByLabel("Soyad").fill("Su");
await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
await bekle("Ece");

// --- A. Modül kapalıyken hiç görünmez ---
console.log("\nA. Modul kapaliyken gorunmez");
ok("Sinif hedefi bolumu YOK", !(await govde()).includes("Sınıf hedefi"));
await sayfa.goto(`${TEMEL}/ayarlar`, { waitUntil: "networkidle" });
ok("Ayarlarda kapali basliyor",
  !(await sayfa.locator("form").filter({ hasText: "Sınıf hedeflerini kullan" }).getByRole("checkbox").isChecked()));

// --- B. Modülü aç ---
console.log("\nB. Modulu ac");
function gamificationFormu() {
  return sayfa.locator("form").filter({ hasText: "Sınıf hedeflerini kullan" });
}
await gamificationFormu().getByRole("checkbox").check();
await gamificationFormu().getByRole("button", { name: "Kaydet" }).click();
await bekle("Ayar kaydedildi.");
await sayfa.goto(SINIF_URL, { waitUntil: "networkidle" });
ok("Sinif hedefi bolumu goruluyor", (await govde()).includes("Sınıf hedefi"));
ok("Acik hedef yokken form katlanir icinde",
  (await sayfa.locator("details.katlanir summary", { hasText: "Sınıf hedefi" }).count()) === 1);

// --- C. Hedef oluşturma ---
console.log("\nC. Hedef olusturma");
await sayfa.locator("summary", { hasText: "Sınıf hedefi" }).click();
await sayfa.getByLabel(/Hedef \(/).fill("3");
await sayfa.getByLabel("Ödül").fill("Film günü");
await sayfa.getByRole("button", { name: "Hedef belirle" }).click();
await bekle("Film günü");
ok("Acik hedef karti dogrudan (katlanmadan) gorunuyor",
  (await sayfa.locator("section.kart", { hasText: "Film günü" }).count()) === 1);
ok("Ilerleme 0/3 ile basliyor", (await govde()).includes("0/3"));

// --- D. İlerleme: PLUS kayıtlarından türetiliyor ---
console.log("\nD. Ilerleme");
await dersBaslat(sayfa, ". ders");
await artiVer("Ece");
ok("1/3 sonra bir arti", (await govde()).includes("1/3"));
await artiVer("Ece");
await artiVer("Ece");
ok("3/3'e ulasti", (await govde()).includes("3/3"));
ok("Tamamlandi mesaji goruluyor", (await govde()).includes("Hedefe ulaşıldı"));
ok("Dugme metni odul verildi diyor",
  (await sayfa.getByRole("button", { name: /Ödülü verdim/ }).count()) === 1);

// --- E. Hedefi kapatma ve geçmişe düşmesi ---
console.log("\nE. Hedefi kapatma");
await sayfa.getByRole("button", { name: /Ödülü verdim/ }).click();
await bekle("Sınıf hedefi");
ok("Acik hedef karti kalkti", (await sayfa.locator("section.kart", { hasText: "Film günü" }).count()) === 0);
ok("Olusturma formu geri geldi", (await sayfa.locator("details.katlanir summary", { hasText: "Sınıf hedefi" }).count()) === 1);
await sayfa.locator("summary", { hasText: "Sınıf hedefi" }).click();
await sayfa.locator("summary", { hasText: "Geçmiş hedefler" }).click();
ok("Gecmiste tamamlandi olarak goruluyor", (await govde()).includes("3/3 · tamamlandı"));

// --- F. Yeni hedef, erken kapatma (hedefe ulaşılmadan) ---
console.log("\nF. Erken kapatma");
await sayfa.getByLabel(/Hedef \(/).fill("5");
await sayfa.getByLabel("Ödül").fill("Sticker");
await sayfa.getByRole("button", { name: "Hedef belirle" }).click();
await bekle("Sticker");
await artiVer("Ece");
await artiVer("Ece");
ok("2/5 gorunuyor", (await govde()).includes("2/5"));
ok("Tamamlandi mesaji YOK", !(await govde()).includes("Hedefe ulaşıldı"));
await sayfa.getByRole("button", { name: "Hedefi kapat" }).click();
await bekle("Sınıf hedefi");
await sayfa.locator("summary", { hasText: "Sınıf hedefi" }).click();
await sayfa.locator("summary", { hasText: "Geçmiş hedefler" }).click();
ok("Erken kapatilan 'kapatildi' olarak goruluyor", (await govde()).includes("2/5 · kapatıldı"));
ok("Iki gecmis hedef de listede", (await govde()).includes("Film günü") && (await govde()).includes("Sticker"));

// --- G. Modülü kapatınca tekrar gizleniyor ---
console.log("\nG. Modulu kapat");
await sayfa.goto(`${TEMEL}/ayarlar`, { waitUntil: "networkidle" });
await gamificationFormu().getByRole("checkbox").uncheck();
await gamificationFormu().getByRole("button", { name: "Kaydet" }).click();
await bekle("Ayar kaydedildi.");
await sayfa.goto(SINIF_URL, { waitUntil: "networkidle" });
ok("Kapatinca sinif hedefi bolumu yine yok", !(await govde()).includes("Sınıf hedefi"));

console.log(`\n${gecti} gecti, ${kaldi} kaldi`);
await tarayici.close();
process.exit(kaldi === 0 ? 0 : 1);
