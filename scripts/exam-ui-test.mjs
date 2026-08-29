// Sınav modülü testi: şablonla sınav oluşturma, bileşenli not girme, ağırlıklı
// puan hesabı, "girmedi" işareti, tarama (net) sınavı, sınıf ve öğrenci
// görünümleri, sahiplik.
//
// Kural hesabının kendisi `exam-rules-test.mjs` içinde ayrıca sınanıyor; bu
// dosya kuralın EKRANDA doğru işlediğini sınar.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. SESSION_SECRET tanımlı olacak şekilde: npm run build && npm start
//   3. npm install --no-save playwright
//   4. SQL_KOMUTU='psql "$DATABASE_URL" -q -tA' node scripts/exam-ui-test.mjs
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
const say = (tablo) => sql(`SELECT count(*) FROM "${tablo}";`);
// Bir ogrencinin satiri; sinif bolumune gore daraltilir.
const satir = (bolum, ad) => bolum.locator("tbody tr").filter({ hasText: ad });
const sonucHucresi = (bolum, ad) => satir(bolum, ad).locator("td.sonuc-hucre");

/**
 * Bir alana yaz, alandan cik, kaydin tamamlanmasini bekle.
 *
 * Kayit surerken hucrenin girisleri kilitlenir; bir sonraki alani doldurmadan
 * once kilidin acilmasini beklemek gerekir, yoksa ikinci deger kaybolur.
 * Bekleme olcutu alanin yeniden yazilabilir olmasi.
 */
async function notYaz(bolum, ad, etiket, deger) {
  const alan = satir(bolum, ad).getByLabel(etiket);
  await alan.fill(deger);
  await alan.blur();
  await sayfa.waitForFunction(
    ([a, e]) => {
      const tr = [...document.querySelectorAll("tbody tr")].find((r) =>
        r.innerText.includes(a),
      );
      const giris = [...(tr?.querySelectorAll("input") ?? [])].find(
        (i) => i.getAttribute("aria-label") === e,
      );
      return giris && !giris.disabled;
    },
    [ad, etiket],
    { timeout: 15000 },
  );
}

/** Sonuc hucresinin beklenen metne ulasmasini bekle. */
async function sonucBekle(ad, beklenen) {
  await sayfa.waitForFunction(
    ([a, b]) => {
      const tr = [...document.querySelectorAll("tbody tr")].find((r) =>
        r.innerText.includes(a),
      );
      const hucre = tr?.querySelector("td.sonuc-hucre");
      return hucre && hucre.innerText.includes(b);
    },
    [ad, beklenen],
    { timeout: 15000 },
  );
}

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

const hedefSinif = (ad) =>
  sayfa.locator(".hedef fieldset").filter({ hasText: ad }).locator("input[type=checkbox]").first();

// --- A: Hazirlik ---
console.log("\nA. Hazirlik");
const sinifA = await sinifKur("Sinav-9A", [["Ada", "Bir"], ["Efe", "Iki"]]);
await sinifKur("Sinav-9B", [["Mert", "Uc"]]);
ok("Uc ogrenci kuruldu", say("Student") === "3", `ogrenci=${say("Student")}`);

// --- B: Sinavlar sekmesi ---
console.log("\nB. Sinavlar sekmesi");
await sayfa.goto(T, { waitUntil: "networkidle" });
await sayfa.getByRole("link", { name: "Sınavlar", exact: true }).click();
await sayfa.getByRole("heading", { name: "Sınavlar" }).waitFor();
ok("Sinavlar sayfasi acildi", sayfa.url().includes("/sinavlar"));
ok("Bos liste mesaji", (await govde()).includes("Henüz sınav yok"));

// --- C: Agirlik dogrulamasi ---
console.log("\nC. Agirlik dogrulamasi");
await sayfa.getByRole("link", { name: /Yeni sınav/ }).click();
await sayfa.getByRole("heading", { name: "Yeni sınav" }).waitFor();
await sayfa.getByLabel("Hazır düzen").selectOption("meb");
await sayfa.waitForFunction(() => document.body.innerText.includes("Listening"), null, { timeout: 5000 });
ok("MEB sablonu uc bilesen getirdi",
   (await sayfa.locator("fieldset.bilesen").count()) === 3,
   String(await sayfa.locator("fieldset.bilesen").count()));
ok("Agirlik toplami 100", (await govde()).includes("Ağırlık toplamı: 100 / 100"));

// Agirligi boz: dugme pasiflesmeli.
const yaziliBilesen = sayfa.locator("fieldset.bilesen").filter({ hasText: "Yazılı" });
await yaziliBilesen.getByLabel("Ağırlık %").fill("40");
await sayfa.waitForFunction(() => document.body.innerText.includes("Ağırlık toplamı: 90 / 100"), null, { timeout: 5000 });
ok("Agirlik 90 iken uyari var", (await govde()).includes("toplam 100 etmeli"));
ok("Agirlik 90 iken kaydedilemez",
   await sayfa.getByRole("button", { name: "Sınavı oluştur" }).isDisabled());
await yaziliBilesen.getByLabel("Ağırlık %").fill("50");
await sayfa.waitForFunction(() => document.body.innerText.includes("Ağırlık toplamı: 100 / 100"), null, { timeout: 5000 });

// --- D: Sinav olusturma ---
console.log("\nD. Sinav olusturma");
await sayfa.getByLabel("Sınav adı").fill("1. Donem 1. Yazili");
await sayfa.getByLabel("Sınav tarihi").fill("2026-10-15");
ok("Hedef secilmeden kaydedilemez",
   await sayfa.getByRole("button", { name: "Sınavı oluştur" }).isDisabled());
await hedefSinif("Sinav-9A").check();
await hedefSinif("Sinav-9B").check();
await sayfa.getByRole("button", { name: "Sınavı oluştur" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("notu girildi"), null, { timeout: 15000 });
const sinavAdresi = sayfa.url();
ok("Sinav olustu", say("Exam") === "1", `sinav=${say("Exam")}`);
ok("Uc bilesen kaydedildi", say("ExamComponent") === "3", `bilesen=${say("ExamComponent")}`);
ok("Uc sonuc kaydi acildi", say("ExamResult") === "3", `sonuc=${say("ExamResult")}`);
ok("Resmi rozeti var", (await govde()).includes("Resmî"));
ok("Donem yazisi dogru", (await govde()).includes("2026-2027 · 1. dönem"),
   (await govde()).replace(/\s+/g, " ").slice(0, 200));

// --- E: Sinifa gore gruplama ---
console.log("\nE. Sinifa gore gruplama");
const grup9A = sayfa.locator("section.kart").filter({ hasText: "Sinav-9A" });
const grup9B = sayfa.locator("section.kart").filter({ hasText: "Sinav-9B" });
ok("Iki sinif bolumu var", (await sayfa.locator("section.kart").count()) === 2,
   String(await sayfa.locator("section.kart").count()));
ok("9A'da iki ogrenci", (await grup9A.locator("tbody tr").count()) === 2);
ok("9B'de tek ogrenci", (await grup9B.locator("tbody tr").count()) === 1);
ok("Bilesen sutunlari var",
   (await govde()).includes("Yazılı") && (await govde()).includes("Speaking"));

// --- F: Eksik bilesen puan URETMEZ ---
console.log("\nF. Eksik bilesen");
await notYaz(grup9A, "Ada", "Yazılı puanı", "80");
await sonucBekle("Ada", "2 bileşen eksik");
ok("Iki bilesen eksik yazisi",
   (await sonucHucresi(grup9A, "Ada").innerText()).includes("2 bileşen eksik"),
   await sonucHucresi(grup9A, "Ada").innerText());
ok("Puan HESAPLANMADI",
   sql(`SELECT count(*) FROM "ExamResult" WHERE score IS NOT NULL;`) === "0",
   sql(`SELECT count(*) FROM "ExamResult" WHERE score IS NOT NULL;`));

// --- G: Agirlikli puan ---
console.log("\nG. Agirlikli puan");
// Yazili 80 (%50), Listening 60 (%25), Speaking 100 (%25)
// -> (80*50 + 60*25 + 100*25) / 100 = 80
await notYaz(grup9A, "Ada", "Listening puanı", "60");
await sonucBekle("Ada", "1 bileşen eksik");
await notYaz(grup9A, "Ada", "Speaking puanı", "100");
await sonucBekle("Ada", "80");
const adaSonuc = await sonucHucresi(grup9A, "Ada").innerText();
ok("Puan 80", adaSonuc.includes("80"), adaSonuc);
ok("Yuzde 80", adaSonuc.includes("%80"), adaSonuc);
ok("Veritabanina yazildi",
   sql(`SELECT score FROM "ExamResult" WHERE score IS NOT NULL;`) === "80",
   sql(`SELECT score FROM "ExamResult" WHERE score IS NOT NULL;`));

// --- H: Girmedi ---
console.log("\nH. Girmedi isareti");
await satir(grup9A, "Efe").getByRole("button", { name: "Girmedi mi?" }).click();
await sayfa.waitForFunction(() => {
  const tr = [...document.querySelectorAll("tbody tr")].find((r) => r.innerText.includes("Efe"));
  return tr && tr.className.includes("girmedi-satir");
}, null, { timeout: 15000 });
ok("Girmedi isaretlendi",
   sql(`SELECT count(*) FROM "ExamResult" WHERE "isAbsent" = true;`) === "1");
ok("Not girisi kapandi",
   await satir(grup9A, "Efe").getByLabel("Yazılı puanı").isDisabled());
// Ada 80 aldi, Efe girmedi -> 9A ortalamasi yalnizca Ada'dan: %80
ok("Girmeyen ortalamaya katilmadi",
   (await grup9A.locator(".sayfa-basi .rozet").innerText()).includes("%80"),
   await grup9A.locator(".sayfa-basi .rozet").innerText());

// --- I: Tarama sinavi (net) ---
console.log("\nI. Tarama sinavi");
await sayfa.goto(`${T}/sinavlar/yeni`, { waitUntil: "networkidle" });
await sayfa.getByLabel("Hazır düzen").selectOption("tarama");
await sayfa.waitForFunction(() => document.body.innerText.includes("Soru sayısı"), null, { timeout: 5000 });
await sayfa.getByLabel("Sınav adı").fill("Tarama 1");
await sayfa.getByLabel("Sınav tarihi").fill("2026-11-01");
await hedefSinif("Sinav-9A").check();
await sayfa.getByRole("button", { name: "Sınavı oluştur" }).click();
await sayfa.waitForFunction(() => document.body.innerText.includes("notu girildi"), null, { timeout: 15000 });
ok("Deneme sinavi resmi DEGIL", !(await govde()).includes("Resmî"));

// 20 soru, 3 yanlis 1 dogru goturur. 15 dogru 3 yanlis -> net 14 -> %70
const taramaGrup = sayfa.locator("section.kart").filter({ hasText: "Sinav-9A" });
// Sirayla: her yazma tamamlanmadan sonrakine gecilmez, yoksa kilitli alana
// yazilir ve deger kaybolur.
await notYaz(taramaGrup, "Ada", "Net doğru sayısı", "15");
await notYaz(taramaGrup, "Ada", "Net yanlış sayısı", "3");
await sonucBekle("Ada", "70");
ok("Net 14 gosteriliyor", (await satir(taramaGrup, "Ada").innerText()).includes("14 net"),
   await satir(taramaGrup, "Ada").innerText());
ok("Puan 70", (await sonucHucresi(taramaGrup, "Ada").innerText()).includes("70"),
   await sonucHucresi(taramaGrup, "Ada").innerText());

// --- J: Liste ve filtreler ---
console.log("\nJ. Liste ve filtreler");
await sayfa.goto(`${T}/sinavlar`, { waitUntil: "networkidle" });
ok("Iki sinav listede", (await sayfa.locator("main .liste li").count()) === 2,
   String(await sayfa.locator("main .liste li").count()));
await sayfa.goto(`${T}/sinavlar?filtre=resmi`, { waitUntil: "networkidle" });
ok("Resmi filtresinde yalnizca yazili",
   (await govde()).includes("1. Donem 1. Yazili") && !(await govde()).includes("Tarama 1"));
await sayfa.goto(`${T}/sinavlar?filtre=deneme`, { waitUntil: "networkidle" });
ok("Deneme filtresinde yalnizca tarama",
   (await govde()).includes("Tarama 1") && !(await govde()).includes("1. Donem 1. Yazili"));

// --- K: Sinif ve ogrenci gorunumu ---
console.log("\nK. Sinif ve ogrenci gorunumu");
await sayfa.goto(sinifA, { waitUntil: "networkidle" });
await sayfa.getByRole("link", { name: /Sınavlar/ }).click();
// Baslikla beklenir, govde metniyle degil: "Sınavlar" kelimesi zaten
// baglantinin kendisinde geciyor ve bekleme aninda gecerdi.
await sayfa.getByRole("heading", { name: "Sinav-9A · Sınavlar" }).waitFor({ timeout: 10000 });
ok("Sinif sinav sayfasi acildi", sayfa.url().includes("/sinavlar"));
ok("Sinif sinavlari listede", (await govde()).includes("1. Donem 1. Yazili"));

await sayfa.goto(sinifA, { waitUntil: "networkidle" });
await sayfa.locator("li").filter({ hasText: "Ada" }).getByRole("link", { name: "Ada Bir" }).click();
await sayfa.getByRole("heading", { name: "Ada Bir" }).waitFor();
ok("Ogrenci sayfasinda sinav var", (await govde()).includes("1. Donem 1. Yazili"));
ok("Ogrenci sayfasinda tarama da var", (await govde()).includes("Tarama 1"));

// --- L: Sahiplik ---
console.log("\nL. Sahiplik");
let yanit = await sayfa.goto(`${T}/sinavlar/olmayan-sinav`, { waitUntil: "networkidle" });
ok("Olmayan sinav 404", yanit.status() === 404, `durum=${yanit.status()}`);
yanit = await sayfa.goto(`${T}/sinavlar/olmayan-sinav/duzenle`, { waitUntil: "networkidle" });
ok("Olmayan sinav duzenleme 404", yanit.status() === 404, `durum=${yanit.status()}`);

sql(`
INSERT INTO "Teacher" (id,email,name,"passwordHash","createdAt","behaviorTemplate")
VALUES ('t-sinav','sinav@ornek.com','Yabancı','!parola-yok',now(),'SIMPLE');
INSERT INTO "Exam" (id,"teacherId",title,"examDate","maxScore",scope,"createdAt")
VALUES ('e-yabanci','t-sinav','Yabanci Sinav', now(), 100, 'OFFICIAL', now());
`);
ok("Yabanci sinav gercekten olustu",
   sql(`SELECT count(*) FROM "Exam" WHERE id='e-yabanci';`) === "1",
   "sahiplik kontrolu bos veri uzerinde yapilirsa anlamsiz olur");
yanit = await sayfa.goto(`${T}/sinavlar/e-yabanci`, { waitUntil: "networkidle" });
ok("Baskasinin sinavi 404", yanit.status() === 404, `durum=${yanit.status()}`);
await sayfa.goto(`${T}/sinavlar`, { waitUntil: "networkidle" });
ok("Baskasinin sinavi listede YOK", !(await govde()).includes("Yabanci Sinav"));

await tarayici.close();
console.log(`\n=== SONUC: ${gecti} gecti, ${kaldi} kaldi ===`);
process.exit(kaldi === 0 ? 0 : 1);
