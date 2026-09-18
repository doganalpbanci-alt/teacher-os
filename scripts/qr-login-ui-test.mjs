// QR ile akıllı tahta girişi.
//
// Asıl senaryo: tahtada QR çıkar, öğretmen telefonundan okutup onaylar, tahta
// parolasız girer. Ama bu testin can alıcı bölümü C: QR'ı SINIFIN TAMAMI
// görüyor, fotoğrafını çeken bir cihaz öğretmen onayladıktan sonra bile
// oturumu alamamalı. Koruma tahtanın httpOnly gizli çerezidir; onu taşımayan
// cihaz için eşleşme işe yaramaz.
//
// Çalıştırmadan önce:
//   1. Migration'ları uygulanmış BOŞ bir veritabanı hazırla ve DATABASE_URL'i
//      ona çevir. Test veri yazar; üretim veritabanına karşı ÇALIŞTIRMA.
//   2. npm run build && npm start
//   3. npm install --no-save playwright
//   4. SQL_KOMUTU='psql "$DATABASE_URL" -q -tA' node scripts/qr-login-ui-test.mjs
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import { oturumHazirla } from "./test-oturum.mjs";

const T = process.env.TEMEL_ADRES ?? "http://127.0.0.1:3000";
let gecti = 0, kaldi = 0;
function ok(ad, kosul, ayrinti = "") {
  if (kosul) { gecti++; console.log(`  GECTI  ${ad}`); }
  else { kaldi++; console.log(`  KALDI  ${ad}${ayrinti ? "  -> " + ayrinti : ""}`); }
}

const SQL_KOMUTU = process.env.SQL_KOMUTU ?? 'psql "$DATABASE_URL" -q -tA';
const sql = (m) => execSync(SQL_KOMUTU, { input: m, shell: "/bin/bash" }).toString().trim();
const eslesmeSayisi = () => sql(`SELECT count(*) FROM "DevicePairing";`);

const tarayici = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);

// Telefon: hesabı kurar ve oturumu burada kalır.
const telefonB = await tarayici.newContext({ viewport: { width: 390, height: 844 } });
const telefon = await telefonB.newPage();
await oturumHazirla(telefon, T);

/** Tahta: AYRI bağlam, yani oturumu ve çerezleri telefondan tamamen ayrı. */
async function tahtaAc() {
  const b = await tarayici.newContext({ viewport: { width: 1366, height: 900 } });
  return { baglam: b, sayfa: await b.newPage() };
}

/** Tahtada QR ekranını açar; eşleşme id'sini ve ekrandaki kodu döndürür. */
async function qrAc(sayfa) {
  await sayfa.goto(`${T}/giris`, { waitUntil: "networkidle" });
  await sayfa.getByRole("button", { name: /QR ile gir/ }).click();
  await sayfa.waitForURL(`${T}/giris/qr`, { timeout: 15000 });
  await sayfa.locator(".qr-kod").waitFor({ timeout: 10000 });
  const kod = (await sayfa.locator(".qr-kod").innerText()).replace(/\s/g, "");
  const id = sql(`SELECT id FROM "DevicePairing" ORDER BY "createdAt" DESC LIMIT 1;`);
  return { id, kod };
}

// --- A. Tahtada QR ekrani ---
console.log("\nA. Tahtada QR ekrani");
const { baglam: tahtaB, sayfa: tahta } = await tahtaAc();
const { id: ESLESME, kod: KOD } = await qrAc(tahta);

ok("Eslesme kaydi olustu", eslesmeSayisi() === "1", `sayi=${eslesmeSayisi()}`);
ok("Kod 4 haneli", /^[0-9]{4}$/.test(KOD), KOD);
ok("QR gorseli ciziliyor", (await tahta.locator(".qr-kutu svg").count()) === 1);
{
  const govde = await tahta.innerText("body");
  ok("Parola alani QR ekraninda YOK", !govde.toLowerCase().includes("parola") || !(await tahta.locator('input[type=password]').count()));
  ok("Bekleme mesaji var", govde.includes("onaylamanız bekleniyor"));
}
ok(
  "Giz veritabaninda ACIK durmuyor",
  sql(`SELECT "verifierHash" FROM "DevicePairing" WHERE id='${ESLESME}';`).length === 64,
  "yalnizca SHA-256 ozeti saklanmali",
);

// --- B. Oturumsuz cihaz onaylayamaz ---
console.log("\nB. Oturumsuz cihaz onaylayamaz");
{
  // QR'i fotograflayan, girisi olmayan bir ogrenci telefonu.
  const ogrenciB = await tarayici.newContext({ viewport: { width: 390, height: 844 } });
  const ogrenci = await ogrenciB.newPage();
  await ogrenci.goto(`${T}/eslestir/${ESLESME}`, { waitUntil: "networkidle" });
  ok("Girise yonlendirildi", ogrenci.url().includes("/giris"), ogrenci.url());
  ok(
    "Donus adresi korundu (devam)",
    ogrenci.url().includes(`devam=%2Feslestir%2F${ESLESME}`),
    ogrenci.url(),
  );
  ok("Onay dugmesi gorunmuyor", (await ogrenci.getByRole("button", { name: /Onayla/ }).count()) === 0);
  ok(
    "Eslesme hala onaysiz",
    sql(`SELECT "approvedAt" IS NULL FROM "DevicePairing" WHERE id='${ESLESME}';`) === "t",
  );
  await ogrenciB.close();
}

// --- C. QR'i fotograflayan cihaz oturumu ALAMAZ (asil koruma) ---
console.log("\nC. Fotograflayan cihaz oturumu alamaz");

// Tahtanin yoklayicisi 2 saniyede bir calisiyor ve onaydan hemen sonra
// eslesmeyi tuketiyor -- dogru davranis, ama "basarisiz hirsizlik QR'i
// yakmadi" kontrolunu yarisa sokar. Tahta sayfasi gecici olarak birakilir;
// cerez baglamda kaldigi icin geri donunce kaldigi yerden devam eder.
await tahta.goto("about:blank");

// Once ogretmen telefonundan onaylar.
await telefon.goto(`${T}/eslestir/${ESLESME}`, { waitUntil: "networkidle" });
ok("Telefonda ayni kod gorunuyor", (await telefon.locator(".qr-kod").innerText()).replace(/\s/g, "") === KOD);
await telefon.getByRole("button", { name: /Onayla/ }).click();
await telefon.waitForSelector(".basari", { timeout: 15000 });
ok("Telefon onayladi", (await telefon.innerText(".basari")).includes("Onaylandı"));
ok(
  "Eslesme onaylandi olarak isaretlendi",
  sql(`SELECT "approvedAt" IS NOT NULL FROM "DevicePairing" WHERE id='${ESLESME}';`) === "t",
);

// Simdi fotograf ceken cihaz, onaylanmis eslesmenin oturumunu almayi dener.
{
  const hirsizB = await tarayici.newContext({ viewport: { width: 390, height: 844 } });
  const hirsiz = await hirsizB.newPage();
  await hirsiz.goto(`${T}/giris`, { waitUntil: "networkidle" });
  const yanit = await hirsiz.evaluate(async (id) => {
    const r = await fetch(`/api/eslestirme/${id}/al`, { method: "POST" });
    return { durum: r.status, govde: await r.json() };
  }, ESLESME);
  ok(
    "Gizi olmayan cihaz 403 alir",
    yanit.durum === 403 && yanit.govde.tamam === false,
    JSON.stringify(yanit),
  );
  // Oturum gerektiren bir sayfaya gidip gercekten girmedigini dogrula.
  await hirsiz.goto(`${T}/`, { waitUntil: "networkidle" });
  ok("Fotograf ceken cihaz GIREMEDI", hirsiz.url().includes("/giris"), hirsiz.url());
  ok(
    "Basarisiz hirsizlik eslesmeyi YAKMADI",
    sql(`SELECT "consumedAt" IS NULL FROM "DevicePairing" WHERE id='${ESLESME}';`) === "t",
    "tahtanin hakki duruyor olmali",
  );
  await hirsizB.close();
}

// --- D. Tahta kendiliginden girer ---
console.log("\nD. Tahta girer");
// Tahta ekranina geri donulur: gizli cerez bu baglamda durdugu icin
// yoklayici kaldigi yerden devam eder ve oturumu alir.
await tahta.goto(`${T}/giris/qr`, { waitUntil: "networkidle" });
await tahta.waitForURL(`${T}/`, { timeout: 20000 }).catch(() => {});
ok("Tahta ana sayfaya gecti", tahta.url() === `${T}/`, tahta.url());
ok("Tahtada sinif ekrani goruluyor", (await tahta.innerText("body")).includes("Sınıflarım"));
ok(
  "Eslesme tuketildi olarak isaretlendi",
  sql(`SELECT "consumedAt" IS NOT NULL FROM "DevicePairing" WHERE id='${ESLESME}';`) === "t",
);

// --- E. Ayni QR ikinci kez kullanilamaz ---
console.log("\nE. Tek kullanimlik");
{
  const ikinciB = await tarayici.newContext();
  const ikinci = await ikinciB.newPage();
  await ikinci.goto(`${T}/giris`, { waitUntil: "networkidle" });
  const yanit = await ikinci.evaluate(async (id) => {
    const r = await fetch(`/api/eslestirme/${id}/al`, { method: "POST" });
    return { durum: r.status };
  }, ESLESME);
  ok("Tuketilmis eslesme yeniden oturum vermez", yanit.durum === 403, JSON.stringify(yanit));
  await ikinciB.close();
}
// Telefon da artik onaylayamaz.
await telefon.goto(`${T}/eslestir/${ESLESME}`, { waitUntil: "networkidle" });
ok("Kullanilmis QR icin uyari cikiyor", (await telefon.innerText("body")).includes("zaten kullanıldı"));
await tahtaB.close();

// --- F. Suresi dolmus QR reddedilir ---
console.log("\nF. Suresi dolmus QR");
{
  const { baglam, sayfa } = await tahtaAc();
  const { id } = await qrAc(sayfa);
  // Sureyi gecmise cekmek, 5 dakika beklemenin tek makul alternatifi.
  sql(`UPDATE "DevicePairing" SET "expiresAt" = now() - interval '1 minute' WHERE id='${id}';`);

  await telefon.goto(`${T}/eslestir/${id}`, { waitUntil: "networkidle" });
  ok("Suresi dolmus QR onay ekrani vermez", (await telefon.innerText("body")).includes("süresi doldu"));
  ok("Onay dugmesi yok", (await telefon.getByRole("button", { name: /Onayla/ }).count()) === 0);
  ok(
    "Suresi dolmus eslesme onaylanmadi",
    sql(`SELECT "approvedAt" IS NULL FROM "DevicePairing" WHERE id='${id}';`) === "t",
  );

  // Tahta ekrani da durumu fark edip uyarmali.
  await sayfa.waitForFunction(
    () => document.body.innerText.includes("artık geçerli değil"),
    null,
    { timeout: 10000 },
  ).catch(() => {});
  ok("Tahta 'gecerli degil' uyarisi gosterdi", (await sayfa.innerText("body")).includes("artık geçerli değil"));
  await baglam.close();
}

// --- G. Giris sonrasi QR onay sayfasina donus ---
console.log("\nG. Giristen sonra donus");
{
  const { baglam, sayfa } = await tahtaAc();
  const { id } = await qrAc(sayfa);

  // Oturumu kapali bir ogretmen telefonu QR'i okutur.
  const yeniB = await tarayici.newContext({ viewport: { width: 390, height: 844 } });
  const yeni = await yeniB.newPage();
  await yeni.goto(`${T}/eslestir/${id}`, { waitUntil: "networkidle" });
  ok("Once girise dustu", yeni.url().includes("/giris?devam="), yeni.url());

  await yeni.getByLabel("E-posta").fill("test@ornek.com");
  await yeni.getByLabel("Parola").fill("uzunparola1");
  await yeni.getByRole("button", { name: "Giriş yap" }).click();
  await yeni.waitForURL(`${T}/eslestir/${id}`, { timeout: 20000 }).catch(() => {});
  ok("Giristen sonra onay sayfasina DONDU", yeni.url() === `${T}/eslestir/${id}`, yeni.url());
  ok("Onay dugmesi geldi", (await yeni.getByRole("button", { name: /Onayla/ }).count()) === 1);

  await yeni.getByRole("button", { name: /Onayla/ }).click();
  await yeni.waitForSelector(".basari", { timeout: 15000 });
  await sayfa.waitForURL(`${T}/`, { timeout: 20000 }).catch(() => {});
  ok("Tahta bu akista da girdi", sayfa.url() === `${T}/`, sayfa.url());

  await yeniB.close();
  await baglam.close();
}

// --- H. Suresi gecmis kayitlar temizleniyor ---
console.log("\nH. Temizlik");
{
  sql(`UPDATE "DevicePairing" SET "expiresAt" = now() - interval '1 day';`);
  const oncesi = Number(eslesmeSayisi());
  const { baglam, sayfa } = await tahtaAc();
  await qrAc(sayfa);
  ok(
    "Yeni QR olusurken eski kayitlar silindi",
    Number(eslesmeSayisi()) === 1,
    `once=${oncesi} sonra=${eslesmeSayisi()}`,
  );
  await baglam.close();
}

console.log(`\n${gecti} gecti, ${kaldi} kaldi`);
await tarayici.close();
process.exit(kaldi === 0 ? 0 : 1);
