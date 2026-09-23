// Tahtanın canlı yayını: telefondan verilen kart genişçe bir ekranda anında
// görünür, ses çalar; dar ekranda (telefon) hiç etkinleşmez.
//
// Ayrı bir "tahta sayfası" yok — bkz. HANDOFF. Bileşen, sınıf ekranına
// eklenir ve globals.css'teki aynı 1280px eşiğinde kendini açar.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. SESSION_SECRET tanımlı olacak şekilde: npm run build && npm start
//   3. npm install --no-save playwright
//   4. node scripts/board-ui-test.mjs
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

const tarayici = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);

// "Tahta" ve "telefon" ayrı bağlam VE ayrı viewport: bileşen genişliğe göre
// kendini açıp kapatıyor, bunu gerçekten iki farklı ekran boyutuyla sınamak
// gerekir.
const tahtaBaglami = await tarayici.newContext({ viewport: { width: 1366, height: 900 } });
// Gercek tahtada ogretmen izni bir kez elle verir; testte izin kutusu
// cikamayacagi icin bastan verilir. IZIN VERILMEYEN hali M bolumunde ayrica
// sinanir -- iki yol da calismali.
await tahtaBaglami.grantPermissions(["notifications"], { origin: T });
const tahta = await tahtaBaglami.newPage();
await oturumHazirla(tahta, T);

const telefonBaglami = await tarayici.newContext({ viewport: { width: 390, height: 844 } });
const telefon = await telefonBaglami.newPage();
await oturumHazirla(telefon, T);

// --- A. Hazirlik ---
console.log("\nA. Hazirlik");
await tahta.goto(T, { waitUntil: "networkidle" });
await tahta.getByLabel("Sınıf adı").fill("Canli-Test");
await tahta.getByRole("button", { name: "Sınıf ekle" }).click();
await tahta.waitForFunction(() => document.body.innerText.includes("Canli-Test"), null, { timeout: 10000 });
await tahta.getByRole("link", { name: /Canli-Test/ }).click();
await tahta.waitForURL(/\/sinif\//, { timeout: 10000 });
const SINIF_ADRESI = new URL(tahta.url()).pathname;
ok("Sinif sayfasi acildi", /^\/sinif\/[^/]+$/.test(SINIF_ADRESI), SINIF_ADRESI);

await ogrenciFormunuAc(tahta);
await tahta.getByLabel("Ad", { exact: true }).fill("Elif");
await tahta.getByLabel("Soyad").fill("Demir");
await tahta.getByRole("button", { name: "Öğrenci ekle" }).click();
await tahta.waitForFunction(() => document.body.innerText.includes("Elif"), null, { timeout: 10000 });
await dersBaslat(tahta);
ok("Ders basladi", (await tahta.innerText("body")).includes(". ders"));

await telefon.goto(`${T}${SINIF_ADRESI}`, { waitUntil: "networkidle" });

const satir = (sayfa, ad) => sayfa.locator("li").filter({ hasText: ad });
const sesSayaci = (sayfa) => sayfa.evaluate(() => window.__tahtaSesSayaci ?? 0);
const yoklamaSayaci = (sayfa) => sayfa.evaluate(() => window.__tahtaYoklamaSayaci ?? 0);
const bildirimSayaci = (sayfa) => sayfa.evaluate(() => window.__tahtaBildirimSayaci ?? 0);

// Kutunun kapanmasini beklerken kullanilan sinir. Sure artik olay turune
// gore degisiyor (`board-rules.ts`); en uzunu kirmizi kart, 10 sn. Bu sabit
// onun uzerinde kalmali, yoksa test kartin UZUN DURMASI yuzunden kalir.
const KUTU_KAPANMA_BEKLEME = 14000;

// Sekmeyi gercekten gizlemeden `visibilityState`i ezmek: Playwright'ta bir
// sekmeyi arka plana atmanin tasinabilir yolu yok, ama bilesenin baktigi
// tek sey bu ozellik.
const gorunurlukKur = (sayfa, deger) =>
  sayfa.evaluate((d) => {
    Object.defineProperty(document, "visibilityState", { value: d, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  }, deger);

// --- B. Genislik esigi ---
console.log("\nB. Genislik esigi");
await tahta.reload({ waitUntil: "networkidle" });
await tahta.waitForSelector(".canli-ses-dugmesi", { timeout: 10000 });
ok("Genis ekranda ses dugmesi var", (await tahta.locator(".canli-ses-dugmesi").count()) === 1);

await telefon.reload({ waitUntil: "networkidle" });
await telefon.waitForTimeout(1000);
ok("Dar ekranda ses dugmesi YOK", (await telefon.locator(".canli-ses-dugmesi").count()) === 0);
ok("Telefon hic yoklama yapmadi", (await yoklamaSayaci(telefon)) === 0);

// --- C. Telefondan verilen kart tahtada goruluyor ---
console.log("\nC. Canli yansima");
const yoklamaOncesi = await yoklamaSayaci(tahta);
await satir(telefon, "Elif").getByRole("button", { name: /Artı ver|Yıldız ver/ }).click();
await tahta.waitForFunction(
  () => document.querySelector(".canli-bildirim")?.innerText.includes("Elif"),
  null,
  { timeout: 8000 },
);
const bildirimMetni = await tahta.locator(".canli-bildirim").innerText();
ok("Bildirim ogrenci adini tasiyor", bildirimMetni.includes("Elif"));
ok("Yoklama gercekten calisiyordu", (await yoklamaSayaci(tahta)) > yoklamaOncesi);

await tahta.waitForFunction(() => document.querySelector(".canli-bildirim") === null, null, { timeout: KUTU_KAPANMA_BEKLEME });
ok("Bildirim kendiliginden kapandi", (await tahta.locator(".canli-bildirim").count()) === 0);

// Bildirim geciciydi; asil mesele altindaki listenin de tazelenmesi. Tahta
// bir ilan panosu gibi acik dururken sinifin okudugu sey o liste.
await tahta
  .locator("li")
  .filter({ hasText: "Elif" })
  .filter({ hasText: "1 artı" })
  .waitFor({ timeout: 8000 })
  .catch(() => {});
ok(
  "Alttaki liste de tazelendi (yenilemeden)",
  (await satir(tahta, "Elif").innerText()).includes("1 artı"),
  (await satir(tahta, "Elif").innerText()).replace(/\s+/g, " "),
);

// --- D. Ses yalnizca acilinca calar ---
console.log("\nD. Ses acma");
const sesOncesi = await sesSayaci(tahta);
await satir(telefon, "Elif").getByRole("button", { name: /Artı ver|Yıldız ver/ }).click();
await tahta.waitForFunction(() => document.querySelector(".canli-bildirim") !== null, null, { timeout: 8000 });
ok("Ses acilmadan sayac artmadi", (await sesSayaci(tahta)) === sesOncesi);

await tahta.getByRole("button", { name: /Ses ve bildirimi aç/ }).click();
await tahta.waitForSelector('button:has-text("Ses ve bildirim açık")', { timeout: 5000 });
await satir(telefon, "Elif").getByRole("button", { name: /Artı ver|Yıldız ver/ }).click();
await tahta.waitForFunction(
  (onceki) => (window.__tahtaSesSayaci ?? 0) > onceki,
  sesOncesi,
  { timeout: 8000 },
);
ok("Ses acilinca sayac artti", (await sesSayaci(tahta)) > sesOncesi);

// --- E. Kart sablonu: sari/kirmizi bildirimleri ve kirmizinin tekilligi ---
console.log("\nE. Kart sablonu");
await telefon.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
await telefon.getByRole("radio", { name: /Kart sistemi/ }).check();
await telefon.locator(".sablon-formu").getByRole("button", { name: "Kaydet" }).click();
await telefon.waitForSelector(".basari", { timeout: 10000 });
await telefon.goto(`${T}${SINIF_ADRESI}`, { waitUntil: "networkidle" });
await tahta.reload({ waitUntil: "networkidle" });
await tahta.getByRole("button", { name: /Ses ve bildirimi aç/ }).click();

const sesOncesiKart = await sesSayaci(tahta);

await satir(telefon, "Elif").getByRole("button", { name: "Sarı kart ver" }).click();
await tahta.waitForFunction(
  () => document.querySelector(".canli-bildirim")?.innerText.includes("sarı kart"),
  null,
  { timeout: 8000 },
);
ok("Sari kart bildirimi goruldu", (await tahta.locator(".canli-bildirim").innerText()).includes("sarı kart"));
await tahta.waitForFunction(() => document.querySelector(".canli-bildirim") === null, null, { timeout: KUTU_KAPANMA_BEKLEME });

// Sari ustune sari kirmizidir: RED_CARD + otomatik MINUS tek olay yazar
// (davranisKaydet ikisini tek createMany ile, ayni createdAt ile yazar),
// tek bildirim gorunmeli, iki degil.
await satir(telefon, "Elif").getByRole("button", { name: "Sarı kart ver" }).click();
await tahta.waitForFunction(
  () => document.querySelector(".canli-bildirim")?.innerText.includes("kırmızı kart"),
  null,
  { timeout: 8000 },
);
ok("Kirmiziya yukselme bildirimi goruldu", (await tahta.locator(".canli-bildirim").innerText()).includes("kırmızı kart"));
await tahta.waitForFunction(() => document.querySelector(".canli-bildirim") === null, null, { timeout: KUTU_KAPANMA_BEKLEME });
// Ikinci bir bildirim gelseydi burada tekrar "canli-bildirim" belirirdi;
// gelmediginden emin olmak icin kisa bir sure daha beklenir.
await tahta.waitForTimeout(1500);
ok("Ayni eylem icin IKINCI bildirim gelmedi", (await tahta.locator(".canli-bildirim").count()) === 0);
ok(
  "Iki ogretmen eylemi tam iki ses caldi (otomatik MINUS ucuncu ses uretmedi)",
  (await sesSayaci(tahta)) === sesOncesiKart + 2,
  `${sesOncesiKart} -> ${await sesSayaci(tahta)}`,
);

// --- F. Kilitliyken de calisir ---
console.log("\nF. Kilitli tahtada canli yayin");
await tahta.goto(`${T}/ayarlar`, { waitUntil: "networkidle" });
const pinFormu = tahta.locator("form").filter({ has: tahta.getByLabel("Hesap parolanız") });
await pinFormu.getByLabel("Hesap parolanız").fill("uzunparola1");
await pinFormu.getByLabel(/tahta PIN'i|Tahta PIN'i/).first().fill("1357");
await pinFormu.getByLabel("PIN tekrar").fill("1357");
await pinFormu.getByRole("button", { name: /PIN'i (belirle|değiştir)/ }).click();
await tahta.waitForSelector(".basari", { timeout: 10000 });

await tahta.goto(`${T}${SINIF_ADRESI}`, { waitUntil: "networkidle" });
await tahta.getByRole("button", { name: /Bu cihazı kilitle/ }).click();
await tahta.waitForFunction(() => document.body.innerText.includes("Tahta kilitli"), null, { timeout: 10000 });
await tahta.getByRole("button", { name: /Ses ve bildirimi aç/ }).click();

await satir(telefon, "Elif").getByRole("button", { name: "Yıldız ver" }).click();
await tahta.waitForFunction(
  () => document.querySelector(".canli-bildirim")?.innerText.includes("yıldız"),
  null,
  { timeout: 8000 },
);
ok("Kilitli tahta yine de bildirim gosterdi", (await tahta.locator(".canli-bildirim").innerText()).includes("yıldız"));

// --- G. Sekme arka plandayken de bildirim gelir ---
//
// ESKIDEN TERSI SINANIYORDU: bilesen `visibilityState !== "visible"` iken
// yoklamayi kesiyordu, pil tasarrufu gerekcesiyle. Tahtada bu tam da kartin
// gorunmesi gereken ani oldurdugu icin kaldirildi -- ogretmen tahtada baska
// bir uygulamaya gectigi anda butun bildirimler kesiliyordu.
console.log("\nG. Arka plan");
await tahta.waitForFunction(() => document.querySelector(".canli-bildirim") === null, null, { timeout: KUTU_KAPANMA_BEKLEME });

const gizlenmedenOnce = await yoklamaSayaci(tahta);
await gorunurlukKur(tahta, "hidden");
await tahta.waitForTimeout(3000);
const gizliyken = await yoklamaSayaci(tahta);
ok("Gizliyken yoklama SURUYOR", gizliyken > gizlenmedenOnce, `${gizlenmedenOnce} -> ${gizliyken}`);

const gBildirimOncesi = await bildirimSayaci(tahta);
const gSesOncesi = await sesSayaci(tahta);
await satir(telefon, "Elif").getByRole("button", { name: "Kırmızı kart ver" }).click();
await tahta.waitForFunction(
  (onceki) => (window.__tahtaBildirimSayaci ?? 0) > onceki,
  gBildirimOncesi,
  { timeout: 10000 },
).catch(() => {});
ok(
  "Arka plandayken isletim sistemi bildirimi gosterildi",
  (await bildirimSayaci(tahta)) === gBildirimOncesi + 1,
  `${gBildirimOncesi} -> ${await bildirimSayaci(tahta)}`,
);
ok("Arka plandayken ses de caldi", (await sesSayaci(tahta)) > gSesOncesi);

// Sayfa ici kutu arka planda ZATEN gorunmez; kuyruga girseydi ogretmen
// sekmeye dondugunde birikmis bildirimler arka arkaya patlardi.
ok(
  "Arka plandayken sayfa ici kutu acilmadi",
  (await tahta.locator(".canli-bildirim").count()) === 0,
);

// Bildirimin ICERIGI: yukaridaki kontroller yalnizca "bir bildirim cikti"
// diyor. Gercek `Notification` nesnesinin basligini disaridan okumanin yolu
// yok, bu yuzden yapici gecici olarak kaydeden bir taklitle degistirilir.
// Sablon KART oldugu icin metin "kirmizi kart aldi" olmali -- basit sistemde
// ayni kayit "eksi aldi" diye okunurdu (`OLAY_GORUNUMU`).
await tahta.evaluate(() => {
  window.__yakalananBildirimler = [];
  class TaklitBildirim {
    static permission = "granted";
    constructor(baslik, secenekler) {
      window.__yakalananBildirimler.push({ baslik, ...secenekler });
    }
    close() {}
  }
  window.Notification = TaklitBildirim;
});
await satir(telefon, "Elif").getByRole("button", { name: "Kırmızı kart ver" }).click();
await tahta.waitForFunction(
  () => (window.__yakalananBildirimler ?? []).length > 0,
  null,
  { timeout: 10000 },
).catch(() => {});
const yakalanan = await tahta.evaluate(() => window.__yakalananBildirimler ?? []);
ok("Bildirim icerigi yakalandi", yakalanan.length === 1, JSON.stringify(yakalanan));
ok(
  "Baslik ogrenci adini ve simgeyi tasiyor",
  yakalanan[0]?.baslik === "🟥 Elif Demir",
  yakalanan[0]?.baslik,
);
ok(
  "Govde kart sablonunun diliyle yazilmis",
  yakalanan[0]?.body === "kırmızı kart aldı",
  yakalanan[0]?.body,
);
ok(
  "Kendi sesimiz acikken isletim sistemi sesi susturuldu",
  yakalanan[0]?.silent === true,
  String(yakalanan[0]?.silent),
);
ok(
  "Art arda gelenler biriksin diye tek etiket kullanildi",
  yakalanan[0]?.tag === "teacher-os-tahta",
  yakalanan[0]?.tag,
);

await gorunurlukKur(tahta, "visible");
await tahta.waitForTimeout(3000);
ok("Tekrar gorununce yoklama devam etti", (await yoklamaSayaci(tahta)) > gizliyken);
ok(
  "Sekmeye donunce birikmis bildirim patlamasi olmadi",
  (await tahta.locator(".canli-bildirim").count()) === 0,
);

// Gorunurken isletim sistemi bildirimi DEGIL, sayfa ici kutu cikar: tahtaya
// bakan sinif zaten kutuyu goruyor, ustune bir de sistem bildirimi gereksiz.
const gBildirimGorunurOnce = await bildirimSayaci(tahta);
await satir(telefon, "Elif").getByRole("button", { name: "Yıldız ver" }).click();
await tahta.waitForFunction(() => document.querySelector(".canli-bildirim") !== null, null, { timeout: 10000 });
ok("Gorunurken sayfa ici kutu cikti", (await tahta.locator(".canli-bildirim").count()) === 1);
ok(
  "Gorunurken isletim sistemi bildirimi gosterilmedi",
  (await bildirimSayaci(tahta)) === gBildirimGorunurOnce,
);
await tahta.waitForFunction(() => document.querySelector(".canli-bildirim") === null, null, { timeout: KUTU_KAPANMA_BEKLEME }).catch(() => {});

// Bildirim izni tarayicida KALICIDIR; ses baglami degildir (her sayfa
// yuklemesinde kullanici dokunusu ister). Yani ogretmen izni bir kez
// verdikten sonra sonraki derslerde dugmeye hic dokunmadan da isletim
// sistemi bildirimi almali -- tahtada en cok ise yarayacak durum bu.
await tahta.reload({ waitUntil: "networkidle" });
ok(
  "Yeniden yuklemede ses hala kapali (dokunus bekliyor)",
  (await tahta.getByRole("button", { name: /Ses ve bildirimi aç/ }).count()) === 1,
);
await gorunurlukKur(tahta, "hidden");
await satir(telefon, "Elif").getByRole("button", { name: "Yıldız ver" }).click();
await tahta.waitForFunction(
  () => (window.__tahtaBildirimSayaci ?? 0) > 0,
  null,
  { timeout: 10000 },
).catch(() => {});
ok(
  "Izin kalici: dugmeye dokunmadan da bildirim geldi",
  (await bildirimSayaci(tahta)) === 1,
  String(await bildirimSayaci(tahta)),
);
ok(
  "Dokunulmadigi icin kendi sesimiz calmadi (isletim sistemi sesi devrede)",
  (await sesSayaci(tahta)) === 0,
  String(await sesSayaci(tahta)),
);
await gorunurlukKur(tahta, "visible");

// --- H. Yetki: oturumsuz ve baska ogretmen ---
console.log("\nH. Yetki");
const sinifId = SINIF_ADRESI.split("/").pop();
ok("Sinif id bulundu", Boolean(sinifId) && sinifId.length > 0, String(sinifId));

const oturumsuzBaglami = await tarayici.newContext();
const oturumsuz = await oturumsuzBaglami.newPage();
await oturumsuz.goto(`${T}/giris`, { waitUntil: "networkidle" });
const oturumsuzYanit = await oturumsuz.evaluate(
  async (id) => {
    const r = await fetch(`/api/sinif/${id}/canli`);
    return { durum: r.status };
  },
  sinifId,
);
ok("Oturumsuz istek 401 doner", oturumsuzYanit.durum === 401, JSON.stringify(oturumsuzYanit));
await oturumsuzBaglami.close();

const hash = bcrypt.hashSync("ikinci-parola-123", 12);
sql(`
INSERT INTO "Teacher" (id, email, name, "passwordHash", "createdAt")
VALUES ('t-ikinci-tahta', 'ikinci-tahta@ornek.com', 'İkinci Öğretmen', '${hash}', now());
`);
const ikinciBaglami = await tarayici.newContext();
const ikinci = await ikinciBaglami.newPage();
await ikinci.goto(`${T}/giris`, { waitUntil: "networkidle" });
await ikinci.getByLabel("E-posta").fill("ikinci-tahta@ornek.com");
await ikinci.getByLabel("Parola").fill("ikinci-parola-123");
await ikinci.getByRole("button", { name: "Giriş yap" }).click();
await ikinci.waitForURL(`${T}/`, { timeout: 20000 });

const ikinciYanit = await ikinci.evaluate(
  async (id) => {
    const r = await fetch(`/api/sinif/${id}/canli`);
    return { durum: r.status, gövde: await r.json() };
  },
  sinifId,
);
ok("Baska ogretmenin sinifi bos doner (bulundugu sizdirilmaz)",
  ikinciYanit.durum === 200 &&
    ikinciYanit.gövde.olaylar.length === 0 &&
    ikinciYanit.gövde.dersId === null,
  JSON.stringify(ikinciYanit));
await ikinciBaglami.close();

// --- I. Tahta modu dugmesi (dar ekranda elle acma) ---
// Genislik esigi yalnizca bir TAHMIN; bolunmus ekranda tahta dar bir seride
// duser ve tahmin yanilir. Dugme bu yuzden var: dar ekranda da acilabilmeli.
console.log("\nI. Tahta modu dugmesi");
await telefon.goto(`${T}${SINIF_ADRESI}`, { waitUntil: "networkidle" });
await telefon.waitForSelector(".canli-mod-dugmesi", { timeout: 10000 });
ok("Dar ekranda mod dugmesi var", (await telefon.locator(".canli-mod-dugmesi").count()) === 1);
ok("Acilmadan ses dugmesi YOK", (await telefon.locator(".canli-ses-dugmesi").count()) === 0);

const modOncesiYoklama = await yoklamaSayaci(telefon);
await telefon.getByRole("button", { name: /Tahta modu/ }).click();
await telefon.waitForSelector(".canli-ses-dugmesi", { timeout: 10000 });
ok("Dugmeye basinca canli katman acildi", (await telefon.locator(".canli-ses-dugmesi").count()) === 1);

await telefon.waitForTimeout(3000);
ok(
  "Dar ekranda da yoklama basladi",
  (await yoklamaSayaci(telefon)) > modOncesiYoklama,
  `${modOncesiYoklama} -> ${await yoklamaSayaci(telefon)}`,
);

// Secim cihazda kalir: tahtayi bir kez ayarlayip her derste yeniden
// ugrasmak gerekmesin.
await telefon.reload({ waitUntil: "networkidle" });
await telefon.waitForSelector(".canli-ses-dugmesi", { timeout: 10000 });
ok("Secim yenilemeden sonra da duruyor", (await telefon.locator(".canli-ses-dugmesi").count()) === 1);

await telefon.getByRole("button", { name: /Tahta modu açık/ }).click();
await telefon.waitForFunction(
  () => document.querySelector(".canli-ses-dugmesi") === null,
  null,
  { timeout: 10000 },
);
ok("Tekrar basinca kapaniyor", (await telefon.locator(".canli-ses-dugmesi").count()) === 0);

// --- J. Dar VE kilitli tahta ---
// Gercek tahtadan gelen sikayet: kilitliyken ne bildirim geliyor ne de liste
// guncelleniyor, kilidi acinca hepsi birden dusuyor. Suphe: tahtanin tarayici
// genisligi 1280px esiginin altinda kaliyor, canli katman hic acilmiyor;
// kilit de mod dugmesini gizledigi icin acmanin yolu kalmiyor. Kilitli bir
// cihaz zaten TANIM GEREGI tahtadir — genislige bakilmamali.
console.log("\nJ. Dar ve kilitli tahta");
const darBaglam = await tarayici.newContext({ viewport: { width: 390, height: 844 } });
const darTahta = await darBaglam.newPage();
await oturumHazirla(darTahta, T);
await darTahta.goto(`${T}${SINIF_ADRESI}`, { waitUntil: "networkidle" });
await darTahta.getByRole("button", { name: /Bu cihazı kilitle/ }).click();
await darTahta.waitForFunction(
  () => document.body.innerText.includes("Tahta kilitli"),
  null,
  { timeout: 10000 },
);
ok("Dar cihaz kilitlendi", (await darTahta.innerText("body")).includes("Tahta kilitli"));

await satir(telefon, "Elif").getByRole("button", { name: "Yıldız ver" }).click();
await darTahta
  .waitForFunction(
    () => document.querySelector(".canli-bildirim")?.innerText.includes("yıldız") ?? false,
    null,
    { timeout: 10000 },
  )
  .catch(() => {});
ok(
  "Dar ve kilitli tahtada bildirim geldi",
  (await darTahta.locator(".canli-bildirim").count()) === 1,
  "kilitli cihaz genislige bakilmadan tahta sayilmali",
);
ok(
  "Dar ve kilitli tahtada yoklama calisiyor",
  (await yoklamaSayaci(darTahta)) > 0,
  `yoklama=${await yoklamaSayaci(darTahta)}`,
);
await darBaglam.close();

// --- K. Ders YOKKEN acilan tahta, ders baslayinca yakalar ---
// Gercek kullanim sirasi bu: ogretmen tahtayi kurar, kilitler, DERSI SONRA
// baslatir. Onceki surumde canli katman ders id'si olmadan hic yoklamiyordu;
// tahta dersin basladigini ogrenemedigi icin ders boyunca sessiz kaliyordu.
// Tazelenmek icin olay bekliyor, olay almak icin tazelenmesi gerekiyordu.
console.log("\nK. Ders yokken acilan tahta");
{
  // Temiz bir sinif: bu senaryo "hic aktif ders yok" ile baslamali.
  const kurulum = await tarayici.newContext({ viewport: { width: 1366, height: 900 } });
  const kSayfa = await kurulum.newPage();
  await oturumHazirla(kSayfa, T);
  await kSayfa.goto(T, { waitUntil: "networkidle" });
  await kSayfa.getByLabel("Sınıf adı").fill("Sonra-Ders");
  await kSayfa.getByRole("button", { name: "Sınıf ekle" }).click();
  await kSayfa.waitForFunction(() => document.body.innerText.includes("Sonra-Ders"), null, { timeout: 10000 });
  await kSayfa.getByRole("link", { name: /Sonra-Ders/ }).click();
  await kSayfa.waitForURL(/\/sinif\//, { timeout: 10000 });
  const YENI_YOL = new URL(kSayfa.url()).pathname;
  await ogrenciFormunuAc(kSayfa);
  await kSayfa.getByLabel("Ad", { exact: true }).fill("Kerem");
  await kSayfa.getByLabel("Soyad").fill("Yilmaz");
  await kSayfa.getByRole("button", { name: "Öğrenci ekle" }).click();
  await kSayfa.waitForFunction(() => document.body.innerText.includes("Kerem"), null, { timeout: 10000 });
  await kurulum.close();

  // Tahta: ders YOKKEN ac ve kilitle.
  const kTahtaB = await tarayici.newContext({ viewport: { width: 1366, height: 900 } });
  const kTahta = await kTahtaB.newPage();
  await oturumHazirla(kTahta, T);
  await kTahta.goto(`${T}${YENI_YOL}`, { waitUntil: "networkidle" });
  ok("Tahta derssiz acildi", (await kTahta.innerText("body")).includes("Aktif ders yok"));
  await kTahta.getByRole("button", { name: /Bu cihazı kilitle/ }).click();
  await kTahta.waitForFunction(() => document.body.innerText.includes("Tahta kilitli"), null, { timeout: 10000 });

  // ASIL KONTROL: ders yokken de yoklama calismali.
  await kTahta.waitForFunction(() => (window.__tahtaYoklamaSayaci ?? 0) > 0, null, { timeout: 8000 }).catch(() => {});
  ok(
    "Ders yokken de yoklama calisiyor",
    (await yoklamaSayaci(kTahta)) > 0,
    `yoklama=${await yoklamaSayaci(kTahta)} (0 ise tahta dersin basladigini hic ogrenemez)`,
  );

  // Telefondan dersi baslat ve yildiz ver.
  const kTelefonB = await tarayici.newContext({ viewport: { width: 390, height: 844 } });
  const kTelefon = await kTelefonB.newPage();
  await oturumHazirla(kTelefon, T);
  await kTelefon.goto(`${T}${YENI_YOL}`, { waitUntil: "networkidle" });
  await kTelefon.getByRole("button", { name: "Yeni ders başlat" }).click();
  await kTelefon.waitForFunction(() => document.body.innerText.includes(". ders"), null, { timeout: 10000 });

  // Tahta dersin basladigini kendiliginden gormeli (bildirim beklemeden).
  await kTahta
    .waitForFunction(() => !document.body.innerText.includes("Aktif ders yok"), null, { timeout: 10000 })
    .catch(() => {});
  ok(
    "Tahta dersin basladigini kendiliginden gordu",
    !(await kTahta.innerText("body")).includes("Aktif ders yok"),
    "ders degisimi tazelemeyi tetiklemeli",
  );

  await kTelefon.waitForTimeout(400);
  await satir(kTelefon, "Kerem").getByRole("button", { name: /Yıldız ver|Artı ver/ }).click();
  await kTahta
    .waitForFunction(() => document.querySelector(".canli-bildirim") !== null, null, { timeout: 10000 })
    .catch(() => {});
  ok(
    "Sonradan baslayan derste bildirim geldi",
    (await kTahta.locator(".canli-bildirim").count()) === 1,
    "asil hata buydu: ders yokken kilitlenen tahta hic bildirim almiyordu",
  );

  // --- L. Ders bitip yenisi baslayinca tahta yeni derse gecer ---
  console.log("\nL. Ders degisimi");
  await kTahta.waitForFunction(() => document.querySelector(".canli-bildirim") === null, null, { timeout: KUTU_KAPANMA_BEKLEME }).catch(() => {});
  await kTelefon.getByRole("button", { name: "Dersi bitir" }).click();
  await kTelefon.waitForFunction(() => document.body.innerText.includes("Aktif ders yok"), null, { timeout: 10000 });
  await kTelefon.getByRole("button", { name: "Yeni ders başlat" }).click();
  await kTelefon.waitForFunction(() => document.body.innerText.includes("2. ders"), null, { timeout: 10000 });

  await kTahta
    .waitForFunction(() => document.body.innerText.includes("2. ders"), null, { timeout: 10000 })
    .catch(() => {});
  ok(
    "Tahta yeni derse gecti",
    (await kTahta.innerText("body")).includes("2. ders"),
    "eski ders id'sine takili kalmamali",
  );

  await kTelefon.waitForTimeout(400);
  await satir(kTelefon, "Kerem").getByRole("button", { name: /Yıldız ver|Artı ver/ }).click();
  await kTahta
    .waitForFunction(() => document.querySelector(".canli-bildirim") !== null, null, { timeout: 10000 })
    .catch(() => {});
  ok(
    "Yeni derste de bildirim geliyor",
    (await kTahta.locator(".canli-bildirim").count()) === 1,
  );

  await kTahtaB.close();
  await kTelefonB.close();
}

// --- M. Bildirim izni VERILMEMISKEN de arka plan calismali ---
// Gercek tahtada izin reddedilmis ya da hic sorulmamis olabilir. O zaman
// isletim sistemi bildirimi cikmaz, ama ses ve yoklama calismaya devam
// etmeli: bir izin eksigi butun canli katmani goturmemeli.
console.log("\nM. Bildirim izni yokken");
{
  const kurulum = await tarayici.newContext({ viewport: { width: 1366, height: 900 } });
  const mKurulum = await kurulum.newPage();
  await oturumHazirla(mKurulum, T);
  await mKurulum.goto(T, { waitUntil: "networkidle" });
  await mKurulum.getByLabel("Sınıf adı").fill("Izinsiz-Tahta");
  await mKurulum.getByRole("button", { name: "Sınıf ekle" }).click();
  await mKurulum.waitForFunction(() => document.body.innerText.includes("Izinsiz-Tahta"), null, { timeout: 10000 });
  await mKurulum.getByRole("link", { name: /Izinsiz-Tahta/ }).click();
  await mKurulum.waitForURL(/\/sinif\//, { timeout: 10000 });
  const M_YOL = new URL(mKurulum.url()).pathname;
  await ogrenciFormunuAc(mKurulum);
  await mKurulum.getByLabel("Ad", { exact: true }).fill("Selin");
  await mKurulum.getByLabel("Soyad").fill("Kara");
  await mKurulum.getByRole("button", { name: "Öğrenci ekle" }).click();
  await mKurulum.waitForFunction(() => document.body.innerText.includes("Selin"), null, { timeout: 10000 });
  await dersBaslat(mKurulum);
  await kurulum.close();

  // IZIN VERILMEZ: `grantPermissions` bilerek cagrilmiyor.
  const mTahtaB = await tarayici.newContext({ viewport: { width: 1366, height: 900 } });
  const mTahta = await mTahtaB.newPage();
  await oturumHazirla(mTahta, T);
  await mTahta.goto(`${T}${M_YOL}`, { waitUntil: "networkidle" });
  ok(
    "Izin verilmedi (baslangic durumu dogru)",
    (await mTahta.evaluate(() => Notification.permission)) !== "granted",
    await mTahta.evaluate(() => Notification.permission),
  );
  await mTahta.getByRole("button", { name: /Ses ve bildirimi aç/ }).click();
  await mTahta.waitForSelector('button:has-text("Ses ve bildirim açık")', { timeout: 5000 });
  ok("Izin reddedilse de ses acildi", true);

  const mTelefonB = await tarayici.newContext({ viewport: { width: 390, height: 844 } });
  const mTelefon = await mTelefonB.newPage();
  await oturumHazirla(mTelefon, T);
  await mTelefon.goto(`${T}${M_YOL}`, { waitUntil: "networkidle" });

  await gorunurlukKur(mTahta, "hidden");
  const mYoklamaOnce = await yoklamaSayaci(mTahta);
  const mSesOnce = await sesSayaci(mTahta);
  await satir(mTelefon, "Selin").getByRole("button", { name: "Kırmızı kart ver" }).click();
  await mTahta.waitForFunction(
    (onceki) => (window.__tahtaSesSayaci ?? 0) > onceki,
    mSesOnce,
    { timeout: 10000 },
  ).catch(() => {});

  ok("Izin yokken de ses caldi", (await sesSayaci(mTahta)) > mSesOnce);
  ok("Izin yokken bildirim sayaci artmadi", (await bildirimSayaci(mTahta)) === 0);
  ok("Izin yokken yoklama surdu", (await yoklamaSayaci(mTahta)) > mYoklamaOnce);

  // Sekmeye donunce sayfa ici kutu yine calismali: canli katman ayakta.
  await gorunurlukKur(mTahta, "visible");
  await mTahta.waitForTimeout(500);
  await satir(mTelefon, "Selin").getByRole("button", { name: "Yıldız ver" }).click();
  await mTahta.waitForFunction(() => document.querySelector(".canli-bildirim") !== null, null, { timeout: 10000 }).catch(() => {});
  ok(
    "Izin yokken sayfa ici kutu hala calisiyor",
    (await mTahta.locator(".canli-bildirim").count()) === 1,
  );

  await mTahtaB.close();
  await mTelefonB.close();
}

// --- N. Bildirim suresi olay turune gore degisir ---
// Ogretmenin "kizmak yerine kart islettigi" an bu: kart yazisi yildizla ayni
// surede kaybolursa, sesi duyup basini kaldiran ogrenci bos ekran gorur.
// Sureler `board-rules.ts`te; buradaki olcum EKRANDA gercekten oyle
// davrandigini dogrular.
console.log("\nN. Bildirim suresi");
{
  const kurulum = await tarayici.newContext({ viewport: { width: 1366, height: 900 } });
  const nKurulum = await kurulum.newPage();
  await oturumHazirla(nKurulum, T);
  await nKurulum.goto(T, { waitUntil: "networkidle" });
  await nKurulum.getByLabel("Sınıf adı").fill("Sure-Testi");
  await nKurulum.getByRole("button", { name: "Sınıf ekle" }).click();
  await nKurulum.waitForFunction(() => document.body.innerText.includes("Sure-Testi"), null, { timeout: 10000 });
  await nKurulum.getByRole("link", { name: /Sure-Testi/ }).click();
  await nKurulum.waitForURL(/\/sinif\//, { timeout: 10000 });
  const N_YOL = new URL(nKurulum.url()).pathname;
  await ogrenciFormunuAc(nKurulum);
  await nKurulum.getByLabel("Ad", { exact: true }).fill("Mert");
  await nKurulum.getByLabel("Soyad").fill("Ozer");
  await nKurulum.getByRole("button", { name: "Öğrenci ekle" }).click();
  await nKurulum.waitForFunction(() => document.body.innerText.includes("Mert"), null, { timeout: 10000 });
  await dersBaslat(nKurulum);
  await kurulum.close();

  const nTahtaB = await tarayici.newContext({ viewport: { width: 1366, height: 900 } });
  const nTahta = await nTahtaB.newPage();
  await oturumHazirla(nTahta, T);
  await nTahta.goto(`${T}${N_YOL}`, { waitUntil: "networkidle" });

  const nTelefonB = await tarayici.newContext({ viewport: { width: 390, height: 844 } });
  const nTelefon = await nTelefonB.newPage();
  await oturumHazirla(nTelefon, T);
  await nTelefon.goto(`${T}${N_YOL}`, { waitUntil: "networkidle" });

  // Kutunun DOM'da kalis suresi. Beliren ani baslangic sayar; yoklama
  // gecikmesi (2 sn'ye kadar) olcume karismasin.
  async function kutuOmru(sayfa, dugme) {
    await satir(nTelefon, "Mert").getByRole("button", { name: dugme }).click();
    await sayfa.waitForFunction(() => document.querySelector(".canli-bildirim") !== null, null, { timeout: 12000 });
    const bas = Date.now();
    await sayfa.waitForFunction(() => document.querySelector(".canli-bildirim") === null, null, { timeout: 25000 });
    return Date.now() - bas;
  }

  const yildizOmru = await kutuOmru(nTahta, "Yıldız ver");
  ok("Yildiz kisa durur (< 4 sn)", yildizOmru < 4000, `${yildizOmru} ms`);

  const kirmiziOmru = await kutuOmru(nTahta, "Kırmızı kart ver");
  ok("Kirmizi kart uzun durur (> 7 sn)", kirmiziOmru > 7000, `${kirmiziOmru} ms`);
  ok(
    "Kirmizi kart yildizdan belirgin uzun durur",
    kirmiziOmru > yildizOmru * 2,
    `yildiz ${yildizOmru} ms, kirmizi ${kirmiziOmru} ms`,
  );

  // Arka plandaki isletim sistemi bildiriminde ayni ayrim `requireInteraction`
  // ile korunur: Chrome bayraksiz bildirimi ~8 sn sonra kendiliginden indirir,
  // kart bildirimi bundan uzun durmali.
  await nTahta.evaluate(() => {
    window.__yakalananBildirimler = [];
    class TaklitBildirim {
      static permission = "granted";
      constructor(baslik, secenekler) {
        window.__yakalananBildirimler.push({ baslik, ...secenekler });
      }
      close() {}
    }
    window.Notification = TaklitBildirim;
  });
  await gorunurlukKur(nTahta, "hidden");

  await satir(nTelefon, "Mert").getByRole("button", { name: "Yıldız ver" }).click();
  await nTahta.waitForFunction(() => (window.__yakalananBildirimler ?? []).length === 1, null, { timeout: 12000 }).catch(() => {});
  await satir(nTelefon, "Mert").getByRole("button", { name: "Kırmızı kart ver" }).click();
  await nTahta.waitForFunction(() => (window.__yakalananBildirimler ?? []).length === 2, null, { timeout: 12000 }).catch(() => {});

  const nYakalanan = await nTahta.evaluate(() => window.__yakalananBildirimler ?? []);
  ok("Iki bildirim de yakalandi", nYakalanan.length === 2, JSON.stringify(nYakalanan));
  ok(
    "Yildiz bildirimi ekrana sabitlenmez",
    nYakalanan[0]?.requireInteraction === false,
    String(nYakalanan[0]?.requireInteraction),
  );
  ok(
    "Kirmizi kart bildirimi ekrana sabitlenir",
    nYakalanan[1]?.requireInteraction === true,
    String(nYakalanan[1]?.requireInteraction),
  );

  await nTahtaB.close();
  await nTelefonB.close();
}

console.log(`\nSonuc: ${gecti} gecti, ${kaldi} kaldi\n`);
await tarayici.close();
process.exit(kaldi === 0 ? 0 : 1);
