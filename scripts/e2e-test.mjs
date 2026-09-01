// Arayüz testi: gerçek tarayıcıyla sınıf ve öğrenci ekleme akışını dener.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. npm run build && npm start
//   3. npm install --no-save playwright
//   4. node scripts/e2e-test.mjs
//
// Playwright bilerek bağımlılıklara eklenmedi; yalnızca test için gerekiyor,
// her Vercel derlemesine yük bindirmesin.
import { chromium } from "playwright";
import { oturumHazirla } from "./test-oturum.mjs";
import { ogrenciFormunuAc } from "./test-form.mjs";

const TEMEL = process.env.TEMEL_ADRES ?? "http://127.0.0.1:3000";
let gecti = 0, kaldi = 0;

function ok(ad, kosul, ayrinti = "") {
  if (kosul) { gecti++; console.log(`  GECTI  ${ad}`); }
  else { kaldi++; console.log(`  KALDI  ${ad}${ayrinti ? "  -> " + ayrinti : ""}`); }
}

// Hata mesajinin beklenen metne donusmesini bekler; donmezse gercek metni yazar.
async function hataBekle(sayfa, ad, parca) {
  try {
    await sayfa.waitForFunction(
      (p) => document.querySelector(".hata")?.textContent?.includes(p) ?? false,
      parca,
      { timeout: 8000 },
    );
    ok(ad, true);
  } catch {
    const gercek = await sayfa.textContent(".hata").catch(() => null);
    ok(ad, false, `beklenen "${parca}", gelen ${JSON.stringify(gercek)}`);
  }
}

async function metinBekle(sayfa, parca, sure = 10000) {
  await sayfa.waitForFunction((p) => document.body.innerText.includes(p), parca, { timeout: sure });
}


// maxlength istemci tarafi bir kisit. Sunucu korumasini denemek icin niteligi
// kaldirip degeri ayni adimda yaziyoruz; arada form yeniden kurulursa nitelik
// geri gelir ve deger kirpilir.
async function uzunGonder(sayfa, alan, uzunluk) {
  // Form her sonuctan sonra yeniden kuruluyor. Nitelik kaldirma, deger yazma
  // ve gonderme tek evaluate icinde yapilmazsa arada kurulan yeni form
  // degeri sifirlar.
  await sayfa.waitForTimeout(800);
  await alan.evaluate((el, n) => {
    el.removeAttribute("maxlength");
    const yaz = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    yaz.call(el, "A".repeat(n));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.form.requestSubmit();
  }, uzunluk);
}

// PLAYWRIGHT_CHROMIUM tanımlıysa o kullanılır; değilse Playwright kendi
// indirdiği tarayıcıyı bulur.
const tarayici = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM }
    : {},
);
const sayfa = await tarayici.newPage();

// Uygulama giris istiyor; once hesap kurulur ya da girilir.
await oturumHazirla(sayfa, TEMEL);

// --- A: Baslangic ---
console.log("\nA. Baslangic durumu");
await sayfa.goto(TEMEL, { waitUntil: "networkidle" });
ok("Ana sayfa aciliyor", (await sayfa.title()) === "Teacher OS");
ok("Baslik 'Siniflarim'", await sayfa.getByRole("heading", { name: "Sınıflarım" }).isVisible());
ok("Bos durum mesaji goruluyor", (await sayfa.textContent("body")).includes("Henüz sınıf yok"));

// --- B: Sinif ekleme ---
console.log("\nB. Sinif ekleme");
await sayfa.getByLabel("Sınıf adı").fill("5-A");
await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
await metinBekle(sayfa, "5-A");
ok("Sinif listede goruluyor", true);
ok("Ogrenci sayisi 0", (await sayfa.textContent("body")).includes("0 öğrenci"));
ok("Form temizlendi", (await sayfa.getByLabel("Sınıf adı").inputValue()) === "");

await sayfa.getByLabel("Sınıf adı").fill("6-B");
await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
await metinBekle(sayfa, "6-B");
ok("Ikinci sinif eklendi", true);

// --- C: Sinif formu dogrulamasi ---
console.log("\nC. Sinif formu dogrulamasi");
await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
await hataBekle(sayfa, "Bos ad reddedildi", "Sınıf adı boş olamaz.");

await sayfa.getByLabel("Sınıf adı").fill("   ");
await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
await hataBekle(sayfa, "Sadece bosluk reddedildi", "Sınıf adı boş olamaz.");

// maxLength istemci tarafinda; sunucu korumasini dogrulamak icin kaldiriliyor.
ok("Hatadan sonra sinif adi korundu",
  (await sayfa.getByLabel("Sınıf adı").inputValue()) === "   ");

await uzunGonder(sayfa, sayfa.getByLabel("Sınıf adı"), 61);
await hataBekle(sayfa, "61 karakterlik sinif adi sunucuda reddedildi", "en fazla 60 karakter");

// --- D: Sinif detayi ---
console.log("\nD. Sinif detay sayfasi");
await sayfa.goto(TEMEL, { waitUntil: "networkidle" });
await sayfa.getByRole("link", { name: /5-A/ }).click();
// App Router istemci tarafinda gezinir; yuklenme olayi olmaz, basligi beklemek gerekir.
await sayfa.getByRole("heading", { name: "5-A" }).waitFor({ timeout: 10000 });
ok("Detay sayfasi acildi", true);
ok("Adres /sinif/ ile basliyor", /\/sinif\/[a-z0-9]+$/.test(sayfa.url()), sayfa.url());
ok("Bos ogrenci mesaji", (await sayfa.textContent("body")).includes("henüz öğrenci yok"));
const sinifUrl = sayfa.url();

// --- E: Ogrenci ekleme ---
console.log("\nE. Ogrenci ekleme");
await ogrenciFormunuAc(sayfa);
await sayfa.getByLabel("Ad", { exact: true }).fill("Zeynep");
await sayfa.getByLabel("Soyad").fill("Arslan");
await sayfa.getByLabel(/Veli adı/).fill("Fatma Arslan");
await sayfa.getByLabel(/Veli telefonu/).fill("05551112233");
await sayfa.getByRole("checkbox").check();
await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
await metinBekle(sayfa, "Zeynep");
let govde = await sayfa.textContent("body");
ok("Ogrenci listede", govde.includes("Zeynep Arslan"));
// Puan ders ekraninda gosterilmez; baslangic degeri behavior-ui-test'te
// kaydin kendisinden dogrulanir.
ok("Puan ders ekraninda YOK", !govde.includes("puan"));
ok("Ogrenci sayisi 1", (await sayfa.locator(".ogrenci").count()) === 1);
ok("Form temizlendi", (await sayfa.getByLabel("Ad", { exact: true }).inputValue()) === "");

await ogrenciFormunuAc(sayfa);

await sayfa.getByLabel("Ad", { exact: true }).fill("Mert");
await sayfa.getByLabel("Soyad").fill("Yildiz");
await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
await metinBekle(sayfa, "Mert");
ok("Velisiz ogrenci eklendi", true);
ok("Ogrenci sayisi 2", (await sayfa.locator(".ogrenci").count()) === 2);

// --- F: Ogrenci formu dogrulamasi ---
console.log("\nF. Ogrenci formu dogrulamasi");
await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
await hataBekle(sayfa, "Bos ad reddedildi", "Öğrenci adı boş olamaz.");

await ogrenciFormunuAc(sayfa);

await sayfa.getByLabel("Ad", { exact: true }).fill("Ali");
await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
await hataBekle(sayfa, "Soyadsiz reddedildi", "Öğrenci soyadı boş olamaz.");

ok("Hatadan sonra ad korundu", (await sayfa.getByLabel("Ad", { exact: true }).inputValue()) === "Ali");

await sayfa.getByLabel(/Veli telefonu/).fill("05559998877");
// Telefon girilince izin kutusu gorunur ve `required` olur; soyad uzunlugunu
// sinamak icin once kutu isaretlenir, yoksa tarayici gonderimi kendisi engeller.
await sayfa.getByRole("checkbox").check();
await uzunGonder(sayfa, sayfa.getByLabel("Soyad"), 61);
await hataBekle(sayfa, "61 karakterlik soyad sunucuda reddedildi", "en fazla 60 karakter");
ok("Hatadan sonra veli telefonu korundu",
  (await sayfa.getByLabel(/Veli telefonu/).inputValue()) === "05559998877");
ok("Hatadan sonra ad hala duruyor",
  (await sayfa.getByLabel("Ad", { exact: true }).inputValue()) === "Ali");

// Telefon girilip izin onaylanmazsa sunucu reddeder (hukuki/KVKK gerekcesi:
// veli iletisim verisi icin ogretmenin izin beyaninin zaman damgali izi).
// Onceki hatali gonderimden sonra kutu isaretsiz baslar (bkz. OgrenciFormu:
// `girilen` icinde veliOnayi tasinmaz). `required` nitelik tarayicida
// engeller; sunucunun BAGIMSIZ olarak da reddettigini kanitlamak icin
// nitelik kaldirilip oyle gonderilir (bkz. lock-ui-test'teki ayni desen).
await sayfa.getByLabel("Soyad").fill("Veli");
await sayfa.locator('input[name="veliOnayi"]').evaluate((el) => el.removeAttribute("required"));
await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
await hataBekle(sayfa, "Onaysiz telefon reddedildi", "iznin olduğunu onaylamalısınız");

await sayfa.getByRole("checkbox").check();
await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
await metinBekle(sayfa, "Ali Veli");
ok("Onay verilince ogrenci eklendi", (await sayfa.textContent("body")).includes("Ali Veli"));

// --- G: Ana sayfaya yansima ---
console.log("\nG. Ana sayfaya yansima");
await sayfa.goto(TEMEL, { waitUntil: "networkidle" });
const anaGovde = (await sayfa.textContent("body")).replace(/\s+/g, " ");
// F bolumunde "Ali Veli" eklendigi icin artik 3 (Zeynep, Mert, Ali Veli).
ok("5-A icin 3 ogrenci", /5-A\s*3 öğrenci/.test(anaGovde), anaGovde.slice(0, 160));
ok("6-B icin 0 ogrenci", /6-B\s*0 öğrenci/.test(anaGovde));

// --- H: Olmayan sinif ---
console.log("\nH. Olmayan sinif adresi");
const yanit = await sayfa.goto(`${TEMEL}/sinif/olmayan-id-123`, { waitUntil: "networkidle" });
ok("404 donuyor", yanit.status() === 404, `durum=${yanit.status()}`);
ok("Turkce 404 sayfasi", (await sayfa.textContent("body")).includes("Sayfa bulunamadı"));

// --- I: Turkce karakterler ---
console.log("\nI. Turkce karakter kontrolu");
await sayfa.goto(sinifUrl, { waitUntil: "networkidle" });
await ogrenciFormunuAc(sayfa);
await sayfa.getByLabel("Ad", { exact: true }).fill("Işıl");
await sayfa.getByLabel("Soyad").fill("Çağlayan Öğüt");
await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
await metinBekle(sayfa, "Işıl");
ok("Turkce karakterler bozulmadan kaydedildi", (await sayfa.textContent("body")).includes("Işıl Çağlayan Öğüt"));

// --- J: Siralama ve kalicilik ---
console.log("\nJ. Kalicilik");
await sayfa.reload({ waitUntil: "networkidle" });
govde = await sayfa.textContent("body");
ok("Yenilemeden sonra veriler duruyor", govde.includes("Zeynep Arslan") && govde.includes("Işıl"));
// Zeynep, Mert, Ali Veli, Işıl.
ok("Ogrenci sayisi 4", (await sayfa.locator(".ogrenci").count()) === 4);

await tarayici.close();
console.log(`\n=== SONUC: ${gecti} gecti, ${kaldi} kaldi ===`);
process.exit(kaldi === 0 ? 0 : 1);
