import {
  BILDIRIM_SURESI_MS,
  SIRA_BASKISI_ESIGI,
  CHROME_KENDILIGINDEN_KAPATMA_MS,
  bildirimMetni,
  bildirimSuresi,
  ekranaSabitlenmeli,
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
  "Her kart turu yildizin en az uc kati durur (gorulmesi icin verilir)",
  BILDIRIM_SURESI_MS.YELLOW_CARD >= BILDIRIM_SURESI_MS.PLUS * 3 &&
    BILDIRIM_SURESI_MS.RED_CARD >= BILDIRIM_SURESI_MS.PLUS * 3,
);

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
ok("Yildiz sabitlenmez", ekranaSabitlenmeli(BILDIRIM_SURESI_MS.PLUS) === false);
ok("Eksi sabitlenmez", ekranaSabitlenmeli(BILDIRIM_SURESI_MS.MINUS) === false);
ok(
  "Sari tam esikte sabitlenmez (esitlik yeterli degil)",
  BILDIRIM_SURESI_MS.YELLOW_CARD === CHROME_KENDILIGINDEN_KAPATMA_MS &&
    ekranaSabitlenmeli(BILDIRIM_SURESI_MS.YELLOW_CARD) === false,
);
ok("Kirmizi sabitlenir", ekranaSabitlenmeli(BILDIRIM_SURESI_MS.RED_CARD) === true);
ok("Esigin 1ms ustu sabitlenir", ekranaSabitlenmeli(CHROME_KENDILIGINDEN_KAPATMA_MS + 1) === true);

console.log(`\n${gecti} gecti, ${kaldi} kaldi\n`);
process.exit(kaldi === 0 ? 0 : 1);
