// Davranış şablonlarının arayüz testi: basit sistemi, elle not girmeyi,
// kart sistemine geçişi ve geri dönüşü dener.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. npm run build && npm start
//   3. npm install --no-save playwright
//   4. node scripts/template-ui-test.mjs
import { chromium } from "playwright";
import { oturumHazirla } from "./test-oturum.mjs";

const TEMEL = "http://127.0.0.1:3000";
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

function satir(ad) { return sayfa.locator("li").filter({ hasText: ad }); }
async function satirMetni(ad) { return satir(ad).evaluate((el) => el.innerText); }
async function bas(ad, etiket) {
  const onceki = await satirMetni(ad);
  await satir(ad).getByRole("button", { name: etiket }).click();
  await sayfa.waitForFunction(
    ([isim, eski]) => {
      const li = [...document.querySelectorAll("li")].find((e) => e.innerText.includes(isim));
      return li && li.innerText !== eski;
    }, [ad, onceki], { timeout: 10000 });
  await sayfa.waitForTimeout(400);
}
async function puan(ad) {
  const m = (await satirMetni(ad)).match(/(-?\d+) puan/);
  return m ? Number(m[1]) : null;
}

// --- A: Varsayilan sablon ---
console.log("\nA. Varsayilan sistem");
await sayfa.goto(TEMEL, { waitUntil: "networkidle" });
await sayfa.getByLabel("Sınıf adı").fill("8-D");
await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("8-D"), null, { timeout: 10000 });
await sayfa.getByRole("link", { name: /8-D/ }).click();
await sayfa.getByRole("heading", { name: "8-D" }).waitFor();
await sayfa.getByLabel("Ad", { exact: true }).fill("Deniz");
await sayfa.getByLabel("Soyad").fill("Ak");
await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Deniz"), null, { timeout: 10000 });

ok("Arti dugmesi var", await satir("Deniz").getByRole("button", { name: "Artı ver" }).isVisible());
ok("Eksi dugmesi var", await satir("Deniz").getByRole("button", { name: "Eksi ver" }).isVisible());
ok("Yildiz dugmesi YOK", (await satir("Deniz").getByRole("button", { name: "Yıldız ver" }).count()) === 0);
ok("Sayimlar goruluyor", (await satirMetni("Deniz")).includes("0 artı · 0 eksi"));

// --- B: Basit sistemde kayit ---
console.log("\nB. Basit sistemde kayit");
await sayfa.getByRole("button", { name: "Yeni ders başlat" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Aktif ders:"), null, { timeout: 10000 });
await bas("Deniz", "Artı ver");
ok("Arti sayildi", (await satirMetni("Deniz")).includes("1 artı"));
ok("Puan DEGISMEDI", (await puan("Deniz")) === 90, `puan=${await puan("Deniz")}`);
await bas("Deniz", "Eksi ver");
await bas("Deniz", "Eksi ver");
ok("Eksiler sayildi", (await satirMetni("Deniz")).includes("2 eksi"));
ok("Puan hala 90", (await puan("Deniz")) === 90, `puan=${await puan("Deniz")}`);
ok("Kart rozeti yok", !(await satirMetni("Deniz")).includes("kart"));

// --- C: Elle not girme ---
console.log("\nC. Elle not girme");
await sayfa.getByRole("link", { name: /Deniz Ak/ }).click();
await sayfa.getByRole("heading", { name: "Deniz Ak" }).waitFor();
const govde = await sayfa.textContent("body");
ok("Ogrenci sayfasi acildi", govde.includes("performans notu"));
await sayfa.getByLabel("Performans notu").fill("74");
await sayfa.getByRole("button", { name: "Kaydet" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("74"), null, { timeout: 10000 });
ok("Not kaydedildi", (await sayfa.textContent("body")).includes("74"));
// Tarayici min/max ile gondermeyi engelliyor mu?
await sayfa.getByLabel("Performans notu").fill("150");
await sayfa.getByRole("button", { name: "Kaydet" }).click();
await sayfa.waitForTimeout(1200);
ok("Tarayici gecersiz notu gondermedi",
  (await sayfa.getByLabel("Performans notu").evaluate((el) => el.checkValidity())) === false);

// Nitelikler kaldirilirsa sunucu koruyor mu? Yazma ve gonderme tek adimda.
await sayfa.waitForTimeout(600);
await sayfa.getByLabel("Performans notu").evaluate((el) => {
  el.removeAttribute("min");
  el.removeAttribute("max");
  const yaz = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  yaz.call(el, "150");
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.form.requestSubmit();
});
await sayfa.waitForSelector(".hata", { timeout: 10000 });
ok("Sunucu gecersiz notu reddetti", (await sayfa.textContent(".hata")).includes("0 ile 100"));
ok("Not degismedi", (await sayfa.textContent("body")).includes("74"));

// --- D: Kart sistemine gecis ---
console.log("\nD. Kart sistemine gecis");
await sayfa.goto(`${TEMEL}/ayarlar`, { waitUntil: "networkidle" });
ok("Basit sistem secili", await sayfa.getByRole("radio", { name: /Basit/ }).isChecked());
await sayfa.getByRole("radio", { name: /Kart sistemi/ }).check();
await sayfa.getByRole("button", { name: "Kaydet" }).click();
await sayfa.waitForSelector(".basari", { timeout: 10000 });
ok("Ayar kaydedildi", (await sayfa.textContent(".basari")).includes("değiştirildi"));

await sayfa.goto(TEMEL, { waitUntil: "networkidle" });
await sayfa.getByRole("link", { name: /8-D/ }).click();
await sayfa.getByRole("heading", { name: "8-D" }).waitFor();
ok("Yildiz dugmesi geldi", await satir("Deniz").getByRole("button", { name: "Yıldız ver" }).isVisible());
ok("Sari kart dugmesi geldi", await satir("Deniz").getByRole("button", { name: "Sarı kart ver" }).isVisible());
ok("Arti dugmesi gitti", (await satir("Deniz").getByRole("button", { name: "Artı ver" }).count()) === 0);
ok("Elle girilen not korundu", (await puan("Deniz")) === 74, `puan=${await puan("Deniz")}`);

// --- E: Kart kurallari hala calisiyor ---
console.log("\nE. Kart kurallari");
await bas("Deniz", "Sarı kart ver");
ok("Ilk uyari sari kart", (await satirMetni("Deniz")).includes("Sarı kart"));
await bas("Deniz", "Sarı kart ver");
ok("Ikinci uyari kirmizi kart", (await satirMetni("Deniz")).includes("Kırmızı kart"));

// --- F: Basit sisteme geri donus ---
console.log("\nF. Geri donus");
await sayfa.goto(`${TEMEL}/ayarlar`, { waitUntil: "networkidle" });
await sayfa.getByRole("radio", { name: /Basit/ }).check();
await sayfa.getByRole("button", { name: "Kaydet" }).click();
await sayfa.waitForSelector(".basari", { timeout: 10000 });
await sayfa.goto(TEMEL, { waitUntil: "networkidle" });
await sayfa.getByRole("link", { name: /8-D/ }).click();
await sayfa.getByRole("heading", { name: "8-D" }).waitFor();
const son = await satirMetni("Deniz");
ok("Arti/eksi dugmeleri geri geldi", await satir("Deniz").getByRole("button", { name: "Artı ver" }).isVisible());
ok("Kart rozeti gizlendi", !son.includes("Sarı kart") && !son.includes("Kırmızı kart"), son.replace(/\n/g, " | "));
ok("Kart doneminde artan eksiler sayimda", son.includes("3 eksi"), son.replace(/\n/g, " | "));

await tarayici.close();
console.log(`\n=== SONUC: ${gecti} gecti, ${kaldi} kaldi ===`);
process.exit(kaldi === 0 ? 0 : 1);
