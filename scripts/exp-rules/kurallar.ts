import {
  YILDIZ_EXP,
  ODEV_TAMAMLANDI_EXP,
  ODEV_GEC_TAMAMLANDI_EXP,
  seviyeHesapla,
} from "../../src/lib/exp-rules";

let gecti = 0, kaldi = 0;
const ok = (ad: string, kosul: boolean, ayrinti = "") => {
  console.log(`${kosul ? "GECTI" : "KALDI"}  ${ad}${kosul ? "" : `  -> ${ayrinti}`}`);
  kosul ? gecti++ : kaldi++;
};

// --- Sabitler ---
ok("Yildiz EXP'i 10", YILDIZ_EXP === 10);
ok("Odev tamamlama EXP'i 20", ODEV_TAMAMLANDI_EXP === 20);
ok("Gec odev EXP'i 10, tamamdan az", ODEV_GEC_TAMAMLANDI_EXP === 10 && ODEV_GEC_TAMAMLANDI_EXP < ODEV_TAMAMLANDI_EXP);

// --- Seviye formulu: artan esik, L. seviyeye ulasmak icin 10*L*(L-1) EXP ---
{
  const s = seviyeHesapla(0);
  ok("0 EXP'de seviye 1", s.seviye === 1, JSON.stringify(s));
  ok("0 EXP'de bu seviyede kazanilan 0", s.buSeviyedeKazanilan === 0);
  ok("0 EXP'de sonraki seviye icin 20 gerekir", s.sonrakiSeviyeIcinGereken === 20);
  ok("0 EXP'de yuzde 0", s.yuzde === 0);
}
{
  const s = seviyeHesapla(19);
  ok("19 EXP'de hala seviye 1", s.seviye === 1, JSON.stringify(s));
  ok("19 EXP'de yuzde 95", s.yuzde === 95, JSON.stringify(s));
}
{
  const s = seviyeHesapla(20);
  ok("20 EXP'de seviye 2'ye atlar", s.seviye === 2, JSON.stringify(s));
  ok("Seviye 2'de sonraki icin 40 gerekir", s.sonrakiSeviyeIcinGereken === 40);
  ok("Tam esikte yuzde 0'dan basliyor", s.yuzde === 0);
}
{
  const s = seviyeHesapla(59);
  ok("59 EXP'de hala seviye 2", s.seviye === 2, JSON.stringify(s));
  ok("59 EXP'de yuzde 98", s.yuzde === 98, JSON.stringify(s));
}
{
  const s = seviyeHesapla(60);
  ok("60 EXP'de seviye 3", s.seviye === 3, JSON.stringify(s));
  ok("Seviye 3'te sonraki icin 60 gerekir", s.sonrakiSeviyeIcinGereken === 60);
}
{
  const s = seviyeHesapla(120);
  ok("120 EXP'de seviye 4", s.seviye === 4, JSON.stringify(s));
  ok("Seviye 4'te sonraki icin 80 gerekir (artan esik)", s.sonrakiSeviyeIcinGereken === 80);
}
{
  const s = seviyeHesapla(200);
  ok("200 EXP'de seviye 5", s.seviye === 5, JSON.stringify(s));
  ok("Her seviyede artis miktari buyuyor (esik artan)", s.sonrakiSeviyeIcinGereken === 100);
}

console.log(`\n${gecti} gecti, ${kaldi} kaldi`);
process.exit(kaldi === 0 ? 0 : 1);
