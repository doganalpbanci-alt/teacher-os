import {
  EN_KUCUK_HEDEF,
  EN_BUYUK_HEDEF,
  EN_UZUN_ODUL,
  hedefSayisiGecerliMi,
  odulGecerliMi,
  ilerlemeYuzdesi,
  hedefTamamlandiMi,
} from "../../src/lib/class-goal-rules";

let gecti = 0, kaldi = 0;
const ok = (ad: string, kosul: boolean, ayrinti = "") => {
  console.log(`${kosul ? "GECTI" : "KALDI"}  ${ad}${kosul ? "" : `  -> ${ayrinti}`}`);
  kosul ? gecti++ : kaldi++;
};

// --- Hedef sayisi gecerliligi ---
ok("Sifir gecersiz", !hedefSayisiGecerliMi(0));
ok("Negatif gecersiz", !hedefSayisiGecerliMi(-5));
ok("Ondalik gecersiz", !hedefSayisiGecerliMi(10.5));
ok("En kucuk deger gecerli", hedefSayisiGecerliMi(EN_KUCUK_HEDEF));
ok("En buyuk deger gecerli", hedefSayisiGecerliMi(EN_BUYUK_HEDEF));
ok("Siniri asan gecersiz", !hedefSayisiGecerliMi(EN_BUYUK_HEDEF + 1));
ok("Normal deger gecerli", hedefSayisiGecerliMi(100));

// --- Odul gecerliligi ---
ok("Bos odul gecersiz", !odulGecerliMi(""));
ok("Yalnizca bosluk gecersiz", !odulGecerliMi("   "));
ok("Normal odul gecerli", odulGecerliMi("Film gunu"));
ok("Sinir uzunluk gecerli", odulGecerliMi("a".repeat(EN_UZUN_ODUL)));
ok("Sinir asan gecersiz", !odulGecerliMi("a".repeat(EN_UZUN_ODUL + 1)));

// --- Ilerleme yuzdesi ---
ok("Yarisinda %50", ilerlemeYuzdesi(50, 100) === 50);
ok("Basinda %0", ilerlemeYuzdesi(0, 100) === 0);
ok("Tamaminda %100", ilerlemeYuzdesi(100, 100) === 100);
ok("Astiginda %100'de sabit kalir", ilerlemeYuzdesi(150, 100) === 100);
ok("Yuvarlama dogru", ilerlemeYuzdesi(1, 3) === 33);
ok("Hedef sifirsa %0 (bolme hatasi olmaz)", ilerlemeYuzdesi(5, 0) === 0);

// --- Tamamlanma ---
ok("Esitse tamamlandi", hedefTamamlandiMi(100, 100));
ok("Asarsa tamamlandi", hedefTamamlandiMi(120, 100));
ok("Altindaysa tamamlanmadi", !hedefTamamlandiMi(99, 100));

console.log(`\n${gecti} gecti, ${kaldi} kaldi`);
process.exit(kaldi === 0 ? 0 : 1);
