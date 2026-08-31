// Akıllı tahta kilidi: PIN kurulumu, cihaz kilidi, kilitli cihazın tek sayfaya
// hapsedilmesi, kayıtların sunucuda reddedilmesi ve telefonun etkilenmemesi.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. SESSION_SECRET tanımlı olacak şekilde: npm run build && npm start
//   3. npm install --no-save playwright
//   4. node scripts/lock-ui-test.mjs
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import { oturumHazirla } from "./test-oturum.mjs";
import { dersBaslat } from "./test-ders.mjs";
import { ogrenciFormunuAc } from "./test-form.mjs";

const T = process.env.TEMEL_ADRES ?? "http://127.0.0.1:3000";
const PIN = "2468";
let gecti = 0, kaldi = 0;
function ok(ad, kosul, ayrinti = "") {
  if (kosul) { gecti++; console.log(`  GECTI  ${ad}`); }
  else { kaldi++; console.log(`  KALDI  ${ad}${ayrinti ? "  -> " + ayrinti : ""}`); }
}

const SQL_KOMUTU = process.env.SQL_KOMUTU ?? 'psql "$DATABASE_URL" -q -tA';
const sql = (m) => execSync(SQL_KOMUTU, { input: m, shell: "/bin/bash" }).toString().trim();
const kayitSayisi = () => Number(sql('SELECT count(*) FROM "BehaviorLog";'));

const tarayici = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
// Tahta ve telefon AYRI tarayıcı bağlamları: kilit çerezde durduğu için
// birbirlerinden habersiz olmaları gerekir. Testin can alıcı noktası bu.
const tahtaBaglami = await tarayici.newContext();
const sayfa = await tahtaBaglami.newPage();
await oturumHazirla(sayfa, T);

const satir = (ad) => sayfa.locator("li").filter({ hasText: ad });
const govde = () => sayfa.innerText("body");
async function padeYaz(hedef, pin) {
  const pad = hedef.locator(".kilit-pad");
  for (const rakam of pin) {
    await pad.getByRole("button", { name: rakam, exact: true }).click();
  }
  await pad.getByRole("button", { name: "Kilidi aç" }).click();
}

// --- A. Hazirlik ---
console.log("\nA. Hazirlik");
await sayfa.goto(T, { waitUntil: "networkidle" });
await sayfa.getByLabel("Sınıf adı").fill("Kilit-Test");
await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Kilit-Test"), null, { timeout: 10000 });
await sayfa.getByRole("link", { name: /Kilit-Test/ }).click();
await sayfa.waitForURL(/\/sinif\//, { timeout: 10000 });
const SINIF_ADRESI = new URL(sayfa.url()).pathname;
ok("Sinif sayfasi acildi", /^\/sinif\/[^/]+$/.test(SINIF_ADRESI), SINIF_ADRESI);

await ogrenciFormunuAc(sayfa);
await sayfa.getByLabel("Ad", { exact: true }).fill("Deniz");
await sayfa.getByLabel("Soyad").fill("Kaya");
await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Deniz"), null, { timeout: 10000 });
await dersBaslat(sayfa);
ok("Ders basladi", (await govde()).includes(". ders"));

// --- B. PIN kurulmadan kilit yok ---
console.log("\nB. PIN kurulmadan kilitlenemez");
const kilitleDugmesi = sayfa.getByRole("button", { name: /Bu cihazı kilitle/ });
ok("Kilitle dugmesi var", (await kilitleDugmesi.count()) === 1);
ok("PIN yokken pasif", await kilitleDugmesi.isDisabled());
ok("Ayarlara yonlendiriyor", (await govde()).includes("Önce Ayarlar'dan bir tahta PIN'i belirleyin."));
ok("Veritabaninda PIN yok", sql('SELECT ("boardPin" IS NULL) FROM "Teacher" LIMIT 1;') === "t");

// --- C. Ayarlardan PIN belirleme ---
console.log("\nC. PIN belirleme");
await sayfa.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
const pinFormu = sayfa.locator("form").filter({ has: sayfa.getByLabel("Hesap parolanız") });

async function pinDene(parola, pin, tekrar) {
  await pinFormu.getByLabel("Hesap parolanız").fill(parola);
  await pinFormu.getByLabel(/tahta PIN'i|Tahta PIN'i/).first().fill(pin);
  await pinFormu.getByLabel("PIN tekrar").fill(tekrar);
  await pinFormu.getByRole("button", { name: /PIN'i (belirle|değiştir)/ }).click();
  await sayfa.waitForTimeout(1200);
  return (await pinFormu.innerText()).trim();
}

// Tarayıcı kısa PIN'i minLength ile zaten göndermiyor; asıl soru sunucunun
// ne yaptığı. Kısıt kaldırılıp gönderilir: kural formda değil, action'da.
await pinFormu.evaluate((form) => {
  for (const alan of form.querySelectorAll("input[minlength]")) alan.removeAttribute("minlength");
});
ok("Kisa PIN sunucuda reddedilir", (await pinDene("uzunparola1", "12", "12")).includes("haneli olmalı"));
ok("Eslesmeyen PIN reddedilir", (await pinDene("uzunparola1", PIN, "1357")).includes("İki PIN aynı değil"));
ok("Yanlis hesap parolasi reddedilir", (await pinDene("yanlisparola", PIN, PIN)).includes("Hesap parolası yanlış"));
ok("PIN hala kurulmadi", sql('SELECT ("boardPin" IS NULL) FROM "Teacher" LIMIT 1;') === "t");
ok("Dogru bilgiyle PIN kaydedilir", (await pinDene("uzunparola1", PIN, PIN)).includes("PIN kaydedildi"));
ok("Veritabaninda PIN var", sql('SELECT ("boardPin" IS NOT NULL) FROM "Teacher" LIMIT 1;') === "t");
ok("PIN acik metin saklanmaz", sql(`SELECT count(*) FROM "Teacher" WHERE "boardPin" = '${PIN}';`) === "0");

await sayfa.reload({ waitUntil: "networkidle" });
ok("Form artik degistirme diyor", (await govde()).includes("PIN'i değiştir"));
ok("Varsayilan sure 10 dakika", sql('SELECT "boardUnlockMinutes" FROM "Teacher" LIMIT 1;') === "10");

// --- D. Cihazi kilitle ---
console.log("\nD. Cihaz kilitleniyor");
await sayfa.goto(`${T}${SINIF_ADRESI}`, { waitUntil: "networkidle" });
await sayfa.getByRole("button", { name: /Bu cihazı kilitle/ }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Tahta kilitli"), null, { timeout: 10000 });
const kilitliGovde = await govde();
ok("Kilit rozeti gorunuyor", kilitliGovde.includes("Tahta kilitli"));
ok("Sinifa donus baglantisi gizli", !kilitliGovde.includes("← Sınıflarım"));
ok("Odev/sinav baglantilari gizli", !kilitliGovde.includes("Ödevler →") && !kilitliGovde.includes("Sınavlar →"));
ok("Ders bitirme gizli", (await sayfa.getByRole("button", { name: "Dersi bitir" }).count()) === 0);
ok("Yeni ogrenci formu gizli", !kilitliGovde.includes("Yeni öğrenci"));
ok("Ogrenci listesi duruyor", kilitliGovde.includes("Deniz"));

// --- E. Kilitli cihaz baska sayfaya gidemez ---
console.log("\nE. Diger sayfalar kapali");
for (const [ad, yol] of [["Ayarlar", "/ayarlar"], ["Odevler", "/odevler"], ["Ana sayfa", "/"]]) {
  await sayfa.goto(`${T}${yol}`, { waitUntil: "networkidle" });
  ok(`${ad} sinif ekranina yonlendi`, new URL(sayfa.url()).pathname === SINIF_ADRESI, sayfa.url());
}

// --- F. Kilitliyken kayit yazilmaz ---
console.log("\nF. Kilitliyken kayit yok");
const oncekiSayi = kayitSayisi();
await satir("Deniz").getByRole("button", { name: /Artı ver|Yıldız ver/ }).click();
await sayfa.waitForSelector(".kilit-pad", { timeout: 10000 });
ok("Dugmeye basinca PIN sorulur", (await sayfa.locator(".kilit-pad").count()) === 1);
await sayfa.waitForTimeout(800);
ok("Kayit yazilmadi", kayitSayisi() === oncekiSayi, `${oncekiSayi} -> ${kayitSayisi()}`);

// --- G. Yanlis PIN ---
console.log("\nG. Yanlis PIN");
await padeYaz(sayfa, "1111");
await sayfa.waitForFunction(
  () => document.querySelector(".kilit-pad")?.innerText.includes("PIN yanlış"),
  null,
  { timeout: 10000 },
);
ok("Yanlis PIN reddedildi", (await sayfa.locator(".kilit-pad").innerText()).includes("PIN yanlış"));
ok("Hala kilitli", (await govde()).includes("Tahta kilitli"));
ok("Yanlis PIN kayit yazmadi", kayitSayisi() === oncekiSayi);

// --- H. Dogru PIN ---
console.log("\nH. Dogru PIN acar");
await sayfa.locator(".kilit-pad").getByRole("button", { name: "Son haneyi sil" }).click({ clickCount: 4 });
await padeYaz(sayfa, PIN);
await sayfa.waitForFunction(() => document.body.innerText.includes("Kilit açık"), null, { timeout: 15000 });
const acikGovde = await govde();
ok("Kilit acildi", acikGovde.includes("Kilit açık"));
ok("Geri sayim gorunuyor", /Kilit açık · \d+:\d\d/.test(acikGovde));
ok("Tus takimi kapandi", (await sayfa.locator(".kilit-pad").count()) === 0);
ok("Baglantilar geri geldi", acikGovde.includes("Ödevler →"));

await satir("Deniz").getByRole("button", { name: /Artı ver|Yıldız ver/ }).click();
await sayfa.waitForTimeout(1500);
ok("Acikken kayit yazilir", kayitSayisi() === oncekiSayi + 1, `${oncekiSayi} -> ${kayitSayisi()}`);

// --- I. Acik kalmis sekme kilidi delemez ---
console.log("\nI. Acik kalmis sekme");
const eskiSekme = await tahtaBaglami.newPage();
await eskiSekme.goto(`${T}${SINIF_ADRESI}`, { waitUntil: "networkidle" });
ok("Ikinci sekme kilitsiz acildi", (await eskiSekme.innerText("body")).includes("Kilit açık"));

await sayfa.getByRole("button", { name: "Şimdi kilitle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Tahta kilitli"), null, { timeout: 10000 });
ok("Sure dolmadan kilitlenebilir", (await govde()).includes("Tahta kilitli"));

// Eski sekme hala kilitsiz cizilmis durumda: dugmesi gercek bir gonderim yapar.
const kilitOncesi = kayitSayisi();
await eskiSekme.locator("li").filter({ hasText: "Deniz" })
  .getByRole("button", { name: /Artı ver|Yıldız ver/ }).click();
await eskiSekme.waitForFunction(
  () => document.body.innerText.includes("Tahta kilitli. Önce PIN ile açın."),
  null,
  { timeout: 10000 },
);
ok("Sunucu eski sekmeyi reddetti", (await eskiSekme.innerText("body")).includes("Tahta kilitli. Önce PIN ile açın."));
ok("Eski sekmeden kayit yazilmadi", kayitSayisi() === kilitOncesi, `${kilitOncesi} -> ${kayitSayisi()}`);
await eskiSekme.close();

// --- J. Telefon etkilenmez ---
console.log("\nJ. Telefon etkilenmez");
const telefonBaglami = await tarayici.newContext();
const telefon = await telefonBaglami.newPage();
await oturumHazirla(telefon, T);
await telefon.goto(`${T}${SINIF_ADRESI}`, { waitUntil: "networkidle" });
const telefonGovde = await telefon.innerText("body");
ok("Telefon kilitli degil", !telefonGovde.includes("Tahta kilitli"));
ok("Telefonda baglantilar duruyor", telefonGovde.includes("Ödevler →"));

const telefonOncesi = kayitSayisi();
await telefon.locator("li").filter({ hasText: "Deniz" })
  .getByRole("button", { name: /Artı ver|Yıldız ver/ }).click();
await telefon.waitForTimeout(1500);
ok("Telefondan kayit yazilir", kayitSayisi() === telefonOncesi + 1, `${telefonOncesi} -> ${kayitSayisi()}`);

await telefon.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
ok("Telefon ayarlara girebilir", new URL(telefon.url()).pathname === "/ayarlar");
await telefonBaglami.close();

// --- K. Kilidi tamamen kaldirma ---
console.log("\nK. Kilidi kaldirma");
await sayfa.goto(`${T}${SINIF_ADRESI}`, { waitUntil: "networkidle" });
await sayfa.getByRole("button", { name: "Kilidi aç" }).click();
await sayfa.waitForSelector(".kilit-pad", { timeout: 10000 });
await padeYaz(sayfa, PIN);
await sayfa.waitForFunction(() => document.body.innerText.includes("Kilit açık"), null, { timeout: 15000 });
await sayfa.getByRole("button", { name: "Kilidi kaldır" }).click();
await sayfa.waitForFunction(
  () => document.body.innerText.includes("Bu cihazı kilitle"),
  null,
  { timeout: 10000 },
);
const sonGovde = await govde();
ok("Kilit kalkti", sonGovde.includes("Bu cihazı kilitle") && !sonGovde.includes("Tahta kilitli"));
await sayfa.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
ok("Ayarlar tekrar acilir", new URL(sayfa.url()).pathname === "/ayarlar");

console.log(`\nSonuc: ${gecti} gecti, ${kaldi} kaldi\n`);
await tarayici.close();
process.exit(kaldi === 0 ? 0 : 1);
