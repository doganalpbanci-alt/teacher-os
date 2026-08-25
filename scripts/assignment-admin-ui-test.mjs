// Ödev yönetimi testi: düzenleme, öğrenci ekleme/çıkarma, arşivleme,
// silme kuralı ve kopyalama.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. SESSION_SECRET tanımlı olacak şekilde: npm run build && npm start
//   3. npm install --no-save playwright
//   4. SQL_KOMUTU='psql "$DATABASE_URL" -q -tA' node scripts/assignment-admin-ui-test.mjs
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
const sayfa = await (await tarayici.newContext()).newPage();
await oturumHazirla(sayfa, T);

// innerText, textContent degil: textContent Next.js'in sayfaya gomdugu RSC
// veri script'ini de dondurur ve ekranda OLMAYAN isimler orada gecer.
// "su ogrenci listede yok" gibi kontroller o zaman sessizce yaniltir.
const govde = () => sayfa.innerText("body");
const say = (tablo) => sql(`SELECT count(*) FROM "${tablo}";`);
const detayiBekle = () =>
  sayfa.waitForFunction(() => document.body.innerText.includes("tamamlanma"), null, { timeout: 15000 });

// --- A: Hazirlik ---
console.log("\nA. Hazirlik");
await sayfa.goto(T, { waitUntil: "networkidle" });
await sayfa.getByLabel("Sınıf adı").fill("Yonetim-7C");
await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Yonetim-7C"), null, { timeout: 10000 });
await sayfa.getByRole("link", { name: /Yonetim-7C/ }).click();
await sayfa.getByRole("heading", { name: "Yonetim-7C" }).waitFor();
for (const [a, b] of [["Ali", "Bir"], ["Berk", "Iki"], ["Ceren", "Uc"]]) {
  await ogrenciFormunuAc(sayfa);
  await sayfa.getByLabel("Ad", { exact: true }).fill(a);
  await sayfa.getByLabel("Soyad").fill(b);
  await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
  await sayfa.waitForFunction((x) => document.body.innerText.includes(x), a, { timeout: 10000 });
}
ok("Uc ogrenci kuruldu", say("Student") === "3", `ogrenci=${say("Student")}`);

// --- B: Odev olustur (tum sinif) ---
console.log("\nB. Odev olustur");
await sayfa.goto(`${T}/odevler/yeni`, { waitUntil: "networkidle" });
await sayfa.getByLabel("Ödev başlığı").fill("Reading passage");
await sayfa.getByLabel("Ödev içeriği ve açıklama").fill("Ilk okuma parcasi");
await sayfa.locator("fieldset").filter({ hasText: "Yonetim-7C" })
  .locator("input[type=checkbox]").first().check();
await sayfa.getByRole("button", { name: "Ödevi ver" }).click();
await detayiBekle();
const odevAdresi = sayfa.url();
ok("Uc teslim kaydi acildi", say("Submission") === "3", `teslim=${say("Submission")}`);

// --- C: Isaretsizken silinebilir ---
console.log("\nC. Isaretsizken silinebilir");
ok("Sil dugmesi gorunuyor", (await sayfa.getByRole("button", { name: "Sil" }).count()) === 1);

// --- D: Isaretlenince silinemez ---
console.log("\nD. Isaretlenince silinemez");
await sayfa.locator("li").filter({ hasText: "Ali" }).getByRole("button", { name: "Yapıldı" }).click();
await sayfa.waitForFunction(() => {
  const li = [...document.querySelectorAll("li")].find((e) => e.innerText.includes("Ali"));
  return li && li.querySelector("button.secili.t-done");
}, null, { timeout: 10000 });
await sayfa.reload({ waitUntil: "networkidle" });
ok("Sil dugmesi KALKTI", (await sayfa.getByRole("button", { name: "Sil" }).count()) === 0);

// Dugme gizlemek yetki kontrolu degildir: sunucu da reddetmeli.
const odevId = odevAdresi.split("/").pop();
const redYaniti = await sayfa.evaluate(async (id) => {
  const y = await fetch(`/odevler/${id}`, { method: "POST" });
  return y.status;
}, odevId);
ok("Sunucu tarafi da korunuyor", redYaniti >= 400 || say("Assignment") === "1",
   `durum=${redYaniti} odev=${say("Assignment")}`);
ok("Odev duruyor", say("Assignment") === "1", `odev=${say("Assignment")}`);

// --- E: Duzenleme: alanlar ---
console.log("\nE. Duzenleme: alanlar");
await sayfa.goto(`${odevAdresi}/duzenle`, { waitUntil: "networkidle" });
ok("Mevcut baslik dolu",
   (await sayfa.getByLabel("Ödev başlığı").inputValue()) === "Reading passage");
ok("Mevcut secim isaretli", (await govde()).includes("3 öğrenci"));
await sayfa.getByLabel("Ödev başlığı").fill("Reading passage v2");
await sayfa.getByLabel("Son teslim tarihi").fill("2026-12-31");
await sayfa.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
await detayiBekle();
ok("Baslik degisti", (await govde()).includes("Reading passage v2"));
ok("Tarih degisti", (await govde()).includes("31 Aralık 2026"));
ok("Teslim kayitlari korundu", say("Submission") === "3", `teslim=${say("Submission")}`);
ok("Isaretli kayit korundu",
   sql(`SELECT count(*) FROM "Submission" WHERE status='DONE';`) === "1");

// --- F: Duzenleme: ogrenci cikarma uyarisi ---
console.log("\nF. Ogrenci cikarma uyarisi");
await sayfa.goto(`${odevAdresi}/duzenle`, { waitUntil: "networkidle" });
// Isaretlenmis Ali'yi cikar: uyari cikmali.
await sayfa.locator("label").filter({ hasText: "Ali Bir" }).locator("input").uncheck();
await sayfa.waitForFunction(() => document.body.innerText.includes("kaydı silinecek"), null, { timeout: 5000 });
ok("Kaybolacak kayit uyarisi cikti", (await govde()).includes("kaydı silinecek"));
ok("Uyari sayisi dogru", (await govde()).includes("1 öğrenci işaretlenmiş"),
   (await govde()).replace(/\s+/g, " ").match(/.{0,80}işaretlenmiş.{0,40}/)?.[0] ?? "");

// Isaretsiz Berk'i de cikar, sonra kaydet.
await sayfa.locator("label").filter({ hasText: "Berk Iki" }).locator("input").uncheck();
await sayfa.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
await detayiBekle();
ok("Iki teslim kaydi silindi", say("Submission") === "1", `teslim=${say("Submission")}`);
const kalanSatirlar = await sayfa.locator("section.kart .liste li").allInnerTexts();
ok("Kalan yalnizca Ceren",
   kalanSatirlar.length === 1 && kalanSatirlar[0].includes("Ceren Uc"),
   kalanSatirlar.join(" | "));
ok("Odev kaydi duruyor", say("Assignment") === "1");

// --- G: Duzenleme: ogrenci geri ekleme ---
console.log("\nG. Ogrenci geri ekleme");
await sayfa.goto(`${odevAdresi}/duzenle`, { waitUntil: "networkidle" });
await sayfa.locator("label").filter({ hasText: "Ali Bir" }).locator("input").check();
await sayfa.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
await detayiBekle();
ok("Ogrenci geri eklendi", say("Submission") === "2", `teslim=${say("Submission")}`);
// Geri eklenen ogrenci sifirdan baslar: eski DONE geri gelmez.
ok("Geri eklenen Bekliyor olarak basliyor",
   sql(`SELECT count(*) FROM "Submission" WHERE status='PENDING';`) === "2",
   `bekliyor=${sql(`SELECT count(*) FROM "Submission" WHERE status='PENDING';`)}`);

// --- H: Silme (artik hepsi isaretsiz) ---
console.log("\nH. Silme");
await sayfa.reload({ waitUntil: "networkidle" });
ok("Sil dugmesi geri geldi", (await sayfa.getByRole("button", { name: "Sil" }).count()) === 1);

// --- I: Arsivleme ---
console.log("\nI. Arsivleme");
await sayfa.getByRole("button", { name: "Arşivle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Arşivden çıkar"), null, { timeout: 10000 });
ok("Arsiv isaretlendi", (await govde()).includes("arşivde"));
ok("Kayitlar duruyor", say("Submission") === "2", `teslim=${say("Submission")}`);

await sayfa.goto(`${T}/odevler`, { waitUntil: "networkidle" });
ok("Aktif listede YOK", !(await govde()).includes("Reading passage v2"));
await sayfa.goto(`${T}/odevler?filtre=arsiv`, { waitUntil: "networkidle" });
ok("Arsiv listesinde VAR", (await govde()).includes("Reading passage v2"));

await sayfa.goto(odevAdresi, { waitUntil: "networkidle" });
await sayfa.getByRole("button", { name: "Arşivden çıkar" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Arşivle"), null, { timeout: 10000 });
await sayfa.goto(`${T}/odevler`, { waitUntil: "networkidle" });
ok("Arsivden cikinca geri geldi", (await govde()).includes("Reading passage v2"));

// --- J: Kopyalama ---
console.log("\nJ. Kopyalama");
await sayfa.goto(odevAdresi, { waitUntil: "networkidle" });
await sayfa.getByRole("link", { name: "Kopyala" }).click();
await sayfa.getByRole("heading", { name: "Ödevi kopyala" }).waitFor();
ok("Baslik kopyalandi",
   (await sayfa.getByLabel("Ödev başlığı").inputValue()) === "Reading passage v2");
ok("Icerik kopyalandi",
   (await sayfa.getByLabel("Ödev içeriği ve açıklama").inputValue()) === "Ilk okuma parcasi");
ok("Hedef BOS geldi", (await govde()).includes("0 öğrenci"));

await sayfa.locator("fieldset").filter({ hasText: "Yonetim-7C" })
  .locator("input[type=checkbox]").first().check();
await sayfa.getByRole("button", { name: "Ödevi ver" }).click();
await detayiBekle();
ok("Ikinci odev olustu", say("Assignment") === "2", `odev=${say("Assignment")}`);
ok("Yeni odevin kendi kayitlari var", say("Submission") === "5", `teslim=${say("Submission")}`);
ok("Kaynak odev degismedi",
   sql(`SELECT count(*) FROM "Submission" WHERE "assignmentId"='${odevId}';`) === "2",
   sql(`SELECT count(*) FROM "Submission" WHERE "assignmentId"='${odevId}';`));

// --- K: Gercek silme ---
console.log("\nK. Gercek silme");
await sayfa.goto(odevAdresi, { waitUntil: "networkidle" });
await sayfa.getByRole("button", { name: "Sil" }).click();
await sayfa.waitForURL(`${T}/odevler`, { timeout: 15000 });
ok("Odev silindi", say("Assignment") === "1", `odev=${say("Assignment")}`);
ok("Teslim kayitlari da gitti", say("Submission") === "3", `teslim=${say("Submission")}`);
ok("Listede yok", !(await govde()).includes("Reading passage v2") ||
   (await sayfa.locator(".liste li").count()) === 1);

// --- L: Bos secimle kaydedilemez ---
console.log("\nL. Bos secim");
await sayfa.goto(`${T}/odevler/yeni`, { waitUntil: "networkidle" });
await sayfa.getByLabel("Ödev başlığı").fill("Bos odev");
ok("Hedef secilmeden dugme pasif",
   await sayfa.getByRole("button", { name: "Ödevi ver" }).isDisabled());
ok("Odev sayisi degismedi", say("Assignment") === "1", `odev=${say("Assignment")}`);

await tarayici.close();
console.log(`\n=== SONUC: ${gecti} gecti, ${kaldi} kaldi ===`);
process.exit(kaldi === 0 ? 0 : 1);
