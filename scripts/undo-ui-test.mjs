// Son kaydı geri alma testi: yanlış basılan tuşun düzeltilmesi.
//
// Sınanan kural (`sonKaydiGeriAl`): yalnızca EN SON kayıt, yalnızca SÜREN
// derste. Kırmızı kart tek satır değildir — yanındaki MINUS ve teneffüs
// cezası da onunla birlikte geri alınır.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. SESSION_SECRET tanımlı olacak şekilde: npm run build && npm start
//   3. npm install --no-save playwright
//   4. SQL_KOMUTU='psql "$DATABASE_URL" -q -tA' node scripts/undo-ui-test.mjs
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import { oturumHazirla } from "./test-oturum.mjs";
import { dersBaslat } from "./test-ders.mjs";
import { ogrenciFormunuAc } from "./test-form.mjs";

const T = process.env.TEMEL_ADRES ?? "http://127.0.0.1:3000";
const PIN = "3690";
const SQL_KOMUTU = process.env.SQL_KOMUTU ?? 'psql "$DATABASE_URL" -q -tA';
const sql = (m) => execSync(SQL_KOMUTU, { input: m, shell: "/bin/bash" }).toString().trim();

let gecti = 0, kaldi = 0;
function ok(ad, kosul, ayrinti = "") {
  if (kosul) { gecti++; console.log(`  GECTI  ${ad}`); }
  else { kaldi++; console.log(`  KALDI  ${ad}${ayrinti ? "  -> " + ayrinti : ""}`); }
}

const kayitSayisi = (ad) =>
  Number(sql(`SELECT count(*) FROM "BehaviorLog" b JOIN "Student" s ON s.id=b."studentId"
              WHERE s."firstName"='${ad}';`));
const turSayisi = (ad, tur) =>
  Number(sql(`SELECT count(*) FROM "BehaviorLog" b JOIN "Student" s ON s.id=b."studentId"
              WHERE s."firstName"='${ad}' AND b.type='${tur}';`));
const puan = (ad) => sql(`SELECT "performanceScore" FROM "Student" WHERE "firstName"='${ad}';`);
const cezaSaniye = (ad) =>
  sql(`SELECT COALESCE((SELECT p.seconds FROM "BreakPenalty" p
       JOIN "Student" s ON s.id=p."studentId"
       WHERE s."firstName"='${ad}' AND p."completedAt" IS NULL), -1);`);

const tarayici = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
const baglam = await tarayici.newContext();
const sayfa = await baglam.newPage();
await oturumHazirla(sayfa, T);

const satir = (ad) => sayfa.locator("li").filter({ hasText: ad });
// Erisilebilirlik etiketi tam adi tasir ("Umut Bir: ..."); test yalnizca
// adiyla arar.
const geriAl = (ad) => satir(ad).getByRole("button", { name: new RegExp(`^${ad}\\b.*son kaydı geri al$`) });

// Kayıt sayısı DEĞİŞENE kadar bekler: geri alma silme yönünde çalıştığı için
// "arttı mı" beklemek yetmez, iki yöne de bakılır.
async function degisimiBekle(ad, tiklama) {
  const once = kayitSayisi(ad);
  await tiklama();
  for (let i = 0; i < 60; i++) {
    if (kayitSayisi(ad) !== once) break;
    await sayfa.waitForTimeout(200);
  }
  await sayfa.waitForTimeout(600); // sayfanın tazelenmesi için pay
}
const bas = (ad, etiket) =>
  degisimiBekle(ad, () => satir(ad).getByRole("button", { name: etiket }).click());
const alGeri = (ad) => degisimiBekle(ad, () => geriAl(ad).click());

// --- A. Hazirlik ---
console.log("\nA. Hazirlik");
await sayfa.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
await sayfa.getByRole("radio", { name: /Kart sistemi/ }).check();
await sayfa.getByRole("button", { name: "Kaydet" }).click();
await sayfa.waitForSelector(".basari", { timeout: 10000 });

await sayfa.goto(T, { waitUntil: "networkidle" });
await sayfa.getByLabel("Sınıf adı").fill("GeriAl-Test");
await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("GeriAl-Test"), null, { timeout: 10000 });
await sayfa.getByRole("link", { name: /GeriAl-Test/ }).click();
await sayfa.waitForURL(/\/sinif\//, { timeout: 10000 });
const SINIF_ADRESI = new URL(sayfa.url()).pathname;
for (const [a, b] of [["Umut", "Bir"], ["Zehra", "Iki"]]) {
  await ogrenciFormunuAc(sayfa);
  await sayfa.getByLabel("Ad", { exact: true }).fill(a);
  await sayfa.getByLabel("Soyad").fill(b);
  await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
  await sayfa.waitForFunction((x) => document.body.innerText.includes(x), a, { timeout: 10000 });
}
await dersBaslat(sayfa);
ok("Kaydi olmayan ogrencide geri alma dugmesi YOK", (await geriAl("Umut").count()) === 0);

// --- B. Yildiz geri alma ---
console.log("\nB. Yildiz geri alma");
await bas("Umut", /Yıldız ver|Artı ver/);
ok("Yildiz yazildi", kayitSayisi("Umut") === 1, `kayit=${kayitSayisi("Umut")}`);
ok("Puan 91 oldu", puan("Umut") === "91", `puan=${puan("Umut")}`);
ok("Geri alma dugmesi belirdi", (await geriAl("Umut").count()) === 1);
ok("Kaydi olmayan digeri hala dugmesiz", (await geriAl("Zehra").count()) === 0);

await alGeri("Umut");
ok("Yildiz silindi", kayitSayisi("Umut") === 0, `kayit=${kayitSayisi("Umut")}`);
ok("Puan 90'a dondu", puan("Umut") === "90", `puan=${puan("Umut")}`);
ok("Dugme yeniden kayboldu", (await geriAl("Umut").count()) === 0);

// --- C. Sari kart geri alma ---
console.log("\nC. Sari kart geri alma");
await bas("Umut", "Sarı kart ver");
ok("Sari kart yazildi", turSayisi("Umut", "YELLOW_CARD") === 1);
ok("Satirda sari serit var", (await satir("Umut").innerText()).includes("Sarı kart"));
await alGeri("Umut");
ok("Sari kart silindi", turSayisi("Umut", "YELLOW_CARD") === 0);
ok("Serit kalkti", !(await satir("Umut").innerText()).includes("Sarı kart"));

// --- D. Kirmizi kart: kart + MINUS + ceza birlikte geri alinir ---
console.log("\nD. Kirmizi kart geri alma");
await bas("Umut", "Kırmızı kart ver");
ok("Kirmizi kart yazildi", turSayisi("Umut", "RED_CARD") === 1);
ok("Eslik eden MINUS yazildi", turSayisi("Umut", "MINUS") === 1);
ok("Ceza acildi (2 dk)", cezaSaniye("Umut") === "120", `saniye=${cezaSaniye("Umut")}`);
ok("Puan 85 oldu", puan("Umut") === "85", `puan=${puan("Umut")}`);

await alGeri("Umut");
ok("Kirmizi kart silindi", turSayisi("Umut", "RED_CARD") === 0);
ok("MINUS de silindi", turSayisi("Umut", "MINUS") === 0, `minus=${turSayisi("Umut", "MINUS")}`);
ok("Ceza da kalkti", cezaSaniye("Umut") === "-1", `saniye=${cezaSaniye("Umut")}`);
ok("Puan 90'a dondu", puan("Umut") === "90", `puan=${puan("Umut")}`);

// --- E. Ust uste kirmizilarda yalnizca sonuncusu geri alinir ---
console.log("\nE. Ikinci kirmizi geri alinir, ilki durur");
await bas("Umut", "Kırmızı kart ver");
await bas("Umut", "Kırmızı kart ver");
ok("Iki kirmizi var", turSayisi("Umut", "RED_CARD") === 2);
ok("Ceza 2+3=5 dk", cezaSaniye("Umut") === "300", `saniye=${cezaSaniye("Umut")}`);
await alGeri("Umut");
ok("Bir kirmizi kaldi", turSayisi("Umut", "RED_CARD") === 1, `kirmizi=${turSayisi("Umut", "RED_CARD")}`);
ok("Ceza ilk karta ait 2 dk'ya dondu", cezaSaniye("Umut") === "120", `saniye=${cezaSaniye("Umut")}`);
ok("Puan tek kirmiziya gore 85", puan("Umut") === "85", `puan=${puan("Umut")}`);
ok("Satir hala kirmizi", (await satir("Umut").innerText()).includes("Kırmızı kart"));

// --- F. Sirali kayitlarda en son olan gider ---
console.log("\nF. En son kayit gider");
await bas("Umut", /Yıldız ver|Artı ver/);
ok("Yildiz eklendi", turSayisi("Umut", "PLUS") === 1);
await alGeri("Umut");
ok("Yildiz gitti, kirmizi durdu", turSayisi("Umut", "PLUS") === 0 && turSayisi("Umut", "RED_CARD") === 1,
   `plus=${turSayisi("Umut", "PLUS")} kirmizi=${turSayisi("Umut", "RED_CARD")}`);

// --- G. Bitmis dersin kaydi geri alinamaz ---
console.log("\nG. Bitmis ders");
const eskiSekme = await baglam.newPage();
await eskiSekme.goto(`${T}${SINIF_ADRESI}`, { waitUntil: "networkidle" });
const eskiDugme = eskiSekme.locator("li").filter({ hasText: "Umut" })
  .getByRole("button", { name: /^Umut\b.*son kaydı geri al$/ });
ok("Eski sekmede dugme cizilmis", (await eskiDugme.count()) === 1);

await sayfa.getByRole("button", { name: "Dersi bitir" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Aktif ders yok"), null, { timeout: 10000 });
ok("Ders bitince dugme kayboldu", (await geriAl("Umut").count()) === 0);

// Eski sekme dersin bittiginden habersiz: gercek bir gonderim yapar.
const bitmedenOnce = kayitSayisi("Umut");
await eskiDugme.click();
await eskiSekme.waitForFunction(
  () => document.body.innerText.includes("Bitmiş dersin kaydı geri alınamaz."),
  null,
  { timeout: 10000 },
);
ok("Sunucu bitmis dersi reddetti",
   (await eskiSekme.innerText("body")).includes("Bitmiş dersin kaydı geri alınamaz."));
ok("Gecmis kayit silinmedi", kayitSayisi("Umut") === bitmedenOnce,
   `${bitmedenOnce} -> ${kayitSayisi("Umut")}`);
await eskiSekme.close();

// --- H. Kilitli tahtada geri alma yok ---
console.log("\nH. Kilitli tahta");
await dersBaslat(sayfa);
await bas("Umut", /Yıldız ver|Artı ver/);
ok("Yeni derste dugme var", (await geriAl("Umut").count()) === 1);

await sayfa.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
const pinFormu = sayfa.locator("form").filter({ has: sayfa.getByLabel("Hesap parolanız") });
await pinFormu.getByLabel("Hesap parolanız").fill("uzunparola1");
await pinFormu.getByLabel(/tahta PIN'i|Tahta PIN'i/).first().fill(PIN);
await pinFormu.getByLabel("PIN tekrar").fill(PIN);
await pinFormu.getByRole("button", { name: /PIN'i (belirle|değiştir)/ }).click();
await sayfa.waitForTimeout(1500);

await sayfa.goto(`${T}${SINIF_ADRESI}`, { waitUntil: "networkidle" });
await sayfa.getByRole("button", { name: /Bu cihazı kilitle/ }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Tahta kilitli"), null, { timeout: 10000 });
ok("Kilitli tahtada geri alma dugmesi YOK", (await geriAl("Umut").count()) === 0);

// Telefon (ayri baglam) kilitten etkilenmez: duzeltme oradan yapilir.
const telefonBaglami = await tarayici.newContext();
const telefon = await telefonBaglami.newPage();
await oturumHazirla(telefon, T);
await telefon.goto(`${T}${SINIF_ADRESI}`, { waitUntil: "networkidle" });
const telefonDugme = telefon.locator("li").filter({ hasText: "Umut" })
  .getByRole("button", { name: /^Umut\b.*son kaydı geri al$/ });
ok("Telefonda dugme duruyor", (await telefonDugme.count()) === 1);
const telefonOncesi = kayitSayisi("Umut");
await telefonDugme.click();
for (let i = 0; i < 60; i++) {
  if (kayitSayisi("Umut") !== telefonOncesi) break;
  await telefon.waitForTimeout(200);
}
ok("Telefondan geri alinabildi", kayitSayisi("Umut") === telefonOncesi - 1,
   `${telefonOncesi} -> ${kayitSayisi("Umut")}`);
await telefonBaglami.close();

// --- I. Basit sablonda elle girilen not korunur ---
console.log("\nI. Basit sablon");
// Once kilidi ac: bundan sonraki adimlar tahtadan degil ogretmen cihazindan.
// Serit uzerindeki "Kilidi aç" padi acar; pad icinde ayni adli onay tusu
// oldugu icin tiklamalar .kilit-pad ile sinirlanir.
await sayfa.locator(".kilit-seridi").getByRole("button", { name: "Kilidi aç" }).click();
await sayfa.waitForSelector(".kilit-pad", { timeout: 10000 });
for (const rakam of PIN) {
  await sayfa.locator(".kilit-pad").getByRole("button", { name: rakam, exact: true }).click();
}
await sayfa.locator(".kilit-pad").getByRole("button", { name: "Kilidi aç" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Kilit açık"), null, { timeout: 15000 });

await sayfa.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
await sayfa.getByRole("radio", { name: /Basit/ }).check();
await sayfa.getByRole("button", { name: "Kaydet" }).click();
await sayfa.waitForSelector(".basari", { timeout: 10000 });

await sayfa.goto(`${T}${SINIF_ADRESI}`, { waitUntil: "networkidle" });
await bas("Zehra", "Artı ver");
ok("Basit sablonda kayit yazildi", kayitSayisi("Zehra") === 1);

// Not elle girilir; geri alma ona dokunmamali.
await sayfa.getByRole("link", { name: "Zehra Iki" }).click();
await sayfa.waitForURL(/\/ogrenci\//, { timeout: 10000 });
await sayfa.getByLabel("Performans notu").fill("73");
await sayfa.locator("form.not-formu").getByRole("button", { name: "Kaydet" }).click();
await sayfa.waitForTimeout(1500);
ok("Elle not kaydedildi", puan("Zehra") === "73", `puan=${puan("Zehra")}`);

await sayfa.goto(`${T}${SINIF_ADRESI}`, { waitUntil: "networkidle" });
await alGeri("Zehra");
ok("Basit sablonda kayit geri alindi", kayitSayisi("Zehra") === 0, `kayit=${kayitSayisi("Zehra")}`);
ok("Elle girilen not DEGISMEDI", puan("Zehra") === "73", `puan=${puan("Zehra")}`);

await tarayici.close();
console.log(`\n=== SONUC: ${gecti} gecti, ${kaldi} kaldi ===`);
process.exit(kaldi === 0 ? 0 : 1);
