import {
  GECERLILIK_SANIYE,
  KOD_HANE,
  kodGecerliMi,
  eslesmeDurumu,
  onaylanabilirMi,
  oturumAlinabilirMi,
  sonaErmeAni,
  cereziCoz,
} from "../../src/lib/pairing-rules";
import { guvenliDevamYolu, VARSAYILAN_YOL } from "../../src/lib/devam-yolu";

let gecti = 0, kaldi = 0;
const ok = (ad: string, kosul: boolean, ayrinti = "") => {
  console.log(`${kosul ? "GECTI" : "KALDI"}  ${ad}${kosul ? "" : `  -> ${ayrinti}`}`);
  kosul ? gecti++ : kaldi++;
};

const AN = new Date("2026-09-18T12:00:00Z");
const sonra = (sn: number) => new Date(AN.getTime() + sn * 1000);

// --- Sabitler ---
ok("Gecerlilik 5 dakika", GECERLILIK_SANIYE === 300);
ok("Kod 4 haneli", KOD_HANE === 4);

// --- Kod bicimi ---
ok("4 rakam gecerli", kodGecerliMi("0000") && kodGecerliMi("4821") && kodGecerliMi("9999"));
ok("3 hane gecersiz", !kodGecerliMi("482"));
ok("5 hane gecersiz", !kodGecerliMi("48210"));
ok("Harf gecersiz", !kodGecerliMi("48a1"));
ok("Bos gecersiz", !kodGecerliMi(""));
ok("Bosluklu gecersiz", !kodGecerliMi(" 482"));

// --- Sona erme ani ---
ok("Sona erme tam 5 dk sonra", sonaErmeAni(AN).getTime() === AN.getTime() + 300_000);

// --- Durum turetme ---
const durum = (f: Partial<{ expiresAt: Date; approvedAt: Date | null; consumedAt: Date | null }>) =>
  eslesmeDurumu(
    { expiresAt: sonra(60), approvedAt: null, consumedAt: null, ...f },
    AN,
  );

ok("Yeni eslesme BEKLIYOR", durum({}) === "BEKLIYOR");
ok("Onaylanmis ONAYLANDI", durum({ approvedAt: AN }) === "ONAYLANDI");
ok("Kullanilmis KULLANILDI", durum({ approvedAt: AN, consumedAt: AN }) === "KULLANILDI");
ok("Suresi gecmis SURESI_DOLDU", durum({ expiresAt: sonra(-1) }) === "SURESI_DOLDU");
ok(
  "Tam sona erme aninda SURESI_DOLDU (sinir dahil)",
  durum({ expiresAt: AN }) === "SURESI_DOLDU",
);
ok(
  "Kullanilmis kayit suresi de gecmisse KULLANILDI der",
  durum({ expiresAt: sonra(-100), approvedAt: AN, consumedAt: AN }) === "KULLANILDI",
  "yaniltici 'suresi doldu' mesaji verilmemeli",
);
ok(
  "Onaylanmis ama suresi gecmis SURESI_DOLDU",
  durum({ expiresAt: sonra(-1), approvedAt: AN }) === "SURESI_DOLDU",
);

// --- Izin verilen gecisler ---
ok("Yalnizca BEKLIYOR onaylanabilir", onaylanabilirMi("BEKLIYOR"));
ok("ONAYLANDI tekrar onaylanamaz", !onaylanabilirMi("ONAYLANDI"));
ok("KULLANILDI onaylanamaz", !onaylanabilirMi("KULLANILDI"));
ok("SURESI_DOLDU onaylanamaz", !onaylanabilirMi("SURESI_DOLDU"));

ok("Yalnizca ONAYLANDI oturuma donusur", oturumAlinabilirMi("ONAYLANDI"));
ok("BEKLIYOR oturum vermez", !oturumAlinabilirMi("BEKLIYOR"));
ok("KULLANILDI ikinci kez oturum vermez", !oturumAlinabilirMi("KULLANILDI"));
ok("SURESI_DOLDU oturum vermez", !oturumAlinabilirMi("SURESI_DOLDU"));

// --- Cerez cozumu ---
ok("Normal cerez cozulur", JSON.stringify(cereziCoz("abc.def123")) === '{"id":"abc","giz":"def123"}');
ok("Bos cerez null", cereziCoz(undefined) === null && cereziCoz("") === null);
ok("Noktasiz cerez null", cereziCoz("abcdef") === null);
ok("Nokta ile baslayan null", cereziCoz(".giz") === null);
ok("Nokta ile biten null", cereziCoz("id.") === null);

// --- Acik yonlendirme korumasi ---
ok("Normal yol korunur", guvenliDevamYolu("/eslestir/abc") === "/eslestir/abc");
ok("Sorgulu yol korunur", guvenliDevamYolu("/sinif/1?x=2") === "/sinif/1?x=2");
ok("Bos deger ana sayfa", guvenliDevamYolu(null) === VARSAYILAN_YOL && guvenliDevamYolu("") === VARSAYILAN_YOL);
ok("Tam adres reddedilir", guvenliDevamYolu("https://baska.site/kotu") === VARSAYILAN_YOL);
ok("Protokole gore degisen adres reddedilir", guvenliDevamYolu("//baska.site") === VARSAYILAN_YOL);
ok("Ters egik cizgi reddedilir", guvenliDevamYolu("/\\baska.site") === VARSAYILAN_YOL);
ok("javascript: reddedilir", guvenliDevamYolu("javascript:alert(1)") === VARSAYILAN_YOL);
ok("Satir sonu reddedilir", guvenliDevamYolu("/a\nSet-Cookie: x") === VARSAYILAN_YOL);
ok("Giris sayfasina donus dongusu engellenir", guvenliDevamYolu("/giris") === VARSAYILAN_YOL);
ok("Giris alt yolu da engellenir", guvenliDevamYolu("/giris/qr") === VARSAYILAN_YOL);

console.log(`\n${gecti} gecti, ${kaldi} kaldi`);
process.exit(kaldi === 0 ? 0 : 1);
