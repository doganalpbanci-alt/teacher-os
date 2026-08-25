// Ödev modülü testi: ödevler sekmesi, çoklu sınıf/öğrenci atama, tarihler,
// işaretleme, toplu işaretleme, "süresi geçti" rozeti ve sahiplik.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. SESSION_SECRET tanımlı olacak şekilde: npm run build && npm start
//   3. npm install --no-save playwright
//   4. SQL_KOMUTU='psql "$DATABASE_URL" -q -tA' node scripts/assignment-ui-test.mjs
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
const baglam = await tarayici.newContext();
const sayfa = await baglam.newPage();
await oturumHazirla(sayfa, T);

// innerText, textContent degil: textContent Next.js'in sayfaya gomdugu RSC
// veri script'ini de dondurur ve ekranda OLMAYAN isimler orada gecer.
// "su ogrenci listede yok" gibi kontroller o zaman sessizce yaniltir.
const govde = () => sayfa.innerText("body");
const say = (tablo) => sql(`SELECT count(*) FROM "${tablo}";`);

// Gecmis ve gelecek tarihler: "suresi gecti" kurali bugune gore calisiyor.
const gun = (fark) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + fark);
  return d.toISOString().slice(0, 10);
};

async function sinifKur(ad, ogrenciler) {
  await sayfa.goto(T, { waitUntil: "networkidle" });
  await sayfa.getByLabel("Sınıf adı").fill(ad);
  await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
  await sayfa.waitForFunction((x) => document.body.innerText.includes(x), ad, { timeout: 10000 });
  await sayfa.getByRole("link", { name: new RegExp(ad) }).click();
  await sayfa.getByRole("heading", { name: ad }).waitFor();
  const adres = sayfa.url();
  for (const [a, b] of ogrenciler) {
    await ogrenciFormunuAc(sayfa);
    await sayfa.getByLabel("Ad", { exact: true }).fill(a);
    await sayfa.getByLabel("Soyad").fill(b);
    await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
    await sayfa.waitForFunction((x) => document.body.innerText.includes(x), a, { timeout: 10000 });
  }
  return adres;
}

// --- A: Hazirlik, iki sinif ---
console.log("\nA. Hazirlik");
const sinifA = await sinifKur("Odev-5A", [["Ada", "Bir"], ["Efe", "Iki"]]);
const sinifB = await sinifKur("Odev-6B", [["Mert", "Uc"], ["Zeynep", "Dort"]]);
ok("Iki sinif ve dort ogrenci kuruldu", say("Student") === "4", `ogrenci=${say("Student")}`);
ok("Baslangicta odev yok", say("Assignment") === "0", `odev=${say("Assignment")}`);

// --- B: Ust menu ---
console.log("\nB. Ust menu");
await sayfa.goto(T, { waitUntil: "networkidle" });
ok("Odevler sekmesi var", (await sayfa.getByRole("link", { name: "Ödevler" }).count()) >= 1);
await sayfa.getByRole("link", { name: "Ödevler", exact: true }).click();
await sayfa.getByRole("heading", { name: "Ödevler" }).waitFor();
ok("Odevler sayfasi acildi", sayfa.url().includes("/odevler"));
ok("Bos liste mesaji", (await govde()).includes("Henüz ödev yok"));

// --- C: Coklu sinif atamasi ---
console.log("\nC. Coklu sinif atamasi");
await sayfa.getByRole("link", { name: /Yeni ödev/ }).click();
await sayfa.getByRole("heading", { name: "Yeni ödev" }).waitFor();
ok("Iki sinif da secicide", (await govde()).includes("Odev-5A") && (await govde()).includes("Odev-6B"));
ok("Hedef secilmeden kaydedilemez",
   await sayfa.getByRole("button", { name: "Ödevi ver" }).isDisabled());

await sayfa.getByLabel("Ödev başlığı").fill("Unit 4 workbook");
await sayfa.getByLabel("Ödev içeriği ve açıklama").fill("Sayfa 12-14 tamamlanacak");
await sayfa.getByLabel("Başlangıç tarihi").fill(gun(-3));
await sayfa.getByLabel("Son teslim tarihi").fill(gun(4));

// 5A'nin tamami + 6B'den yalnizca Mert: toplu ve tek tek secim birlikte.
const sinifKutusu = (ad) =>
  sayfa.locator("fieldset").filter({ hasText: ad }).locator("input[type=checkbox]").first();
await sinifKutusu("Odev-5A").check();
await sayfa.locator("label").filter({ hasText: "Mert Uc" }).locator("input").check();
ok("Uc ogrenci secili", (await govde()).includes("3 öğrenci"));

await sayfa.getByRole("button", { name: "Ödevi ver" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("tamamlanma"), null, { timeout: 15000 });
ok("Odev detayina yonlendirildi", /\/odevler\/[a-z0-9]+$/.test(sayfa.url()), sayfa.url());
const odevAdresi = sayfa.url();
ok("Bir odev olustu", say("Assignment") === "1", `odev=${say("Assignment")}`);
ok("Uc teslim kaydi acildi", say("Submission") === "3", `teslim=${say("Submission")}`);
ok("Icerik gorunuyor", (await govde()).includes("Sayfa 12-14"));

// --- D: Sinifa gore gruplama ---
console.log("\nD. Sinifa gore gruplama");
ok("Iki sinif basligi var", (await sayfa.locator("section.kart").count()) === 2,
   String(await sayfa.locator("section.kart").count()));
const grup5A = sayfa.locator("section.kart").filter({ hasText: "Odev-5A" });
const grup6B = sayfa.locator("section.kart").filter({ hasText: "Odev-6B" });
ok("5A grubunda iki ogrenci", (await grup5A.locator(".liste li").count()) === 2);
ok("6B grubunda tek ogrenci", (await grup6B.locator(".liste li").count()) === 1);
ok("Secilmeyen ogrenci YOK", !(await govde()).includes("Zeynep Dort"));

// --- E: Tek tek isaretleme ---
console.log("\nE. Tek tek isaretleme");
const adaSatiri = grup5A.locator("li").filter({ hasText: "Ada" });
await adaSatiri.getByRole("button", { name: "Yapıldı" }).click();
await sayfa.waitForFunction(() => {
  const li = [...document.querySelectorAll("li")].find((e) => e.innerText.includes("Ada"));
  return li && li.querySelector("button.secili.t-done");
}, null, { timeout: 10000 });
ok("Ada Yapildi isaretlendi", await adaSatiri.locator("button.secili.t-done").isVisible());
ok("Veritabanina yazildi",
   sql(`SELECT count(*) FROM "Submission" WHERE status='DONE';`) === "1");

// --- F: Toplu isaretleme ---
console.log("\nF. Toplu isaretleme");
// 5A'nin tamamini Eksik yap: Ada'nin DONE'i da degismeli, 6B'ye dokunulmamali.
await grup5A.locator("form.toplu").getByRole("button", { name: "Eksik" }).click();
await sayfa.waitForFunction(() => {
  const bolum = [...document.querySelectorAll("section")].find((s) => s.innerText.includes("Odev-5A"));
  return bolum && bolum.querySelectorAll("button.secili.t-missing").length === 2;
}, null, { timeout: 10000 });
ok("5A'nin tamami Eksik", sql(`SELECT count(*) FROM "Submission" WHERE status='MISSING';`) === "2",
   `eksik=${sql(`SELECT count(*) FROM "Submission" WHERE status='MISSING';`)}`);
ok("6B'ye dokunulmadi",
   sql(`SELECT count(*) FROM "Submission" WHERE status='PENDING';`) === "1",
   `bekliyor=${sql(`SELECT count(*) FROM "Submission" WHERE status='PENDING';`)}`);

// --- G: Oran hesabi ---
console.log("\nG. Oran hesabi");
await sayfa.reload({ waitUntil: "networkidle" });
// 3 ogrenciden 0'i tamamladi -> %0
ok("Tamamlanma %0", (await govde()).includes("%0"), (await govde()).replace(/\s+/g, " ").slice(0, 200));
await grup6B.locator("li").filter({ hasText: "Mert" }).getByRole("button", { name: "Yapıldı" }).click();
await sayfa.waitForFunction(() => {
  const li = [...document.querySelectorAll("li")].find((e) => e.innerText.includes("Mert"));
  return li && li.querySelector("button.secili.t-done");
}, null, { timeout: 10000 });
await sayfa.reload({ waitUntil: "networkidle" });
// 3 ogrenciden 1'i tamamladi -> %33
ok("Tamamlanma %33", (await govde()).includes("%33"), (await govde()).replace(/\s+/g, " ").slice(0, 200));

// --- H: Suresi gecti rozeti ---
console.log("\nH. Suresi gecti rozeti");
await sayfa.goto(`${odevAdresi}/duzenle`, { waitUntil: "networkidle" });
await sayfa.getByLabel("Son teslim tarihi").fill(gun(-1));
await sayfa.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("tamamlanma"), null, { timeout: 15000 });

// Su an herkes isaretli. Kural: tarih gecse de bekleyen kimse yoksa odev
// gundemde degildir, rozet CIKMAZ.
ok("Herkes isaretliyken rozet YOK", !(await govde()).includes("Süresi geçti"),
   (await govde()).replace(/\s+/g, " ").slice(0, 160));
await sayfa.goto(`${T}/odevler?filtre=gecikmis`, { waitUntil: "networkidle" });
ok("Herkes isaretliyken gecikmis filtresinde YOK", !(await govde()).includes("Unit 4 workbook"));

// Bir ogrenciyi Bekliyor'a cevir: artik bekleyen var, rozet cikmali.
await sayfa.goto(odevAdresi, { waitUntil: "networkidle" });
await sayfa.locator("li").filter({ hasText: "Ada" })
  .getByRole("button", { name: "Bekliyor" }).click();
await sayfa.waitForFunction(() => {
  const li = [...document.querySelectorAll("li")].find((e) => e.innerText.includes("Ada"));
  return li && li.querySelector("button.secili.t-pending");
}, null, { timeout: 10000 });
await sayfa.reload({ waitUntil: "networkidle" });
ok("Bekleyen olunca rozet cikti", (await govde()).includes("Süresi geçti"));
ok("Gecikmis satir isaretli", (await sayfa.locator(".satir-gecikti").count()) === 1,
   String(await sayfa.locator(".satir-gecikti").count()));
ok("Durum KENDILIGINDEN degismedi",
   sql(`SELECT count(*) FROM "Submission" WHERE status='MISSING';`) === "1",
   `eksik=${sql(`SELECT count(*) FROM "Submission" WHERE status='MISSING';`)}`);

await sayfa.goto(`${T}/odevler?filtre=gecikmis`, { waitUntil: "networkidle" });
ok("Gecikmis filtresinde gorunuyor", (await govde()).includes("Unit 4 workbook"));

// --- I: Sinif sekmesinden gorunum ---
console.log("\nI. Sinif sekmesinden gorunum");
await sayfa.goto(sinifA, { waitUntil: "networkidle" });
await sayfa.getByRole("link", { name: /Ödevler/ }).click();
await sayfa.getByRole("heading", { name: /Odev-5A · Ödevler/ }).waitFor();
ok("Sinif odev listesinde", (await govde()).includes("Unit 4 workbook"));
// 5A'da iki ogrenci de MISSING -> %0. 6B'deki DONE buraya karismamali.
const sinifOran = await sayfa.locator("main .olcum").first().innerText();
ok("Sinif orani yalnizca kendi ogrencilerinden", sinifOran.includes("%0"), sinifOran);
ok("Ogrenci dokumu var", (await govde()).includes("Öğrenci dökümü"));

await sayfa.goto(sinifB, { waitUntil: "networkidle" });
await sayfa.getByRole("link", { name: /Ödevler/ }).click();
await sayfa.getByRole("heading", { name: /Odev-6B · Ödevler/ }).waitFor();
// 6B'de yalnizca Mert'e verildi ve o yapti -> %100
ok("6B orani %100", (await sayfa.locator("main .olcum").first().innerText()).includes("%100"),
   await sayfa.locator("main .olcum").first().innerText());
ok("Odev verilmeyen ogrenci dokumde bos", (await govde()).includes("Zeynep Dort"));

// --- J: Ogrenci sayfasi ---
console.log("\nJ. Ogrenci sayfasi");
await sayfa.goto(sinifB, { waitUntil: "networkidle" });
await sayfa.locator("li").filter({ hasText: "Mert" }).getByRole("link", { name: "Mert Uc" }).click();
await sayfa.getByRole("heading", { name: "Mert Uc" }).waitFor();
ok("Odev bolumu var", (await govde()).includes("Unit 4 workbook"));
ok("Ogrenci odev orani %100", (await govde()).includes("%100"));
ok("Durum Yapildi", (await sayfa.locator(".teslim-rozet.t-done").innerText()) === "Yapıldı");

// Odev verilmemis ogrencide olcum gorunmemeli.
await sayfa.goto(sinifB, { waitUntil: "networkidle" });
await sayfa.locator("li").filter({ hasText: "Zeynep" }).getByRole("link", { name: "Zeynep Dort" }).click();
await sayfa.getByRole("heading", { name: "Zeynep Dort" }).waitFor();
ok("Odevsiz ogrencide odev bolumu yok", !(await govde()).includes("Unit 4 workbook"));

// --- K: Sahiplik ---
console.log("\nK. Sahiplik");
let yanit = await sayfa.goto(`${T}/odevler/olmayan-odev`, { waitUntil: "networkidle" });
ok("Olmayan odev 404", yanit.status() === 404, `durum=${yanit.status()}`);
yanit = await sayfa.goto(`${T}/odevler/olmayan-odev/duzenle`, { waitUntil: "networkidle" });
ok("Olmayan odev duzenleme 404", yanit.status() === 404, `durum=${yanit.status()}`);

sql(`
INSERT INTO "Teacher" (id, email, name, "passwordHash", "createdAt", "behaviorTemplate")
VALUES ('t-yabanci', 'yabanci@ornek.com', 'Yabancı', '!parola-yok', now(), 'SIMPLE');
INSERT INTO "Classroom" (id, "teacherId", name, "isActive", "createdAt")
VALUES ('c-yabanci', 't-yabanci', 'Yabancı Sınıf', true, now());
INSERT INTO "Assignment" (id, "teacherId", title, "isActive", "createdAt", "updatedAt")
VALUES ('a-yabanci', 't-yabanci', 'Yabancı Ödev', true, now(), now());
`);
yanit = await sayfa.goto(`${T}/odevler/a-yabanci`, { waitUntil: "networkidle" });
ok("Baskasinin odevi 404", yanit.status() === 404, `durum=${yanit.status()}`);
yanit = await sayfa.goto(`${T}/odevler/a-yabanci/duzenle`, { waitUntil: "networkidle" });
ok("Baskasinin odev duzenlemesi 404", yanit.status() === 404, `durum=${yanit.status()}`);
yanit = await sayfa.goto(`${T}/sinif/c-yabanci/odevler`, { waitUntil: "networkidle" });
ok("Baskasinin sinif odevleri 404", yanit.status() === 404, `durum=${yanit.status()}`);

await sayfa.goto(`${T}/odevler`, { waitUntil: "networkidle" });
ok("Baskasinin odevi listede YOK", !(await govde()).includes("Yabancı Ödev"));

await tarayici.close();
console.log(`\n=== SONUC: ${gecti} gecti, ${kaldi} kaldi ===`);
process.exit(kaldi === 0 ? 0 : 1);
