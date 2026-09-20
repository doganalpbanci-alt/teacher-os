// Öğrenci raporu: yazdırmaya hazır tek sayfalık döküm, dönem seçilebilir.
//
// Testin can alıcı noktaları:
//   - YAZDIRMA gerçekten ölçülür: `emulateMedia({ media: "print" })` ile
//     tarayıcı yazdırma kipine alınır ve menü/düğme/seçicinin kaybolduğu,
//     içeriğin kaldığı doğrulanır. CSS'e bakarak "herhalde gizlenir" demek
//     yeterli değil.
//   - Dönem seçimi raporu gerçekten değiştirir: 1. dönemin sınavı 2. dönem
//     raporunda görünmemeli.
//   - Gelişim bloğu SEÇİLEN dönemi anlatır, "son iki dönemi" değil.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. npm run build && npm start
//   3. npm install --no-save playwright
//   4. SQL_KOMUTU='psql "$DATABASE_URL" -q -tA' node scripts/report-ui-test.mjs
import { execSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { chromium } from "playwright";
import { oturumHazirla } from "./test-oturum.mjs";
import { ogrenciFormunuAc } from "./test-form.mjs";

const T = process.env.TEMEL_ADRES ?? "http://127.0.0.1:3000";
let gecti = 0, kaldi = 0;
function ok(ad, kosul, ayrinti = "") {
  if (kosul) { gecti++; console.log(`  GECTI  ${ad}`); }
  else { kaldi++; console.log(`  KALDI  ${ad}${ayrinti ? "  -> " + ayrinti : ""}`); }
}

const SQL_KOMUTU = process.env.SQL_KOMUTU ?? 'psql "$DATABASE_URL" -q -tA';
const sql = (m) => execSync(SQL_KOMUTU, { input: m, shell: "/bin/bash" }).toString().trim();

const D1 = "2025-11-15";  // 2025-2026 · 1. donem
const D2 = "2026-04-15";  // 2025-2026 · 2. donem

const tarayici = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
const baglam = await tarayici.newContext({ viewport: { width: 1024, height: 900 } });
const sayfa = await baglam.newPage();
await oturumHazirla(sayfa, T);

async function bekle(metin) {
  await sayfa.waitForFunction((m) => document.body.innerText.includes(m), metin, { timeout: 10000 });
}
async function govde() { return sayfa.innerText("body"); }

// --- Kurulum ---
console.log("\nKurulum");
await sayfa.goto(T, { waitUntil: "networkidle" });
await sayfa.getByLabel("Sınıf adı").fill("Rapor-5A");
await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
await bekle("Rapor-5A");
await sayfa.getByRole("link", { name: /Rapor-5A/ }).click();
await sayfa.waitForURL(/\/sinif\//, { timeout: 10000 });
const SINIF_URL = sayfa.url();
const SINIF_ID = new URL(SINIF_URL).pathname.split("/").pop();
for (const [a, b] of [["Deren", "Bir"], ["Bos", "Kayit"]]) {
  await ogrenciFormunuAc(sayfa);
  await sayfa.getByLabel("Ad", { exact: true }).fill(a);
  await sayfa.getByLabel("Soyad").fill(b);
  await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
  await bekle(a);
}
const DEREN = sql(`SELECT id FROM "Student" WHERE "firstName"='Deren';`);
const BOS = sql(`SELECT id FROM "Student" WHERE "firstName"='Bos';`);
const OGRETMEN = sql(`SELECT id FROM "Teacher" ORDER BY "createdAt" ASC LIMIT 1;`);

// Iki donem veri: 1. donemde 10 ders, 2. donemde 10 ders.
sql(`
  INSERT INTO "Lesson" (id,"classroomId",date,"endedAt","createdAt")
  SELECT 'rd1-'||g,'${SINIF_ID}','${D1}'::timestamp + (g||' days')::interval,
         '${D1}'::timestamp + (g||' days')::interval, now() FROM generate_series(1,10) g;
  INSERT INTO "Lesson" (id,"classroomId",date,"endedAt","createdAt")
  SELECT 'rd2-'||g,'${SINIF_ID}','${D2}'::timestamp + (g||' days')::interval,
         '${D2}'::timestamp + (g||' days')::interval, now() FROM generate_series(1,10) g;

  INSERT INTO "BehaviorLog" (id,"studentId","teacherId","classroomId","lessonId",type,points,"createdAt")
  SELECT 'rp1-'||g,'${DEREN}','${OGRETMEN}','${SINIF_ID}','rd1-1','PLUS',1,'${D1}'::timestamp
  FROM generate_series(1,4) g;
  INSERT INTO "BehaviorLog" (id,"studentId","teacherId","classroomId","lessonId",type,points,"createdAt")
  SELECT 'rp2-'||g,'${DEREN}','${OGRETMEN}','${SINIF_ID}','rd2-1','PLUS',1,'${D2}'::timestamp
  FROM generate_series(1,9) g;
  INSERT INTO "BehaviorLog" (id,"studentId","teacherId","classroomId","lessonId",type,points,"createdAt")
  SELECT 'rm1-'||g,'${DEREN}','${OGRETMEN}','${SINIF_ID}','rd1-1','MINUS',-5,'${D1}'::timestamp
  FROM generate_series(1,6) g;

  INSERT INTO "Exam" (id,"teacherId",title,"examDate","maxScore",scope,"createdAt")
  VALUES ('rs1','${OGRETMEN}','Birinci donem yazilisi','${D1}',100,'OFFICIAL',now()),
         ('rs2','${OGRETMEN}','Ikinci donem yazilisi','${D2}',100,'OFFICIAL',now());
  INSERT INTO "ExamResult" (id,"examId","studentId",score,"isAbsent","createdAt")
  VALUES ('rr1','rs1','${DEREN}',55,false,now()),
         ('rr2','rs2','${DEREN}',85,false,now());

  INSERT INTO "Assignment" (id,"teacherId",title,"dueDate","isActive","createdAt","updatedAt")
  VALUES ('ro1','${OGRETMEN}','Birinci donem odevi','${D1}'::timestamp,true,now(),now()),
         ('ro2','${OGRETMEN}','Ikinci donem odevi','${D2}'::timestamp,true,now(),now());
  INSERT INTO "Submission" (id,"assignmentId","studentId",status,"updatedAt")
  VALUES ('rt1','ro1','${DEREN}','MISSING',now()),
         ('rt2','ro2','${DEREN}','DONE',now());
`);
// Kurulum SQL'i sessizce dusmus olmasin (psql hatada da 0 doner).
ok("Kurulum: 20 ders", sql(`SELECT count(*) FROM "Lesson" WHERE "classroomId"='${SINIF_ID}';`) === "20");
ok("Kurulum: 19 davranis kaydi", sql(`SELECT count(*) FROM "BehaviorLog" WHERE "studentId"='${DEREN}';`) === "19");
ok("Kurulum: 2 teslim", sql(`SELECT count(*) FROM "Submission" WHERE "studentId"='${DEREN}';`) === "2");

// --- A. Ogrenci sayfasindan rapora gidis ---
console.log("\nA. Rapora gidis");
await sayfa.goto(`${T}/ogrenci/${DEREN}`, { waitUntil: "networkidle" });
ok("Ogrenci sayfasinda Rapor baglantisi var", (await sayfa.getByRole("link", { name: /^Rapor/ }).count()) === 1);
await sayfa.getByRole("link", { name: /^Rapor/ }).click();
await sayfa.waitForURL(/\/rapor$/, { timeout: 10000 });
ok("Rapor sayfasi acildi", /\/ogrenci\/[^/]+\/rapor$/.test(sayfa.url()), sayfa.url());

// --- B. Varsayilan: verisi olan EN YENI donem ---
console.log("\nB. Varsayilan donem");
{
  const g = await govde();
  ok("Ogrenci adi basta", g.includes("Deren Bir"));
  ok("Sinif adi yaziyor", g.includes("Rapor-5A"));
  ok("En yeni donem secili (2. donem)", g.includes("2025-2026 · 2. dönem"), g.slice(0, 160));
  ok("Ikinci donem sinavi listede", g.includes("Ikinci donem yazilisi"));
  ok("Birinci donem sinavi listede DEGIL", !g.includes("Birinci donem yazilisi"));
  ok("Ikinci donem odevi listede", g.includes("Ikinci donem odevi"));
  ok("Birinci donem odevi listede DEGIL", !g.includes("Birinci donem odevi"));
  ok("Dort bolum de var",
     g.includes("Davranış") && g.includes("Sınavlar") && g.includes("Ödevler") && g.includes("Gelişim"));
  ok("Ogretmen adi altta", g.includes("Test Öğretmeni"));
}
{
  // 2. donemde 9 arti / 10 ders, karne %85, odev %100
  const g = await govde();
  ok("2. donem arti sayisi 9", /9\s*\n?\s*artı/.test(g), "davranis olcumu");
  ok("2. donem karne %85", g.includes("%85"));
  ok("2. donem odev tamamlanma %100", g.includes("%100"));
}

// --- C0. Yazdir dugmesi ---
// Sayfanin yazdirilabilir olmasi yetmiyordu: tarayicilarin yazdir secenegi
// menulerin icinde gomulu ve ogretmen onu bulamiyordu. Dugme GERCEKTEN
// window.print() cagiriyor mu, sayac ile olculur -- "dugme var" demek yeterli
// bir kontrol degil.
console.log("\nC0. Yazdir dugmesi");
{
  await sayfa.evaluate(() => {
    window.__yazdirmaSayaci = 0;
    window.print = () => { window.__yazdirmaSayaci += 1; };
  });
  const dugme = sayfa.getByRole("button", { name: /Yazdır/ });
  ok("Yazdir dugmesi var", (await dugme.count()) === 1);
  await dugme.click();
  ok(
    "Dugme yazdirmayi tetikledi",
    (await sayfa.evaluate(() => window.__yazdirmaSayaci ?? 0)) === 1,
    "window.print cagrilmali",
  );
}

// --- C. YAZDIRMA kipi gercekten olculuyor ---
console.log("\nC. Yazdirma kipi");
{
  const menuGorunur = () => sayfa.locator(".ust-menu").isVisible().catch(() => false);
  const geriGorunur = () => sayfa.locator(".rapor-araclar").isVisible().catch(() => false);
  const baslikGorunur = () => sayfa.getByRole("heading", { name: "Deren Bir" }).isVisible();

  ok("Ekranda arac cubugu gorunur", await geriGorunur());

  await sayfa.emulateMedia({ media: "print" });
  ok("Yazdirmada arac cubugu GIZLI", !(await geriGorunur()), "yazdirma-gizle uygulanmali");
  ok("Yazdirmada ust menu GIZLI", !(await menuGorunur()));
  ok(
    "Yazdirmada yazdir dugmesi de GIZLI",
    !(await sayfa.getByRole("button", { name: /Yazdır/ }).isVisible().catch(() => false)),
    "kagida dusen belgede dugme olmaz",
  );
  ok("Yazdirmada ogrenci adi DURUYOR", await baslikGorunur(), "icerik kaybolmamali");
  {
    const g = await govde();
    ok("Yazdirmada sinav tablosu duruyor", g.includes("Ikinci donem yazilisi"));
    ok("Yazdirmada ogretmen adi duruyor", g.includes("Test Öğretmeni"));
  }
  await sayfa.emulateMedia({ media: "screen" });
  ok("Ekran kipine donuldu", await geriGorunur());
}

// --- D. Donem secimi raporu degistirir ---
console.log("\nD. Donem secimi");
{
  ok("Donem secici var", (await sayfa.locator(".rapor-donem-secici select").count()) === 1);
  await sayfa.selectOption(".rapor-donem-secici select", "2025-1");
  await sayfa.waitForFunction(
    () => document.body.innerText.includes("Birinci donem yazilisi"),
    null,
    { timeout: 10000 },
  ).catch(() => {});

  const g = await govde();
  ok("Adres donemi tasiyor", sayfa.url().includes("donem=2025-1"), sayfa.url());
  ok("1. donem secili gorunuyor", g.includes("2025-2026 · 1. dönem"));
  ok("Birinci donem sinavi geldi", g.includes("Birinci donem yazilisi"));
  ok("Ikinci donem sinavi gitti", !g.includes("Ikinci donem yazilisi"));
  ok("1. donem karne %55", g.includes("%55"));
  ok("1. donem odevi yapilmadi olarak gorunuyor", g.includes("Yapılmadı"));
}

// --- E. Gelisim SECILEN donemi anlatir ---
console.log("\nE. Gelisim secilen doneme baglidir");
{
  // 1. donem en eski donem: oncesi yok, o yuzden ok uydurulmamali.
  const g = await govde();
  ok("1. donem raporunda gelisim uyarisi",
     g.includes("en az iki dönem gerekir"),
     "ilk donem kendisiyle kiyaslanamaz");
  ok("1. donem raporunda ok YOK", (await sayfa.locator(".gelisim-ok").count()) === 0);
}
await sayfa.goto(`${T}/ogrenci/${DEREN}/rapor?donem=2025-2`, { waitUntil: "networkidle" });
{
  const g = await govde();
  ok("2. donem raporunda karsilastirma var", g.includes("2025-2026 · 1. dönem →"), "gelisim basligi");
  ok("2. donem raporunda ok var", (await sayfa.locator(".gelisim-ok").count()) > 0);
  // Arti: 4/10 = 0.4 -> 9/10 = 0.9 yukseldi
  ok("Arti yukselisi gorunuyor", g.includes("0.4 → 0.9"), "gelisim degerleri");
}

// --- F. Bozuk donem parametresi ---
console.log("\nF. Bozuk parametre");
await sayfa.goto(`${T}/ogrenci/${DEREN}/rapor?donem=abc`, { waitUntil: "networkidle" });
{
  const g = await govde();
  ok("Bozuk donem hataya dusmez", g.includes("Deren Bir"));
  ok("En yeni doneme dusuldu", g.includes("2025-2026 · 2. dönem"), "sessizce en yeniye dusmeli");
}
await sayfa.goto(`${T}/ogrenci/${DEREN}/rapor?donem=1999-1`, { waitUntil: "networkidle" });
ok("Olmayan donem de en yeniye duser", (await govde()).includes("2025-2026 · 2. dönem"));

// --- G. Hic kaydi olmayan ogrencide rapor YOK ---
console.log("\nG. Kayitsiz ogrenci");
{
  const yanit = await sayfa.goto(`${T}/ogrenci/${BOS}/rapor`, { waitUntil: "networkidle" });
  ok("Kayitsiz ogrencinin raporu 404", yanit?.status() === 404, String(yanit?.status()));
}

// --- H. Baska ogretmenin ogrencisi ---
console.log("\nH. Ogretmen ayrimi");
{
  const hash = bcrypt.hashSync("ikinci-parola-123", 12);
  sql(`
    INSERT INTO "Teacher" (id,email,name,"passwordHash","createdAt")
    VALUES ('t-rapor','ikinci-rapor@ornek.com','Ikinci Ogretmen','${hash}',now());
  `);
  const ikinciB = await tarayici.newContext();
  const ikinci = await ikinciB.newPage();
  await ikinci.goto(`${T}/giris`, { waitUntil: "networkidle" });
  await ikinci.getByLabel("E-posta").fill("ikinci-rapor@ornek.com");
  await ikinci.getByLabel("Parola").fill("ikinci-parola-123");
  await ikinci.getByRole("button", { name: "Giriş yap" }).click();
  await ikinci.waitForURL(`${T}/`, { timeout: 20000 });

  const yanit = await ikinci.goto(`${T}/ogrenci/${DEREN}/rapor`, { waitUntil: "networkidle" });
  ok("Baskasinin ogrencisinin raporu 404", yanit?.status() === 404, String(yanit?.status()));
  ok("Ogrenci adi sizmadi", !(await ikinci.innerText("body")).includes("Deren"));
  await ikinciB.close();
}

console.log(`\n${gecti} gecti, ${kaldi} kaldi`);
await tarayici.close();
process.exit(kaldi === 0 ? 0 : 1);
