// Veli iletişimi: şablon önizleme, taslak/gönderildi akışı, WhatsApp
// bağlantısının doğru numarayla kurulması, mesaj geçmişi ve sahiplik.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. SESSION_SECRET tanımlı olacak şekilde: npm run build && npm start
//   3. npm install --no-save playwright
//   4. node scripts/parent-message-ui-test.mjs
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

// --disable-popup-blocking: WhatsApp bağlantısı window.open ile yeni sekmede
// açılır; bazı Chromium sürümleri bunu tıklamanın içinden çağrılsa bile
// engelleyebiliyor. Gerçek kullanıcıda böyle bir sorun yok, yalnızca test
// ortamı için.
const tarayici = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
  args: ["--disable-popup-blocking"],
});
const sayfa = await (await tarayici.newContext()).newPage();
await oturumHazirla(sayfa, T);

// --- A. Hazirlik ---
console.log("\nA. Hazirlik");
await sayfa.goto(T, { waitUntil: "networkidle" });
await sayfa.getByLabel("Sınıf adı").fill("Veli-Test");
await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Veli-Test"), null, { timeout: 10000 });
await sayfa.getByRole("link", { name: /Veli-Test/ }).click();
await sayfa.waitForURL(/\/sinif\//, { timeout: 10000 });

await ogrenciFormunuAc(sayfa);
// Veli bilgisi bilerek BOS birakiliyor: eksik girilen ogrenci senaryosu.
await sayfa.getByLabel("Ad", { exact: true }).fill("Mert");
await sayfa.getByLabel("Soyad").fill("Aydın");
await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Mert"), null, { timeout: 10000 });
await dersBaslat(sayfa);

const satir = sayfa.locator("li").filter({ hasText: "Mert" });
await satir.getByRole("button", { name: "Artı ver" }).click();
await sayfa.waitForTimeout(600);
await satir.getByRole("button", { name: "Artı ver" }).click();
await sayfa.waitForTimeout(600);
await satir.getByRole("button", { name: "Eksi ver" }).click();
await sayfa.waitForTimeout(600);
ok("Iki arti bir eksi kaydedildi", sql(`SELECT count(*) FROM "BehaviorLog";`) === "3");

await sayfa.getByRole("link", { name: "Mert" }).click();
await sayfa.waitForURL(/\/ogrenci\//, { timeout: 10000 });
const OGRENCI_ADRESI = new URL(sayfa.url()).pathname;
const OGRENCI_ID = OGRENCI_ADRESI.split("/").pop();

// --- B. Veli sekmesi bos hali ---
console.log("\nB. Bos veli sekmesi");
await sayfa.goto(`${T}/veli`, { waitUntil: "networkidle" });
ok("Bos liste mesaji var", (await sayfa.innerText("body")).includes("Henüz mesaj yok"));
ok("Sekmede sayac YOK", (await sayfa.locator(".sekme-sayac").count()) === 0);

// --- C. Yeni mesaj: sablon onizleme, telefon yok ---
console.log("\nC. Yeni mesaj (telefon henuz girilmemis)");
await sayfa.getByRole("link", { name: "+ Yeni mesaj" }).click();
await sayfa.waitForURL(`${T}/veli/yeni`, { timeout: 10000 });
await sayfa.getByRole("link", { name: "Mert Aydın" }).click();
await sayfa.waitForURL(`${T}/veli/yeni/${OGRENCI_ID}`, { timeout: 10000 });

ok("Telefon girilmemis notu gorunuyor", (await sayfa.innerText("body")).includes("telefon girilmemiş"));
ok("Odev sablonu yok (odev verilmedi)", (await sayfa.locator(".veli-sablon", { hasText: "Ödev durumu" }).count()) === 0);
ok("Sinav sablonu yok (sinav yok)", (await sayfa.locator(".veli-sablon", { hasText: "Son sınav" }).count()) === 0);

await sayfa.getByRole("button", { name: "Davranış özeti" }).click();
const textarea = sayfa.locator("textarea");
ok("Sablon dogru sayilarla doldu", (await textarea.inputValue()).includes("2 artı ve 1 eksi"));

const whatsappBaglantisiLink = sayfa.locator("a.veli-buton-baglanti");
ok(
  "Telefon yokken WhatsApp baglantisi pasif (href yok)",
  (await whatsappBaglantisiLink.getAttribute("href")) === null,
);

await sayfa.getByRole("button", { name: "Taslak olarak kaydet" }).click();
await sayfa.waitForTimeout(1000);
ok("Taslak veritabanina yazildi", sql(`SELECT status FROM "ParentMessage";`) === "DRAFT");

// --- D. /veli listesinde taslak ve sayac ---
console.log("\nD. Taslak listede");
await sayfa.goto(`${T}/veli`, { waitUntil: "networkidle" });
const veliGovde = await sayfa.innerText("body");
ok("Taslak listede goruluyor", veliGovde.includes("Mert Aydın") && veliGovde.includes("2 artı ve 1 eksi"));
await sayfa.goto(`${T}/`, { waitUntil: "networkidle" });
ok("Sekmede 1 taslak sayaci var", (await sayfa.locator(".sekme-sayac").innerText()) === "1");

// --- E. Veli bilgisi sonradan eklenir ---
console.log("\nE. Veli bilgisi ekleme");
await sayfa.goto(`${T}${OGRENCI_ADRESI}`, { waitUntil: "networkidle" });
await sayfa.locator("summary", { hasText: "Veli bilgilerini düzenle" }).click();
const veliForm = sayfa.locator("form").filter({ has: sayfa.getByLabel("Veli adı") });
await veliForm.getByLabel("Veli adı").fill("Ayşe Aydın");
await veliForm.getByLabel("Veli telefonu").fill("0555 123 45 67");
await veliForm.getByRole("checkbox").check();
await veliForm.getByRole("button", { name: "Kaydet" }).click();
await sayfa.waitForSelector(".basari", { timeout: 10000 });
ok("Veli bilgisi veritabaninda", sql(`SELECT "parentPhone" FROM "Student" WHERE id='${OGRENCI_ID}';`) === "0555 123 45 67");

await sayfa.reload({ waitUntil: "networkidle" });
ok("Ust bilgi satirinda telefon gorunuyor", (await sayfa.innerText("body")).includes("0555 123 45 67"));

// --- F. WhatsApp'ta gonderme ---
console.log("\nF. WhatsApp uzerinden gonderme");
await sayfa.goto(`${T}/veli/yeni/${OGRENCI_ID}`, { waitUntil: "networkidle" });
await sayfa.getByRole("button", { name: "Davranış özeti" }).click();
const waAdresi = await sayfa.locator("a.veli-buton-baglanti").getAttribute("href");
ok(
  "WhatsApp baglantisi dogru numarayla kuruldu",
  (waAdresi ?? "").startsWith("https://wa.me/905551234567?text="),
  waAdresi ?? "yok",
);
ok(
  "Mesaj metni baglantiya kodlanmis",
  (waAdresi ?? "").includes(encodeURIComponent("2 artı ve 1 eksi")),
);

// Tiklama, geri kalan kaydi arka planda tetikler. Yeni sekmenin gercekten
// acilip acilmadigi burada sinanmiyor: bu ortamin sandbox'i target=_blank
// navigasyonunu tumden engelliyor (bir dogrulama scriptiyle ayrica
// kanitlandi, uygulamadan bagimsiz). Gercek bir tarayicida <a target="_blank">
// tıklaması evrensel, guvenilir bir davranistir.
await sayfa.locator("a.veli-buton-baglanti").click();
await sayfa.waitForTimeout(1500);
ok(
  "Ikinci mesaj SENT olarak kaydedildi",
  sql(`SELECT count(*) FROM "ParentMessage" WHERE status='SENT';`) === "1",
);
ok("Form gonderdikten sonra temizlendi", (await textarea.inputValue()) === "");

// --- G. Eski taslak da guncel telefonu kullanir ---
console.log("\nG. Taslagin hizli islemleri");
await sayfa.goto(`${T}/veli`, { waitUntil: "networkidle" });
const taslakSatiri = sayfa.locator("li").filter({ hasText: "Taslak" }).first();
ok("Hala bir taslak var", (await taslakSatiri.count()) === 1);
ok(
  "Eski taslak da guncel telefonla WhatsApp acabiliyor",
  (await taslakSatiri.getByRole("link", { name: "WhatsApp" }).getAttribute("href")) !== null,
);

await taslakSatiri.getByRole("button", { name: "Kopyala" }).click();
await sayfa.waitForFunction(
  () => !document.body.innerText.includes("Taslak"),
  null,
  { timeout: 10000 },
);
ok(
  "Kopyala da gonderildi isaretliyor",
  sql(`SELECT count(*) FROM "ParentMessage" WHERE status='DRAFT';`) === "0",
);
await sayfa.goto(`${T}/`, { waitUntil: "networkidle" });
ok("Sayac artik gorunmuyor", (await sayfa.locator(".sekme-sayac").count()) === 0);

// Not: uzunluk sınırının sunucuda da uygulandığı `parent-message-rules-test.mjs`
// içinde doğrudan sınanır. Burada denenmiyor, çünkü istemci de aynı saf
// fonksiyonla kapatılıyor (button disabled olur) — tarayıcıdan bunu atlamak
// React'ın kendi durumunu da devre dışı bırakmayı gerektirir, gerçekçi
// bir kullanıcı davranışı değildir.

// --- H. Sahiplik ---
console.log("\nH. Sahiplik");
const hash = bcrypt.hashSync("ikinci-parola-123", 12);
sql(`
INSERT INTO "Teacher" (id, email, name, "passwordHash", "createdAt")
VALUES ('t-veli-ikinci', 'veli-ikinci@ornek.com', 'İkinci Öğretmen', '${hash}', now());
`);
const ikinci = await (await tarayici.newContext()).newPage();
await ikinci.goto(`${T}/giris`, { waitUntil: "networkidle" });
await ikinci.getByLabel("E-posta").fill("veli-ikinci@ornek.com");
await ikinci.getByLabel("Parola").fill("ikinci-parola-123");
await ikinci.getByRole("button", { name: "Giriş yap" }).click();
await ikinci.waitForURL(`${T}/`, { timeout: 20000 });

await ikinci.goto(`${T}/veli`, { waitUntil: "networkidle" });
ok(
  "Ikinci ogretmen ilk ogretmenin mesajini GORMUYOR",
  !(await ikinci.innerText("body")).includes("Mert Aydın"),
);

let yanit = await ikinci.goto(`${T}/veli/yeni/${OGRENCI_ID}`, { waitUntil: "networkidle" });
ok("Baskasinin ogrencisine mesaj sayfasi 404", yanit.status() === 404, `durum=${yanit.status()}`);

// Form kurcalayarak sahiplik asma denemesi: VeliMesajFormu artik gizli alan
// tasimiyor (server action dogrudan cagriliyor), ama VeliBilgisiFormu hala
// gercek bir form — kendi ogrencisi icin acilan formun gizli alani
// baskasinin id'sine degistirilir.
sql(`
INSERT INTO "Classroom" (id, "teacherId", name, "isActive", "createdAt")
VALUES ('c-veli-ikinci', 't-veli-ikinci', 'Ikinci Sinif', true, now());
INSERT INTO "Student" (id, "classroomId", "firstName", "lastName", "isActive", "createdAt")
VALUES ('s-veli-ikinci', 'c-veli-ikinci', 'Deneme', 'Ogrenci', true, now());
`);
await ikinci.goto(`${T}/ogrenci/s-veli-ikinci`, { waitUntil: "networkidle" });
await ikinci.locator("summary", { hasText: "Veli bilgilerini düzenle" }).click();
const ikinciVeliForm = ikinci.locator("form").filter({ has: ikinci.getByLabel("Veli adı") });
await ikinciVeliForm.getByLabel("Veli adı").fill("Sizinti Veli");
await ikinciVeliForm
  .locator('input[name="ogrenciId"]')
  .evaluate((el, id) => { el.value = id; }, OGRENCI_ID);
const oncekiVeliAdi = sql(`SELECT "parentName" FROM "Student" WHERE id='${OGRENCI_ID}';`);
await ikinciVeliForm.getByRole("button", { name: "Kaydet" }).click();
await ikinci.waitForSelector(".hata", { timeout: 10000 });
ok(
  "Baskasinin ogrencisinin veli bilgisi degistirilemedi",
  (await ikinci.innerText(".hata")).includes("bulunamadı"),
);
ok(
  "Veli adi degismedi",
  sql(`SELECT "parentName" FROM "Student" WHERE id='${OGRENCI_ID}';`) === oncekiVeliAdi,
);

console.log(`\nSonuc: ${gecti} gecti, ${kaldi} kaldi\n`);
await tarayici.close();
process.exit(kaldi === 0 ? 0 : 1);
