// Öğrenci gelişim görünümü: son iki dönem karşılaştırılır, her ölçü için
// sayı ve yön oku çıkar.
//
// Testin can alıcı noktaları:
//   - Ders başına normalleştirme: ham sayı ARTARKEN ders sayısı daha çok
//     arttıysa yoğunluk düşer ve ok aşağı bakmalı.
//   - Eksi/kart azalınca ok aşağı bakar ama İYİLEŞME sayılır (yeşil).
//   - Tek dönemi olan öğrenciye ok uydurulmaz.
//
// İki dönemlik veri kurmak için tarihler SQL ile geçmişe yazılır; arayüzden
// bir öğretim yılı boyunca veri üretmek mümkün değil.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. npm run build && npm start
//   3. npm install --no-save playwright
//   4. SQL_KOMUTU='psql "$DATABASE_URL" -q -tA' node scripts/progress-ui-test.mjs
import { execSync } from "node:child_process";
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

// Iki donem: 2025-2026 ogretim yilinin 1. ve 2. donemi.
// donemBul: Eylul-Ocak -> 1. donem, Subat-Haziran -> 2. donem.
const D1 = "2025-11-15";  // 1. donem
const D2 = "2026-04-15";  // 2. donem

const tarayici = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
const sayfa = await (await tarayici.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await oturumHazirla(sayfa, T);

async function bekle(metin) {
  await sayfa.waitForFunction((m) => document.body.innerText.includes(m), metin, { timeout: 10000 });
}
/** Gelişim bloğundaki bir ölçü satırının tüm metni. */
async function olcuSatiri(etiket) {
  const li = sayfa.locator(".gelisim-satir").filter({ hasText: etiket });
  if ((await li.count()) === 0) return null;
  return (await li.first().innerText()).replace(/\s+/g, " ").trim();
}
async function okSinifi(etiket) {
  const li = sayfa.locator(".gelisim-satir").filter({ hasText: etiket });
  if ((await li.count()) === 0) return null;
  return await li.first().locator(".gelisim-ok").getAttribute("class");
}
async function ogrenciyeGit(ad) {
  await sayfa.goto(SINIF_URL, { waitUntil: "networkidle" });
  await sayfa.getByRole("link", { name: new RegExp(ad) }).first().click();
  await sayfa.waitForURL(/\/ogrenci\//, { timeout: 10000 });
}

// --- Kurulum ---
console.log("\nKurulum");
await sayfa.goto(T, { waitUntil: "networkidle" });
await sayfa.getByLabel("Sınıf adı").fill("Gelisim-5A");
await sayfa.getByRole("button", { name: "Sınıf ekle" }).click();
await bekle("Gelisim-5A");
await sayfa.getByRole("link", { name: /Gelisim-5A/ }).click();
await sayfa.waitForURL(/\/sinif\//, { timeout: 10000 });
const SINIF_URL = sayfa.url();
const SINIF_ID = new URL(SINIF_URL).pathname.split("/").pop();
for (const [a, b] of [["Deren", "Bir"], ["Kerem", "Iki"], ["Tek", "Donem"]]) {
  await ogrenciFormunuAc(sayfa);
  await sayfa.getByLabel("Ad", { exact: true }).fill(a);
  await sayfa.getByLabel("Soyad").fill(b);
  await sayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
  await bekle(a);
}
const ogrenciId = (ad) => sql(`SELECT id FROM "Student" WHERE "firstName"='${ad}';`);
const ogretmenId = sql(`SELECT id FROM "Teacher" ORDER BY "createdAt" ASC LIMIT 1;`);
const DEREN = ogrenciId("Deren");
const TEK = ogrenciId("Tek");

// --- Veri: iki donem ---
console.log("\nVeri kurulumu (iki donem)");
// 1. donemde 10 ders, 2. donemde 20 ders.
sql(`
  INSERT INTO "Lesson" (id,"classroomId",date,"endedAt","createdAt")
  SELECT 'd1-'||g,'${SINIF_ID}','${D1}'::timestamp + (g||' days')::interval,
         '${D1}'::timestamp + (g||' days')::interval, now()
  FROM generate_series(1,10) g;
  INSERT INTO "Lesson" (id,"classroomId",date,"endedAt","createdAt")
  SELECT 'd2-'||g,'${SINIF_ID}','${D2}'::timestamp + (g||' days')::interval,
         '${D2}'::timestamp + (g||' days')::interval, now()
  FROM generate_series(1,20) g;
`);

// Deren -- ARTI: 1. donem 10 arti/10 ders = 1.0 ; 2. donem 12 arti/20 ders = 0.6
// Ham sayi ARTMIS ama yogunluk DUSMUS. Ders basina normallestirme olmasaydi
// bu satir yanlislikla "yukseldi" gorunurdu.
sql(`
  INSERT INTO "BehaviorLog" (id,"studentId","teacherId","classroomId","lessonId",type,points,"createdAt")
  SELECT 'p1-'||g,'${DEREN}','${ogretmenId}','${SINIF_ID}','d1-1','PLUS',1,'${D1}'::timestamp
  FROM generate_series(1,10) g;
  INSERT INTO "BehaviorLog" (id,"studentId","teacherId","classroomId","lessonId",type,points,"createdAt")
  SELECT 'p2-'||g,'${DEREN}','${ogretmenId}','${SINIF_ID}','d2-1','PLUS',1,'${D2}'::timestamp
  FROM generate_series(1,12) g;
`);
// Deren -- EKSI: 1. donem 8/10 = 0.8 ; 2. donem 2/20 = 0.1  -> IYILESME
sql(`
  INSERT INTO "BehaviorLog" (id,"studentId","teacherId","classroomId","lessonId",type,points,"createdAt")
  SELECT 'm1-'||g,'${DEREN}','${ogretmenId}','${SINIF_ID}','d1-1','MINUS',-5,'${D1}'::timestamp
  FROM generate_series(1,8) g;
  INSERT INTO "BehaviorLog" (id,"studentId","teacherId","classroomId","lessonId",type,points,"createdAt")
  SELECT 'm2-'||g,'${DEREN}','${ogretmenId}','${SINIF_ID}','d2-1','MINUS',-5,'${D2}'::timestamp
  FROM generate_series(1,2) g;
`);
// Deren -- SINAV: 1. donem %50 ; 2. donem %80 -> yukseldi
sql(`
  INSERT INTO "Exam" (id,"teacherId",title,"examDate","maxScore",scope,"createdAt")
  VALUES ('s1','${ogretmenId}','1. donem yazili','${D1}',100,'OFFICIAL',now()),
         ('s2','${ogretmenId}','2. donem yazili','${D2}',100,'OFFICIAL',now());
  INSERT INTO "ExamResult" (id,"examId","studentId",score,"isAbsent","createdAt")
  VALUES ('r1','s1','${DEREN}',50,false,now()),
         ('r2','s2','${DEREN}',80,false,now());
`);
// Deren -- ODEV: 1. donem 4/4 = %100 ; 2. donem 1/4 = %25 -> dustu
sql(`
  INSERT INTO "Assignment" (id,"teacherId",title,"dueDate","isActive","createdAt","updatedAt")
  SELECT 'o1-'||g,'${ogretmenId}','1. donem odev '||g,'${D1}'::timestamp,true,now(),now()
  FROM generate_series(1,4) g;
  INSERT INTO "Assignment" (id,"teacherId",title,"dueDate","isActive","createdAt","updatedAt")
  SELECT 'o2-'||g,'${ogretmenId}','2. donem odev '||g,'${D2}'::timestamp,true,now(),now()
  FROM generate_series(1,4) g;
  INSERT INTO "Submission" (id,"assignmentId","studentId",status,"updatedAt")
  SELECT 't1-'||g,'o1-'||g,'${DEREN}','DONE',now() FROM generate_series(1,4) g;
  INSERT INTO "Submission" (id,"assignmentId","studentId",status,"updatedAt")
  SELECT 't2-'||g,'o2-'||g,'${DEREN}',
         (CASE WHEN g=1 THEN 'DONE' ELSE 'MISSING' END)::"SubmissionStatus",now()
  FROM generate_series(1,4) g;
`);

// Kurulum SQL'i gercekten yazildi mi. psql ifade hatasinda da 0 cikis kodu
// dondurur (HANDOFF'taki tuzak), yani hatali bir INSERT sessizce dusebilir ve
// test sonra anlamsiz bir sonuca bakar. Bu gercekten oldu: enum kolonuna
// CASE ile yazarken cast unutulmustu, teslimler hic olusmadi.
ok(
  "Kurulum: 8 teslim kaydi olustu",
  sql(`SELECT count(*) FROM "Submission" WHERE "studentId"='${DEREN}';`) === "8",
  sql(`SELECT count(*) FROM "Submission" WHERE "studentId"='${DEREN}';`),
);
ok(
  "Kurulum: 30 ders olustu",
  sql(`SELECT count(*) FROM "Lesson" WHERE "classroomId"='${SINIF_ID}';`) === "30",
);
ok(
  "Kurulum: 32 davranis kaydi olustu",
  sql(`SELECT count(*) FROM "BehaviorLog" WHERE "studentId"='${DEREN}';`) === "32",
);
// Tek Donem -- yalnizca 1. donemde kaydi var.
sql(`
  INSERT INTO "BehaviorLog" (id,"studentId","teacherId","classroomId","lessonId",type,points,"createdAt")
  SELECT 'tk-'||g,'${TEK}','${ogretmenId}','${SINIF_ID}','d1-1','PLUS',1,'${D1}'::timestamp
  FROM generate_series(1,3) g;
`);

// --- A. Karsilastirma cikiyor ---
console.log("\nA. Iki donem karsilastirmasi");
await ogrenciyeGit("Deren");
{
  const govde = await sayfa.innerText("body");
  ok("Gelisim blogu var", govde.includes("Gelişim"));
  ok("Iki donem basligi yazili",
     govde.includes("2025-2026 · 1. dönem") && govde.includes("2025-2026 · 2. dönem"), "donem etiketleri");
}

// --- B. Sinav yukseldi ---
console.log("\nB. Sinav");
{
  const satir = await olcuSatiri("Karne ortalaması");
  ok("Karne satiri var", satir !== null, String(satir));
  ok("Karne %50 -> %80 yazili", satir?.includes("%50") && satir?.includes("%80"), String(satir));
  ok("Karne yukseldi oku", satir?.includes("▲"), String(satir));
  ok("Karne yukselisi IYI (yesil)", (await okSinifi("Karne ortalaması"))?.includes("gelisim-iyi"));
}

// --- C. Ders basina normallestirme (asil kontrol) ---
console.log("\nC. Ders basina normallestirme");
{
  const satir = await olcuSatiri("Artı (ders başına)");
  ok("Arti satiri var", satir !== null, String(satir));
  ok("Ham sayi ARTMIS (10 -> 12)", satir?.includes("10 → 12"), String(satir));
  ok("Ders sayisi da artmis (10 -> 20)", satir?.includes("10 → 20 ders"), String(satir));
  ok("Yogunluk 1 -> 0.6 olarak yaziyor", satir?.includes("1 → 0.6"), String(satir));
  ok(
    "Ham sayi artmasina RAGMEN ok ASAGI",
    satir?.includes("▼"),
    "normallestirme olmasaydi yanlislikla yukseldi gorunurdu",
  );
  ok("Arti dususu KOTU (kirmizi)", (await okSinifi("Artı (ders başına)"))?.includes("gelisim-kotu"));
}

// --- D. Eksi azaldi: ok asagi ama IYILESME ---
console.log("\nD. Eksi azalinca iyilesme");
{
  const satir = await olcuSatiri("Eksi (ders başına)");
  ok("Eksi satiri var", satir !== null, String(satir));
  ok("Eksi 0.8 -> 0.1", satir?.includes("0.8 → 0.1"), String(satir));
  ok("Ok ASAGI bakiyor", satir?.includes("▼"), String(satir));
  ok(
    "Ama renk YESIL (iyilesme)",
    (await okSinifi("Eksi (ders başına)"))?.includes("gelisim-iyi"),
    "eksi dusunce iyilesme sayilmali",
  );
}

// --- E. Odev dustu ---
console.log("\nE. Odev");
{
  const satir = await olcuSatiri("Ödev tamamlama");
  ok("Odev %100 -> %25", satir?.includes("%100") && satir?.includes("%25"), String(satir));
  ok("Odev dususu KOTU", (await okSinifi("Ödev tamamlama"))?.includes("gelisim-kotu"));
}

// --- F. Tek donem: ok UYDURULMAZ ---
console.log("\nF. Tek donem");
await ogrenciyeGit("Tek");
{
  const govde = await sayfa.innerText("body");
  ok("Tek donemde uyari cikiyor", govde.includes("en az iki dönem gerekir"), "uyari metni");
  ok("Ok hic cikmiyor", (await sayfa.locator(".gelisim-ok").count()) === 0);
}

// --- G. Hic kaydi olmayan ogrencide blok HIC cikmaz ---
console.log("\nG. Kayitsiz ogrenci");
await ogrenciyeGit("Kerem");
{
  ok("Gelisim blogu hic render edilmedi", !(await sayfa.innerText("body")).includes("Gelişim"));
}

// --- H. Kart sablonunda etiketler degisir ---
console.log("\nH. Kart sablonu");
// Kart sablonunda olumsuz sayi = sari + kirmizi kart (MINUS degil).
sql(`
  INSERT INTO "BehaviorLog" (id,"studentId","teacherId","classroomId","lessonId",type,points,"createdAt")
  SELECT 'y1-'||g,'${DEREN}','${ogretmenId}','${SINIF_ID}','d1-1','YELLOW_CARD',0,'${D1}'::timestamp
  FROM generate_series(1,6) g;
  INSERT INTO "BehaviorLog" (id,"studentId","teacherId","classroomId","lessonId",type,points,"createdAt")
  SELECT 'y2-'||g,'${DEREN}','${ogretmenId}','${SINIF_ID}','d2-1','YELLOW_CARD',0,'${D2}'::timestamp
  FROM generate_series(1,4) g;
`);
await sayfa.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
await sayfa.getByRole("radio", { name: /Kart sistemi/ }).check();
await sayfa.locator(".sablon-formu").getByRole("button", { name: "Kaydet" }).click();
await sayfa.waitForSelector(".basari", { timeout: 10000 });
await ogrenciyeGit("Deren");
{
  const govde = await sayfa.innerText("body");
  ok("Kart sablonunda 'Yıldız (ders başına)'", govde.includes("Yıldız (ders başına)"));
  ok("Kart sablonunda 'Kart (ders başına)'", govde.includes("Kart (ders başına)"));
  ok("Basit sablon etiketleri gitti", !govde.includes("Artı (ders başına)"));

  // Kart sablonunda olumsuz = sari(6) + kirmizi(0) = 6/10 = 0.6
  //                        ve sari(4) + kirmizi(0) = 4/20 = 0.2
  // MINUS kayitlari sayilmamali; sayilsaydi 0.8 -> 0.1 gorunurdu.
  const satir = await olcuSatiri("Kart (ders başına)");
  ok("Kart sayisi MINUS'tan degil kartlardan geliyor",
     satir?.includes("6 → 4 kart"), String(satir));
  ok("Kart yogunlugu 0.6 -> 0.2", satir?.includes("0.6 → 0.2"), String(satir));
  ok("Kart azalisi IYI", (await okSinifi("Kart (ders başına)"))?.includes("gelisim-iyi"));
}

console.log(`\n${gecti} gecti, ${kaldi} kaldi`);
await tarayici.close();
process.exit(kaldi === 0 ? 0 : 1);
