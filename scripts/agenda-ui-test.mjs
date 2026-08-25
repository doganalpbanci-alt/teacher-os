// Günlük gündem testi: ana sayfadaki "Bugün kontrol edilecek" paneli ve
// üst menüdeki sayaç. Hangi ödevin gündeme düştüğü, hangisinin düşmediği.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. SESSION_SECRET tanımlı olacak şekilde: npm run build && npm start
//   3. npm install --no-save playwright
//   4. SQL_KOMUTU='psql "$DATABASE_URL" -q -tA' node scripts/agenda-ui-test.mjs
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

// innerText: textContent Next.js'in gomdugu RSC verisini de dondurur.
const govde = () => sayfa.innerText("body");
const panel = () => sayfa.locator("section.gundem");
const gun = (fark) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + fark);
  return d.toISOString().slice(0, 10);
};
const detayiBekle = () =>
  sayfa.waitForFunction(() => document.body.innerText.includes("tamamlanma"), null, { timeout: 15000 });

async function odevVer(baslik, bitis) {
  await sayfa.goto(`${T}/odevler/yeni`, { waitUntil: "networkidle" });
  await sayfa.getByLabel("Ödev başlığı").fill(baslik);
  if (bitis) await sayfa.getByLabel("Son teslim tarihi").fill(bitis);
  await sayfa.locator("fieldset").filter({ hasText: "Gundem-8A" })
    .locator("input[type=checkbox]").first().check();
  await sayfa.getByRole("button", { name: "Ödevi ver" }).click();
  await detayiBekle();
  return sayfa.url();
}

// --- A: Hazirlik ---
console.log("\nA. Hazirlik");
await sayfa.goto(T, { waitUntil: "networkidle" });
await sayfa.getByLabel("Sınıf adı").fill("Gundem-8A");
await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Gundem-8A"), null, { timeout: 10000 });
await sayfa.getByRole("link", { name: /Gundem-8A/ }).click();
await sayfa.getByRole("heading", { name: "Gundem-8A" }).waitFor();
for (const [a, b] of [["Ada", "Bir"], ["Efe", "Iki"]]) {
  await ogrenciFormunuAc(sayfa);
  await sayfa.getByLabel("Ad", { exact: true }).fill(a);
  await sayfa.getByLabel("Soyad").fill(b);
  await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
  await sayfa.waitForFunction((x) => document.body.innerText.includes(x), a, { timeout: 10000 });
}

// --- B: Odev yokken panel cikmaz ---
console.log("\nB. Odev yokken");
await sayfa.goto(T, { waitUntil: "networkidle" });
ok("Panel YOK", (await panel().count()) === 0);
ok("Sekme sayaci YOK", (await sayfa.locator(".sekme-sayac").count()) === 0);

// --- C: Gelecek tarihli odev gundeme DUSMEZ ---
console.log("\nC. Gelecek tarihli odev");
await odevVer("Gelecek odev", gun(5));
await sayfa.goto(T, { waitUntil: "networkidle" });
ok("Gelecek odev gundemde YOK", (await panel().count()) === 0,
   (await govde()).replace(/\s+/g, " ").slice(0, 150));
ok("Sayac hala YOK", (await sayfa.locator(".sekme-sayac").count()) === 0);

// --- D: Tarihsiz odev gundeme DUSMEZ ---
console.log("\nD. Tarihsiz odev");
await odevVer("Tarihsiz odev", null);
await sayfa.goto(T, { waitUntil: "networkidle" });
ok("Tarihsiz odev gundemde YOK", (await panel().count()) === 0);

// --- E: Bugun teslim olan odev gundeme DUSER ---
console.log("\nE. Bugun teslim");
await odevVer("Bugun teslim", gun(0));
await sayfa.goto(T, { waitUntil: "networkidle" });
ok("Panel cikti", (await panel().count()) === 1);
ok("Bugun teslim listede", (await panel().innerText()).includes("Bugun teslim"));
ok("Bugun etiketi dogru", (await panel().innerText()).includes("bugün son teslim"),
   await panel().innerText());
ok("Bekleyen sayisi dogru", (await panel().innerText()).includes("2 bekliyor"),
   await panel().innerText());
ok("Sekme sayaci 1", (await sayfa.locator(".sekme-sayac").innerText()) === "1");
ok("Gelecek odev panelde YOK", !(await panel().innerText()).includes("Gelecek odev"));
ok("Tarihsiz odev panelde YOK", !(await panel().innerText()).includes("Tarihsiz odev"));

// --- F: Suresi gecmis odev gundeme DUSER ve USTTE olur ---
console.log("\nF. Suresi gecmis");
const gecmisAdres = await odevVer("Gecmis odev", gun(-3));
await sayfa.goto(T, { waitUntil: "networkidle" });
const satirlar = await panel().locator(".liste li").allInnerTexts();
ok("Iki odev gundemde", satirlar.length === 2, String(satirlar.length));
ok("Gecikmis EN USTTE", satirlar[0].includes("Gecmis odev"), satirlar.join(" | "));
ok("Gecikmis etiketi dogru", satirlar[0].includes("süresi geçti"), satirlar[0]);
ok("Sekme sayaci 2", (await sayfa.locator(".sekme-sayac").innerText()) === "2");

// --- G: Panelden odeve gidilir ---
console.log("\nG. Panelden gecis");
await panel().locator(".liste li").first().locator("a").click();
await sayfa.getByRole("heading", { name: "Gecmis odev" }).waitFor();
ok("Odev detayina gidildi", sayfa.url().includes("/odevler/"));

// --- H: Hepsi isaretlenince gundemden DUSER ---
console.log("\nH. Isaretlenince duser");
await sayfa.goto(gecmisAdres, { waitUntil: "networkidle" });
await sayfa.locator("form.toplu").getByRole("button", { name: "Yapıldı" }).click();
await sayfa.waitForFunction(() => {
  const b = document.body.innerText;
  return b.includes("%100");
}, null, { timeout: 10000 });
await sayfa.goto(T, { waitUntil: "networkidle" });
const kalanSatirlar = await panel().locator(".liste li").allInnerTexts();
ok("Isaretlenen odev gundemden dustu", !kalanSatirlar.join(" ").includes("Gecmis odev"),
   kalanSatirlar.join(" | "));
ok("Digeri hala gundemde", kalanSatirlar.join(" ").includes("Bugun teslim"));
ok("Sekme sayaci 1'e dustu", (await sayfa.locator(".sekme-sayac").innerText()) === "1");

// --- I: Arsivlenince gundemden DUSER ---
console.log("\nI. Arsivlenince duser");
const bugunAdres = sql(`SELECT id FROM "Assignment" WHERE title='Bugun teslim';`);
await sayfa.goto(`${T}/odevler/${bugunAdres}`, { waitUntil: "networkidle" });
await sayfa.getByRole("button", { name: "Arşivle" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("Arşivden çıkar"), null, { timeout: 10000 });
await sayfa.goto(T, { waitUntil: "networkidle" });
ok("Arsivlenince panel tamamen kalkti", (await panel().count()) === 0);
ok("Sayac da kalkti", (await sayfa.locator(".sekme-sayac").count()) === 0);

// --- J: Sahiplik ---
console.log("\nJ. Sahiplik");
sql(`
INSERT INTO "Teacher" (id,email,name,"passwordHash","createdAt","behaviorTemplate")
VALUES ('t-gundem','gundem@ornek.com','Yabancı','!parola-yok',now(),'SIMPLE');
INSERT INTO "Classroom" (id,"teacherId",name,"isActive","createdAt")
VALUES ('c-gundem','t-gundem','Yabancı Sınıf',true,now());
INSERT INTO "Student" (id,"classroomId","firstName","lastName","performanceScore","isActive","createdAt")
VALUES ('s-gundem','c-gundem','Yabanci','Ogrenci',90,true,now());
INSERT INTO "Assignment" (id,"teacherId",title,"dueDate","isActive","createdAt","updatedAt")
VALUES ('a-gundem','t-gundem','Yabanci gecikmis odev', now() - interval '2 day', true, now(), now());
INSERT INTO "Submission" (id,"assignmentId","studentId",status,"updatedAt")
VALUES ('b-gundem','a-gundem','s-gundem','PENDING',now());
`);
await sayfa.goto(T, { waitUntil: "networkidle" });
ok("Baskasinin gecikmis odevi gundeme DUSMEDI", (await panel().count()) === 0,
   (await govde()).replace(/\s+/g, " ").slice(0, 200));
ok("Sayacta da yok", (await sayfa.locator(".sekme-sayac").count()) === 0);

await tarayici.close();
console.log(`\n=== SONUC: ${gecti} gecti, ${kaldi} kaldi ===`);
process.exit(kaldi === 0 ? 0 : 1);
