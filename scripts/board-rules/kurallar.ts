import {
  BILDIRIM_SURESI_MS,
  SIRA_BASKISI_ESIGI,
  CHROME_KENDILIGINDEN_KAPATMA_MS,
  bildirimMetni,
  bildirimSuresi,
  buyukGosterilir,
  ekranaSabitlenmeli,
  PIP_RENGI,
  PIP_BOS_RENGI,
  PIP_BOYUTLARI,
  VARSAYILAN_PIP_BOYUTU,
  pipBoyutuCozumle,
} from "../../src/lib/board-rules";

let gecti = 0, kaldi = 0;
const ok = (ad: string, kosul: boolean, ayrinti = "") => {
  console.log(`${kosul ? "GECTI" : "KALDI"}  ${ad}${kosul ? "" : `  -> ${ayrinti}`}`);
  kosul ? gecti++ : kaldi++;
};

// --- Metin: sablona gore okunur ---
const kirmiziKart = bildirimMetni("RED_CARD", "Elif Demir", "CARD");
ok("Kart sablonu: baslik simge + ad", kirmiziKart?.baslik === "🟥 Elif Demir", String(kirmiziKart?.baslik));
ok("Kart sablonu: govde kart dili", kirmiziKart?.govde === "kırmızı kart aldı", String(kirmiziKart?.govde));

const basitArti = bildirimMetni("PLUS", "Ali Can", "SIMPLE");
ok("Basit sablon: arti", basitArti?.baslik === "+ Ali Can" && basitArti?.govde === "artı aldı", JSON.stringify(basitArti));

const kartArti = bildirimMetni("PLUS", "Ali Can", "CARD");
ok("Kart sablonu: ayni kayit yildiz okunur", kartArti?.baslik === "★ Ali Can" && kartArti?.govde === "yıldız aldı", JSON.stringify(kartArti));

// Basit sistemde sari/kirmizi kart YOKTUR. Uydurulmus bir etiket
// gostermektense hic bildirim uretmemek dogru.
ok("Basit sablonda sari kart bildirimi uretilmez", bildirimMetni("YELLOW_CARD", "Ali", "SIMPLE") === null);
ok("Basit sablonda kirmizi kart bildirimi uretilmez", bildirimMetni("RED_CARD", "Ali", "SIMPLE") === null);
// Kart sisteminde MINUS her kirmiziyla birlikte yazilir ama kendi basina
// gosterilecek bir olay degildir.
ok("Kart sablonunda MINUS bildirimi uretilmez", bildirimMetni("MINUS", "Ali", "CARD") === null);
ok("Basit sablonda MINUS bildirimi uretilir", bildirimMetni("MINUS", "Ali", "SIMPLE")?.govde === "eksi aldı");

// --- Sure: tur siralamasi ---
ok("Yildiz en kisa", BILDIRIM_SURESI_MS.PLUS === 2500, String(BILDIRIM_SURESI_MS.PLUS));
ok("Eksi yildizdan uzun", BILDIRIM_SURESI_MS.MINUS > BILDIRIM_SURESI_MS.PLUS);
ok("Sari eksiden uzun", BILDIRIM_SURESI_MS.YELLOW_CARD > BILDIRIM_SURESI_MS.MINUS);
ok("Kirmizi en uzun", BILDIRIM_SURESI_MS.RED_CARD > BILDIRIM_SURESI_MS.YELLOW_CARD);
ok(
  "Her kart turu yildizin en az iki kati durur (gorulmesi icin verilir)",
  BILDIRIM_SURESI_MS.YELLOW_CARD >= BILDIRIM_SURESI_MS.PLUS * 2 &&
    BILDIRIM_SURESI_MS.RED_CARD >= BILDIRIM_SURESI_MS.PLUS * 2,
);
// 25 Eylul'de gercek tahtada kisaltildi: kartlar ders materyalini boluyordu.
// Alt sinir da var -- cok kisalirsa sesi duyup basini kaldiran ogrenci bos
// ekran gorur, kartin butun anlami buydu.
ok("Kirmizi kart en az 6 saniye durur", BILDIRIM_SURESI_MS.RED_CARD >= 6000, String(BILDIRIM_SURESI_MS.RED_CARD));
ok("Sari kart en az 5 saniye durur", BILDIRIM_SURESI_MS.YELLOW_CARD >= 5000, String(BILDIRIM_SURESI_MS.YELLOW_CARD));

// --- Sure: sira baskisi ---
ok("Sira bosken tam sure", bildirimSuresi("RED_CARD", 0) === BILDIRIM_SURESI_MS.RED_CARD);
ok("Bir olay beklerken hala tam sure", bildirimSuresi("RED_CARD", SIRA_BASKISI_ESIGI - 1) === BILDIRIM_SURESI_MS.RED_CARD);
ok("Esikte kisalir", bildirimSuresi("RED_CARD", SIRA_BASKISI_ESIGI) === BILDIRIM_SURESI_MS.PLUS);
ok("Esigin ustunde de kisa kalir", bildirimSuresi("RED_CARD", 20) === BILDIRIM_SURESI_MS.PLUS);
ok("Sari kart da sira baskisinda kisalir", bildirimSuresi("YELLOW_CARD", 5) === BILDIRIM_SURESI_MS.PLUS);
// Yildiz zaten en kisa; `Math.min` onu daha da kisaltmamali.
ok("Yildiz sira baskisinda daha da kisalmaz", bildirimSuresi("PLUS", 99) === BILDIRIM_SURESI_MS.PLUS);
ok("Eksi sira baskisinda yildiz suresine iner", bildirimSuresi("MINUS", 2) === BILDIRIM_SURESI_MS.PLUS);

// Hicbir sure sifir ya da negatif olamaz: kutu hic gorunmeden kapanirdi.
for (const [tur, sure] of Object.entries(BILDIRIM_SURESI_MS)) {
  ok(`${tur} suresi pozitif`, sure > 0, String(sure));
}

// --- Chrome'un kendiliginden kapatmasi ---
// Bu esikten UZUN gosterilecek turlerde `requireInteraction` acilmali,
// yoksa Chrome bildirimi biz kapatmadan indirir.
// Sureler kisaltildiktan sonra HICBIR tur esigi asmiyor; yani su an
// `requireInteraction` hicbir yerde acilmiyor ve bu DOGRU durum: sayfa ici
// kutu ile isletim sistemi bildirimi ayni sure boyunca duruyor. Kural yine
// de duruyor -- biri sureyi 8 saniyenin ustune cikarirsa kendiliginden
// devreye girsin diye.
for (const [tur, sure] of Object.entries(BILDIRIM_SURESI_MS)) {
  ok(
    `${tur}: Chrome'un kendiliginden kapatma esigini asmiyor`,
    sure <= CHROME_KENDILIGINDEN_KAPATMA_MS,
    `${sure} > ${CHROME_KENDILIGINDEN_KAPATMA_MS}`,
  );
  ok(`${tur}: sabitleme gerekmiyor`, ekranaSabitlenmeli(sure) === false);
}
ok("Tam esikte sabitlenmez (esitlik yeterli degil)", ekranaSabitlenmeli(CHROME_KENDILIGINDEN_KAPATMA_MS) === false);
ok("Esigin 1ms ustu sabitlenir", ekranaSabitlenmeli(CHROME_KENDILIGINDEN_KAPATMA_MS + 1) === true);

// --- Boyut: hangi olay buyuk gosterilir ---
// Sure karariyla ayni ayrim: yildiz rutin, olumsuz olay sinifin gormesi icin.
ok("Yildiz buyutulmez", buyukGosterilir("PLUS") === false);
ok("Eksi buyutulur", buyukGosterilir("MINUS") === true);
ok("Sari kart buyutulur", buyukGosterilir("YELLOW_CARD") === true);
ok("Kirmizi kart buyutulur", buyukGosterilir("RED_CARD") === true);
// Boyut ve sure ayni ayrimi izlemeli: uzun duran her olay buyuk de gosterilir.
// Ikisi ayrismaya baslarsa biri digerini yalanlar.
for (const tur of ["PLUS", "MINUS", "YELLOW_CARD", "RED_CARD"] as const) {
  ok(
    `${tur}: boyut ve sure ayni yonde`,
    buyukGosterilir(tur) === (BILDIRIM_SURESI_MS[tur] > BILDIRIM_SURESI_MS.PLUS),
  );
}


// --- Tahta penceresi renkleri ---
// Pencere kucuk ve uzaktan bakiliyor; yazi zeminde okunabilmeli. Kontrast
// orani WCAG formuluyle hesaplanir, goz karariyla degil.
function kanal(x: number): number {
  const o = x / 255;
  return o <= 0.03928 ? o / 12.92 : Math.pow((o + 0.055) / 1.055, 2.4);
}
function parlaklik(hex: string): number {
  const s = hex.replace("#", "");
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
}
function kontrast(a: string, b: string): number {
  const x = parlaklik(a), y = parlaklik(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const tumRenkler = [...Object.entries(PIP_RENGI), ["BOS", PIP_BOS_RENGI] as const];
for (const [ad, renk] of tumRenkler) {
  const oran = kontrast(renk.zemin, renk.yazi);
  // Buyuk punto icin WCAG AA esigi 3:1; pencerede yazi zaten iri.
  ok(`${ad}: yazi zeminde okunuyor (kontrast >= 3)`, oran >= 3, `${oran.toFixed(2)}:1`);
}

// Her tur AYRI renk olmali: pencereye uzaktan bakan biri yaziyi okumadan
// renkten anlayacak. Ikisi ayni olsaydi o ayrim kaybolurdu.
const zeminler = Object.values(PIP_RENGI).map((r) => r.zemin);
ok("Her olay turunun zemini farkli", new Set(zeminler).size === zeminler.length, zeminler.join(", "));
ok(
  "Bos hali olaylarin hicbiriyle karismaz",
  !zeminler.includes(PIP_BOS_RENGI.zemin),
  PIP_BOS_RENGI.zemin,
);
// Kirmizi ile yesil klasik tuzak: farkli renkler ama parlakliklari esitse
// gri tonda (renk korlugu, solmus projeksiyon) ayirt edilemezler. Bu kontrol
// koyu bir yesile donulurse -- #15803d 1.04:1 veriyordu -- uyarir.
// ANLAMIN TASIYICISI RENK DEGIL: pencerede etiket de yazili. Bu yuzden esik
// dusuk tutuldu, renk yalnizca pekistirme.
const kirmiziYesil = kontrast(PIP_RENGI.RED_CARD.zemin, PIP_RENGI.PLUS.zemin);
ok("Kirmizi ile yesil gri tonda da ayrisiyor", kirmiziYesil > 1.3, `${kirmiziYesil.toFixed(2)}:1`);

// --- Tahta penceresi boyutlari ---
const boyutlar = Object.values(PIP_BOYUTLARI);
ok("Uc hazir boyut var", boyutlar.length === 3, String(boyutlar.length));
ok(
  "Boyutlar kucukten buyuge siralı",
  PIP_BOYUTLARI.KUCUK.genislik < PIP_BOYUTLARI.ORTA.genislik &&
    PIP_BOYUTLARI.ORTA.genislik < PIP_BOYUTLARI.BUYUK.genislik &&
    PIP_BOYUTLARI.KUCUK.yukseklik < PIP_BOYUTLARI.ORTA.yukseklik &&
    PIP_BOYUTLARI.ORTA.yukseklik < PIP_BOYUTLARI.BUYUK.yukseklik,
);
// En kucugunde bile iki satir yazi sigmali; Chrome cok kucuk pencereyi
// kendi alt sinirina ceker ama biz oraya dusurmeyelim.
ok("En kucuk boyut bile makul", PIP_BOYUTLARI.KUCUK.genislik >= 320 && PIP_BOYUTLARI.KUCUK.yukseklik >= 150);
for (const [anahtar, olcu] of Object.entries(PIP_BOYUTLARI)) {
  ok(`${anahtar}: genis-alcak oranda (yazi yatayda akar)`, olcu.genislik > olcu.yukseklik, `${olcu.genislik}x${olcu.yukseklik}`);
  ok(`${anahtar}: adi var`, olcu.ad.length > 0);
}

// Depolamadan okunan deger her zaman gecerli bir anahtara dusmeli:
// bozuk ya da eski bir deger pencereyi acilamaz hale getirmemeli.
ok("Bos deger varsayilana duser", pipBoyutuCozumle(null) === VARSAYILAN_PIP_BOYUTU);
ok("Tanimsiz metin varsayilana duser", pipBoyutuCozumle("DEVASA") === VARSAYILAN_PIP_BOYUTU);
ok("Bos metin varsayilana duser", pipBoyutuCozumle("") === VARSAYILAN_PIP_BOYUTU);
ok("Gecerli deger korunur", pipBoyutuCozumle("BUYUK") === "BUYUK");
ok("Varsayilan gercekten tabloda var", PIP_BOYUTLARI[VARSAYILAN_PIP_BOYUTU] !== undefined);

console.log(`\n${gecti} gecti, ${kaldi} kaldi\n`);
process.exit(kaldi === 0 ? 0 : 1);
