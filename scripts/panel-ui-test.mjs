// Genel panel testi: dört bloğun da gerçek veriyle doğru sayıyı gösterdiği,
// "dikkat gereken öğrenci" kriterlerinin ayrı ayrı tetiklendiği, 30 günlük
// pencerenin dışındaki kaydın sayılmadığı ve başka öğretmenin verisinin
// panele hiç sızmadığı sınanır.
//
// Sınıf/öğrenci/davranış kaydı arayüzden üretilir (öğretmenin yaptığı iş bu).
// Ödev, sınav ve eski tarihli kayıtlar SQL ile yazılır: panel bunları yalnızca
// OKUR, üretim akışları kendi testlerinde (assignment/exam) zaten kapsanıyor
// ve arayüzden kurmak testi dakikalarca uzatır.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. npm run build && npm start
//   3. npm install --no-save playwright
//   4. SQL_KOMUTU='psql "$DATABASE_URL" -q -tA' node scripts/panel-ui-test.mjs
import { execSync } from "node:child_process";
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
const ogrenciId = (ad) => sql(`SELECT id FROM "Student" WHERE "firstName"='${ad}';`);
const ogretmenId = () => sql(`SELECT id FROM "Teacher" ORDER BY "createdAt" ASC LIMIT 1;`);

const tarayici = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
const sayfa = await tarayici.newPage();
await oturumHazirla(sayfa, T);

function satir(ad) { return sayfa.locator("li").filter({ hasText: ad }); }
async function govde() { return sayfa.innerText("body"); }
async function bekle(metin) {
  await sayfa.waitForFunction((m) => document.body.innerText.includes(m), metin, { timeout: 10000 });
}
async function panele(bekleyen = "Panel") {
  await sayfa.goto(`${T}/panel`, { waitUntil: "networkidle" });
  await bekle(bekleyen);
}
/** Sınıf karşılaştırma tablosunun bir satırı, hücreleri boşlukla ayrılmış. */
async function tabloSatiri(sinifAdi) {
  const tr = sayfa.locator(".panel-tablo tbody tr").filter({ hasText: sinifAdi });
  if ((await tr.count()) === 0) return null;
  return (await tr.first().evaluate((el) =>
    [...el.querySelectorAll("th,td")].map((h) => h.innerText.trim()).join("|")
  ));
}
/** Dikkat listesindeki bir öğrencinin sebep rozetleri. */
async function sebepler(ad) {
  const li = sayfa.locator(".kart").filter({ hasText: "Dikkat gereken" }).locator("li").filter({ hasText: ad });
  if ((await li.count()) === 0) return null;
  return await li.first().locator(".sebep-rozet").allInnerTexts();
}

async function davranisVer(ad, dugme, kez = 1) {
  for (let i = 0; i < kez; i++) {
    const onceki = await satir(ad).evaluate((el) => el.innerText);
    await satir(ad).getByRole("button", { name: dugme }).click();
    await sayfa.waitForFunction(
      ([isim, eski]) => {
        const li = [...document.querySelectorAll("li")].find((e) => e.innerText.includes(isim));
        return li && li.innerText !== eski;
      }, [ad, onceki], { timeout: 10000 });
    await sayfa.waitForTimeout(250);
  }
}

// --- A. Bos panel ---
console.log("\nA. Bos panel");
await panele();
ok("Menude Panel sekmesi var", (await sayfa.getByRole("link", { name: "Panel" }).count()) > 0);
ok("Panel basligi", await sayfa.getByRole("heading", { name: "Panel", level: 1 }).isVisible());
{
  const g = await govde();
  ok("Bos panelde dikkat listesi bos mesaji", g.includes("dikkat isteyen öğrenci yok"), g.slice(0, 200));
  ok("Sinif yokken karsilastirma tablosu hic cikmaz", (await sayfa.locator(".panel-tablo").count()) === 0);
  ok("Bos panelde bekleyen isler blogu hic cikmaz", !g.includes("Bekleyen işler"));
  ok("Ozet blogu her zaman var", g.includes("Son 30 gün"));
}

// --- B. Sinif ve davranis ---
console.log("\nB. Sinif ve davranis");
await sayfa.goto(T, { waitUntil: "networkidle" });
await sayfa.getByLabel("Sınıf adı").fill("Panel-5A");
await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
await bekle("Panel-5A");
await sayfa.getByRole("link", { name: /Panel-5A/ }).click();
await sayfa.getByRole("heading", { name: "Panel-5A" }).waitFor();
for (const [a, b] of [["Ali", "Bir"], ["Veli", "Iki"], ["Cem", "Uc"]]) {
  await ogrenciFormunuAc(sayfa);
  await sayfa.getByLabel("Ad", { exact: true }).fill(a);
  await sayfa.getByLabel("Soyad").fill(b);
  await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
  await bekle(a);
}
await dersBaslat(sayfa, ". ders");

// Basit sablon (varsayilan): Ali'nin eksisi artisindan fazla -> davranis sebebi.
await davranisVer("Ali", "Artı ver", 1);
await davranisVer("Ali", "Eksi ver", 3);
await davranisVer("Veli", "Artı ver", 2);

await panele();
{
  const s = await tabloSatiri("Panel-5A");
  // Sutunlar: Sinif | Ogrenci | Ders | Arti | Eksi | Odev | Sinav
  ok("Sinif satiri tabloda", s !== null, String(s));
  ok("Ogrenci sayisi 3", s?.split("|")[1] === "3", String(s));
  ok("Ders sayisi 1", s?.split("|")[2] === "1", String(s));
  ok("Arti 3", s?.split("|")[3] === "3", String(s));
  ok("Eksi 3", s?.split("|")[4] === "3", String(s));
  ok("Odev verisi yokken tire", s?.split("|")[5] === "—", String(s));
  ok("Sinav verisi yokken tire", s?.split("|")[6] === "—", String(s));

  const g = await govde();
  ok("Basit sablonda 'Artı' sutunu, 'Yıldız' degil", g.includes("Artı") && !g.includes("Yıldız"));
  ok("Basit sablonda kart sutunu yok", !g.includes("sarı kart"));
}
ok("Ali davranis sebebiyle listede", (await sebepler("Ali"))?.join() === "davranış", JSON.stringify(await sebepler("Ali")));
ok("Veli (artisi fazla) listede degil", (await sebepler("Veli")) === null);
ok("Cem (hic kaydi yok) listede degil", (await sebepler("Cem")) === null);

// --- C. Odev kriteri ---
console.log("\nC. Odev kriteri");
{
  const ogr = ogretmenId();
  const cem = ogrenciId("Cem");
  // Iki adet suresi gecmis, hala PENDING odev: esik tam 2.
  sql(`
    INSERT INTO "Assignment" (id,"teacherId",title,"dueDate","isActive","createdAt","updatedAt")
    VALUES ('odev-p1','${ogr}','Gecmis odev 1',now()-interval '3 days',true,now()-interval '5 days',now()),
           ('odev-p2','${ogr}','Gecmis odev 2',now()-interval '2 days',true,now()-interval '5 days',now());
    INSERT INTO "Submission" (id,"assignmentId","studentId",status,"updatedAt")
    VALUES ('tes-p1','odev-p1','${cem}','PENDING',now()),
           ('tes-p2','odev-p2','${cem}','PENDING',now());
  `);
}
await panele();
ok("Cem iki gecikmis odevle listede", (await sebepler("Cem"))?.join() === "2 ödev", JSON.stringify(await sebepler("Cem")));
{
  const g = await govde();
  ok("Bekleyen isler blogu cikti", g.includes("Bekleyen işler"));
  ok("Kontrol bekleyen odev sayisi 2", g.includes("Kontrol bekleyen ödev"));
}
// Biri tamamlanirsa esigin altina duser ve listeden cikar.
sql(`UPDATE "Submission" SET status='DONE' WHERE id='tes-p1';`);
await panele();
ok("Tek gecikmis odev esigi gecmez, Cem listeden cikti", (await sebepler("Cem")) === null);
sql(`UPDATE "Submission" SET status='PENDING' WHERE id='tes-p1';`);

// --- D. Sinav kriteri ---
console.log("\nD. Sinav kriteri");
{
  const ogr = ogretmenId();
  sql(`
    INSERT INTO "Exam" (id,"teacherId",title,"examDate","maxScore",scope,"createdAt")
    VALUES ('sinav-p1','${ogr}','Panel sinavi',now()-interval '2 days',100,'OFFICIAL',now());
    INSERT INTO "ExamResult" (id,"examId","studentId",score,"isAbsent","createdAt")
    VALUES ('son-p1','sinav-p1','${ogrenciId("Veli")}',30,false,now()),
           ('son-p2','sinav-p1','${ogrenciId("Ali")}',90,false,now());
  `);
}
await panele();
ok("Veli dusuk sinav ortalamasiyla listede", (await sebepler("Veli"))?.join() === "%30", JSON.stringify(await sebepler("Veli")));
ok("Ali'ye sinav sebebi EKLENMEDI (%90)", (await sebepler("Ali"))?.join() === "davranış", JSON.stringify(await sebepler("Ali")));
{
  const s = await tabloSatiri("Panel-5A");
  ok("Tabloda sinif sinav ortalamasi %60", s?.split("|")[6] === "%60", String(s));
  ok("Tabloda odev orani %0 (iki teslim de bekliyor)", s?.split("|")[5] === "%0", String(s));
}

// --- E. 30 gunluk pencere ---
console.log("\nE. 30 gunluk pencere");
{
  const ogr = ogretmenId();
  const sinif = sql(`SELECT id FROM "Classroom" WHERE name='Panel-5A';`);
  // 40 gun oncesine bir ders ve Veli'ye 5 eksi: pencerenin DISINDA kalmali.
  sql(`
    INSERT INTO "Lesson" (id,"classroomId",date,"endedAt","createdAt")
    VALUES ('ders-eski','${sinif}',now()-interval '40 days',now()-interval '40 days',now()-interval '40 days');
    INSERT INTO "BehaviorLog" (id,"studentId","teacherId","classroomId","lessonId",type,points,"createdAt")
    SELECT 'log-eski-'||g, '${ogrenciId("Veli")}','${ogr}','${sinif}','ders-eski','MINUS',0,now()-interval '40 days'
    FROM generate_series(1,5) g;
  `);
}
await panele();
{
  const s = await tabloSatiri("Panel-5A");
  ok("Pencere disindaki ders sayilmadi (hala 1)", s?.split("|")[2] === "1", String(s));
  ok("Pencere disindaki eksiler sayilmadi (hala 3)", s?.split("|")[4] === "3", String(s));
  ok("Eski eksiler Veli'ye davranis sebebi EKLEMEDI",
     (await sebepler("Veli"))?.join() === "%30", JSON.stringify(await sebepler("Veli")));
  ok("Ozette eksi hala 3", (await govde()).includes("3\neksi"), "ozet");
}

// --- F. Baska ogretmenin verisi sizmaz ---
console.log("\nF. Ogretmen ayrimi");
{
  sql(`
    INSERT INTO "Teacher" (id,email,name,"passwordHash","createdAt","behaviorTemplate")
    VALUES ('ogr-baska','baska@ornek.com','Baska Ogretmen','x',now(),'SIMPLE');
    INSERT INTO "Classroom" (id,"teacherId",name,"isActive","createdAt")
    VALUES ('sinif-baska','ogr-baska','Baska-9Z',true,now());
    INSERT INTO "Student" (id,"classroomId","firstName","lastName","performanceScore","isActive","createdAt")
    VALUES ('ogrenci-baska','sinif-baska','Zeynep','Baska',80,true,now());
    INSERT INTO "Lesson" (id,"classroomId",date,"createdAt")
    VALUES ('ders-baska','sinif-baska',now(),now());
    INSERT INTO "BehaviorLog" (id,"studentId","teacherId","classroomId","lessonId",type,points,"createdAt")
    SELECT 'log-baska-'||g,'ogrenci-baska','ogr-baska','sinif-baska','ders-baska','MINUS',0,now()
    FROM generate_series(1,9) g;
  `);
}
await panele();
{
  const g = await govde();
  ok("Baska ogretmenin sinifi tabloda yok", !g.includes("Baska-9Z"));
  ok("Baska ogretmenin ogrencisi dikkat listesinde yok", !g.includes("Zeynep"));
  const s = await tabloSatiri("Panel-5A");
  ok("Kendi sinifinin sayilari degismedi", s?.split("|")[4] === "3", String(s));
  ok("Ozette eksi hala 3 (baskasinin 9 eksisi karismadi)", g.includes("3\neksi"));
}

// --- G. Kart sablonuna gecis ---
console.log("\nG. Kart sablonu");
await sayfa.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
await sayfa.getByRole("radio", { name: /Kart sistemi/ }).check();
await sayfa.locator(".sablon-formu").getByRole("button", { name: "Kaydet" }).click();
await sayfa.waitForSelector(".basari", { timeout: 10000 });
await panele();
{
  const g = await govde();
  ok("Kart sablonunda 'Yıldız' sutunu", g.includes("Yıldız"));
  ok("Kart sablonunda kart sutunu aciklamasi", g.includes("Kart sütunu sarı/kırmızı"));
  ok("Kart sablonunda ozette sari/kirmizi kart", g.includes("sarı kart") && g.includes("kırmızı kart"));
  const s = await tabloSatiri("Panel-5A");
  // Sutunlar: Sinif | Ogrenci | Ders | Yildiz | Kart | Odev | Sinav | Not
  ok("Kart sutunu sari/kirmizi bicimi", s?.split("|")[4] === "0/0", String(s));
  ok("Not sutunu eklendi", s?.split("|").length === 8, String(s));
  // Uc ogrenci de varsayilan 80 puanda; kayitlar Basit sablonda yazildigi
  // icin puani degistirmedi.
  ok("Ortalama performans notu 80", s?.split("|")[7] === "80", String(s));
}

console.log(`\n${gecti} gecti, ${kaldi} kaldi`);
await tarayici.close();
process.exit(kaldi === 0 ? 0 : 1);
