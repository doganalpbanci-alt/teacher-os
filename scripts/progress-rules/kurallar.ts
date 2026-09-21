import {
  YUZDE_ESIGI,
  DERS_BASI_ESIGI,
  degisimHesapla,
  dersBasina,
  olcuEsigi,
  OLCU_IYI_YON,
  OLCU_ADI,
  olcuEtiketi,
  BIRIM_ACIKLAMASI,
  OLCU_ADET_KELIMESI,
} from "../../src/lib/progress-rules";

let gecti = 0, kaldi = 0;
const ok = (ad: string, kosul: boolean, ayrinti = "") => {
  console.log(`${kosul ? "GECTI" : "KALDI"}  ${ad}${kosul ? "" : `  -> ${ayrinti}`}`);
  kosul ? gecti++ : kaldi++;
};

// --- Sabitler ---
ok("Yuzde esigi 2 puan", YUZDE_ESIGI === 2);
ok("Ders basi esigi 0.1", DERS_BASI_ESIGI === 0.1);
ok("Sinav ve odev yuzde esigini kullanir",
   olcuEsigi("SINAV") === YUZDE_ESIGI && olcuEsigi("ODEV") === YUZDE_ESIGI);
ok("Arti ve eksi ders basi esigini kullanir",
   olcuEsigi("ARTI") === DERS_BASI_ESIGI && olcuEsigi("EKSI") === DERS_BASI_ESIGI);

// --- Iyi yon: eksi AZALINCA iyidir ---
ok("Sinavda artis iyi", OLCU_IYI_YON.SINAV === "ARTIS");
ok("Artida artis iyi", OLCU_IYI_YON.ARTI === "ARTIS");
ok("Ekside AZALIS iyi", OLCU_IYI_YON.EKSI === "AZALIS");
ok("Odevde artis iyi", OLCU_IYI_YON.ODEV === "ARTIS");

// --- Esik tam sinirda ---
{
  const d = degisimHesapla(60, 62, YUZDE_ESIGI, "ARTIS");
  ok("Tam 2 puan fark YUKSELDI (esik dahil degil)", d.yon === "YUKSELDI", JSON.stringify(d));
  ok("Tam 2 puanda iyilesme var", d.iyilesme === true);
}
{
  const d = degisimHesapla(60, 61.9, YUZDE_ESIGI, "ARTIS");
  ok("1.9 puan fark AYNI", d.yon === "AYNI", JSON.stringify(d));
  ok("AYNI'da iyilesme null", d.iyilesme === null);
  ok("AYNI'da fark yine de hesaplanir", Math.abs((d.fark ?? 0) - 1.9) < 1e-9, String(d.fark));
}
{
  const d = degisimHesapla(60, 58, YUZDE_ESIGI, "ARTIS");
  ok("Tam -2 puan DUSTU", d.yon === "DUSTU", JSON.stringify(d));
  ok("Artis iyiyken dusus kotudur", d.iyilesme === false);
}
{
  const d = degisimHesapla(60, 60, YUZDE_ESIGI, "ARTIS");
  ok("Hic degismeyen AYNI", d.yon === "AYNI" && d.fark === 0);
}

// --- Eksi: dusus IYILESMEDIR ---
{
  const d = degisimHesapla(0.8, 0.2, DERS_BASI_ESIGI, "AZALIS");
  ok("Eksi dusunce DUSTU yonu", d.yon === "DUSTU", JSON.stringify(d));
  ok("Eksi dusunce IYILESME", d.iyilesme === true, "renk yesil olmali");
}
{
  const d = degisimHesapla(0.2, 0.8, DERS_BASI_ESIGI, "AZALIS");
  ok("Eksi artinca YUKSELDI yonu", d.yon === "YUKSELDI");
  ok("Eksi artinca KOTULESME", d.iyilesme === false, "renk kirmizi olmali");
}
{
  const d = degisimHesapla(0.50, 0.55, DERS_BASI_ESIGI, "AZALIS");
  ok("Ders basi 0.05 fark AYNI", d.yon === "AYNI", JSON.stringify(d));
}
{
  const d = degisimHesapla(0.5, 0.6, DERS_BASI_ESIGI, "AZALIS");
  ok("Ders basi tam 0.1 fark AYNI DEGIL", d.yon === "YUKSELDI", JSON.stringify(d));
}

// --- Eksik veri: ok UYDURULMAZ ---
ok("Onceki yoksa YETERSIZ", degisimHesapla(null, 70, YUZDE_ESIGI, "ARTIS").yon === "YETERSIZ");
ok("Simdi yoksa YETERSIZ", degisimHesapla(70, null, YUZDE_ESIGI, "ARTIS").yon === "YETERSIZ");
ok("Ikisi de yoksa YETERSIZ", degisimHesapla(null, null, YUZDE_ESIGI, "ARTIS").yon === "YETERSIZ");
ok("YETERSIZ'de fark null", degisimHesapla(null, 70, YUZDE_ESIGI, "ARTIS").fark === null);
ok("YETERSIZ'de iyilesme null", degisimHesapla(null, 70, YUZDE_ESIGI, "ARTIS").iyilesme === null);
ok("YETERSIZ mevcut degeri yine de tasir", degisimHesapla(null, 70, YUZDE_ESIGI, "ARTIS").simdi === 70);

// --- Ders basina: sifira bolme yok ---
ok("Ders yoksa null (sifira bolunmez)", dersBasina(5, 0) === null);
ok("Negatif ders sayisi da null", dersBasina(5, -1) === null);
ok("Hic kayit yoksa sifir", dersBasina(0, 10) === 0);
ok("22 arti / 18 ders = 1.22", dersBasina(22, 18) === 1.22, String(dersBasina(22, 18)));
ok("Iki basamaga yuvarlanir", dersBasina(1, 3) === 0.33, String(dersBasina(1, 3)));
ok(
  "Ders basina normallestirme ham sayidan FARKLI siralayabilir",
  (dersBasina(12, 30) ?? 0) < (dersBasina(10, 10) ?? 0),
  "12 arti/30 ders, 10 arti/10 dersten daha az yogundur",
);

// --- Sablona gore etiketler ---
ok("Basit sablonda 'Artı'", OLCU_ADI.SIMPLE.ARTI === "Artı");
ok("Kart sablonunda 'Yıldız'", OLCU_ADI.CARD.ARTI === "Yıldız");
ok("Basit sablonda olumsuz 'Eksi'", OLCU_ADI.SIMPLE.EKSI === "Eksi");
ok("Kart sablonunda olumsuz 'Kart'", OLCU_ADI.CARD.EKSI === "Kart");
ok("Karne etiketi iki sablonda ayni", OLCU_ADI.SIMPLE.SINAV === OLCU_ADI.CARD.SINAV);

// --- Etiket: kapsama gore birim degisir ---
ok("Ogrenci kapsaminda 'ders başına'",
   olcuEtiketi("ARTI", "SIMPLE", "OGRENCI") === "Artı (ders başına)",
   olcuEtiketi("ARTI", "SIMPLE", "OGRENCI"));
ok("Sinif kapsaminda 'ders başına öğrenci'",
   olcuEtiketi("ARTI", "CARD", "SINIF") === "Yıldız (ders başına öğrenci)",
   olcuEtiketi("ARTI", "CARD", "SINIF"));
ok("Yuzde olculerine birim eklenmez",
   olcuEtiketi("SINAV", "SIMPLE", "SINIF") === "Karne ortalaması" &&
   olcuEtiketi("ODEV", "CARD", "OGRENCI") === "Ödev tamamlama");
ok("Sinif birimi ogrenci sayisini da icerir",
   BIRIM_ACIKLAMASI.SINIF.includes("öğrenci") && !BIRIM_ACIKLAMASI.OGRENCI.includes("öğrenci"));
ok("Adet kelimesi sablona gore degisir",
   OLCU_ADET_KELIMESI.SIMPLE.ARTI === "artı" && OLCU_ADET_KELIMESI.CARD.ARTI === "yıldız");

console.log(`\n${gecti} gecti, ${kaldi} kaldi`);
process.exit(kaldi === 0 ? 0 : 1);
