// İyimser güncelleme testi: düğmeye basıldığı anda sonucun ekranda görünmesi.
//
// Sunucu yanıtı bilerek geciktirilir. Kayıt henüz veritabanına yazılmamışken
// ekranda sonucun görünmesi, güncellemenin gerçekten iyimser olduğunu
// kanıtlar; yanıt gelince değerin katlanmaması da doğru bağlandığını.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. SESSION_SECRET tanımlı olacak şekilde: npm run build && npm start
//   3. npm install --no-save playwright
//   4. SQL_KOMUTU='psql "$DATABASE_URL" -q -tA' node scripts/optimistic-ui-test.mjs
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import { oturumHazirla } from "./test-oturum.mjs";
import { dersBaslat } from "./test-ders.mjs";
import { ogrenciFormunuAc } from "./test-form.mjs";

const T = process.env.TEMEL_ADRES ?? "http://127.0.0.1:3000";
const SQL_KOMUTU = process.env.SQL_KOMUTU ?? 'psql "$DATABASE_URL" -q -tA';
const sql = (m) => execSync(SQL_KOMUTU, { input: m, shell: "/bin/bash" }).toString().trim();

// Sunucu yanıtı bu kadar geciktirilir; ekranın ondan önce tepki vermesi beklenir.
const GECIKME = 2500;
// Basıştan sonra ekrana bakılan an. Gecikmenin çok altında olmalı.
const ERKEN_BAKIS = 500;

let gecti = 0, kaldi = 0;
function ok(ad, kosul, ayrinti = "") {
  if (kosul) { gecti++; console.log(`  GECTI  ${ad}`); }
  else { kaldi++; console.log(`  KALDI  ${ad}${ayrinti ? "  -> " + ayrinti : ""}`); }
}

const tarayici = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
const sayfa = await tarayici.newPage();
await oturumHazirla(sayfa, T);

const satir = (ad) => sayfa.locator("li").filter({ hasText: ad });
const satirMetni = (ad) => satir(ad).evaluate((e) => e.innerText);
const kayitSayisi = () => sql(`SELECT count(*) FROM "BehaviorLog";`);

// Server action'lar sayfanın kendi adresine POST edilir; onları geciktirmek
// "sunucu yavaş" durumunu taklit eder. Yönlendirme bir kez kurulur ve bir
// bayrakla açılıp kapanır: kaldırılırsa bekleyen istekler yarıda kalır.
let gecikmeAcik = false;
await sayfa.route("**/*", async (yol) => {
  if (gecikmeAcik && yol.request().method() === "POST") {
    await new Promise((c) => setTimeout(c, GECIKME));
  }
  // Sayfa yenilenirken istek düşmüş olabilir; test onu hata saymaz.
  try {
    await yol.continue();
  } catch {}
});
const sunucuyuYavaslat = () => { gecikmeAcik = true; };
const sunucuyuDuzelt = () => { gecikmeAcik = false; };

// --- A: Hazirlik ---
console.log("\nA. Hazirlik");
await sayfa.goto(T, { waitUntil: "networkidle" });
await sayfa.getByLabel("Sınıf adı").fill("Iyimser-Test");
await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Iyimser-Test"), null, { timeout: 10000 });
await sayfa.getByRole("link", { name: /Iyimser-Test/ }).click();
await sayfa.getByRole("heading", { name: "Iyimser-Test" }).waitFor();
await ogrenciFormunuAc(sayfa);
await sayfa.getByLabel("Ad", { exact: true }).fill("Mert");
await sayfa.getByLabel("Soyad").fill("Bir");
await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Mert"), null, { timeout: 10000 });
await dersBaslat(sayfa);
ok("Baslangicta sayimlar sifir", (await satirMetni("Mert")).includes("0 artı · 0 eksi"));

// --- B: Basit sablonda anlik geri bildirim ---
console.log("\nB. Basit sablon");
sunucuyuYavaslat();
await satir("Mert").getByRole("button", { name: "Artı ver" }).click();
await sayfa.waitForTimeout(ERKEN_BAKIS);
const erken = await satirMetni("Mert");
ok("Arti ANINDA ekranda", erken.includes("1 artı"), erken.replace(/\s+/g, " "));
ok("Kayit henuz veritabaninda YOK (yani ekran once tepki verdi)",
   kayitSayisi() === "0", `kayit=${kayitSayisi()}`);

// --- C: Dugme kilitlenmiyor, basis kaybolmuyor ---
// Kayit surerken basilan ikinci dugme siraya girer: hemen ekrana yansimaz
// ama kaybolmaz. Sira bilerek korunur; kart yukselme kurali es zamanli
// kayitlarda yanlis sonuc verirdi.
console.log("\nC. Arka arkaya basma");
ok("Ikinci basis icin dugme hala aktif",
   !(await satir("Mert").getByRole("button", { name: "Artı ver" }).isDisabled()));
await satir("Mert").getByRole("button", { name: "Artı ver" }).click();

// --- D: Sunucu yanitindan sonra deger katlanmiyor ---
console.log("\nD. Sunucu yanitindan sonra");
sunucuyuDuzelt();
await sayfa.waitForFunction(
  () => document.body.innerText.includes("2 artı"),
  null,
  { timeout: 20000 },
);
await sayfa.waitForTimeout(1500);
const sonrasi = await satirMetni("Mert");
ok("Iki basis da islendi, katlanmadi", sonrasi.includes("2 artı"), sonrasi.replace(/\s+/g, " "));
ok("Ikinci basis kaybolmadi: veritabaninda 2 kayit", kayitSayisi() === "2", `kayit=${kayitSayisi()}`);

await sayfa.reload({ waitUntil: "networkidle" });
ok("Yenilemeden sonra da 2 arti", (await satirMetni("Mert")).includes("2 artı"),
   await satirMetni("Mert"));

// --- E: Kart sablonunda kart yukselmesi ---
console.log("\nE. Kart sablonu");
await sayfa.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
await sayfa.getByRole("radio", { name: /Kart sistemi/ }).check();
await sayfa.getByRole("button", { name: "Kaydet" }).click();
await sayfa.waitForSelector(".basari", { timeout: 10000 });
await sayfa.goto(T, { waitUntil: "networkidle" });
await sayfa.getByRole("link", { name: /Iyimser-Test/ }).click();
await sayfa.getByRole("heading", { name: "Iyimser-Test" }).waitFor();

sunucuyuYavaslat();
await satir("Mert").getByRole("button", { name: "Sarı kart ver" }).click();
await sayfa.waitForTimeout(ERKEN_BAKIS);
ok("Sari kart ANINDA gorundu",
   (await satir("Mert").locator(".kart-sari").count()) === 1);
ok("Puan ders ekraninda GOSTERILMIYOR", !(await satirMetni("Mert")).includes("puan"),
   await satirMetni("Mert"));

// Ikinci ihlale basmadan once ilk kaydin yaniti beklenir: basislar siraya
// girdigi icin, bekleyen bir kayit varken basilan dugme sirasini bekler.
sunucuyuDuzelt();
await sayfa.waitForFunction(
  () => document.querySelector(".kart-sari") !== null,
  null,
  { timeout: 20000 },
);
await sayfa.waitForTimeout(1500);

// Sari ustune sari kirmizi demektir; ekran da ayni kurali uygular.
sunucuyuYavaslat();
await satir("Mert").getByRole("button", { name: "Sarı kart ver" }).click();
await sayfa.waitForTimeout(ERKEN_BAKIS);
ok("Ikinci ihlal ANINDA kirmiziya yukseldi",
   (await satir("Mert").locator(".kart-kirmizi").count()) === 1,
   await satirMetni("Mert"));

// --- F: Sunucu ayni sonuca variyor ---
console.log("\nF. Sunucu ayni sonuca variyor");
sunucuyuDuzelt();
await sayfa.waitForTimeout(GECIKME + 2500);
await sayfa.reload({ waitUntil: "networkidle" });
const son = await satirMetni("Mert");
ok("Yenilemeden sonra kirmizi kart duruyor",
   (await satir("Mert").locator(".kart-kirmizi").count()) === 1, son.replace(/\s+/g, " "));
const puan = sql(`SELECT "performanceScore" FROM "Student" WHERE "firstName"='Mert';`);
ok("Kirmizi kart -5 puan yazdi", puan === "85", `puan=${puan}`);

// Puan ogrenci sayfasinda okunur; ders ekraninda degil.
await satir("Mert").getByRole("link", { name: /Mert/ }).click();
await sayfa.getByRole("heading", { name: "Mert Bir" }).waitFor();
ok("Puan OGRENCI sayfasinda gorunuyor",
   (await sayfa.textContent("body")).includes("85"),
   (await sayfa.textContent("body")).replace(/\s+/g, " ").slice(0, 200));

await tarayici.close();
console.log(`\n=== SONUC: ${gecti} gecti, ${kaldi} kaldi ===`);
process.exit(kaldi === 0 ? 0 : 1);
