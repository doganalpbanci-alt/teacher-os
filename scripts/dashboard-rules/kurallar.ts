import {
  PENCERE_GUN,
  GECIKMIS_ODEV_ESIGI,
  DUSUK_ORTALAMA_YUZDE,
  pencereBaslangici,
  dikkatSebepleri,
  dikkatSirasi,
  SEBEP_YAZISI,
  type DikkatGirdisi,
} from "../../src/lib/dashboard-rules";

let gecti = 0, kaldi = 0;
const ok = (ad: string, kosul: boolean, ayrinti = "") => {
  console.log(`${kosul ? "GECTI" : "KALDI"}  ${ad}${kosul ? "" : `  -> ${ayrinti}`}`);
  kosul ? gecti++ : kaldi++;
};

// Hicbir sebebi olmayan taban girdi; her test yalnizca ilgilendigi alani degistirir.
const temiz: DikkatGirdisi = {
  kirmiziKart: 0,
  arti: 0,
  eksi: 0,
  gecikmisOdev: 0,
  resmiOrtalama: null,
};
const sebep = (fark: Partial<DikkatGirdisi>) => dikkatSebepleri({ ...temiz, ...fark });

// --- Sabitler ---
ok("Pencere 30 gun", PENCERE_GUN === 30);
ok("Gecikmis odev esigi 2", GECIKMIS_ODEV_ESIGI === 2);
ok("Dusuk ortalama esigi %50", DUSUK_ORTALAMA_YUZDE === 50);
ok(
  "Her sebebin bir yazisi var",
  SEBEP_YAZISI.DAVRANIS === "davranış" &&
    SEBEP_YAZISI.ODEV === "ödev" &&
    SEBEP_YAZISI.SINAV === "sınav",
);

// --- Pencere baslangici ---
{
  const simdi = new Date("2026-09-17T12:00:00Z");
  const bas = pencereBaslangici(simdi);
  ok("Pencere basi tam 30 gun geride", bas.toISOString() === "2026-08-18T12:00:00.000Z", bas.toISOString());
  ok("Pencere basi simdiden once", bas.getTime() < simdi.getTime());
}

// --- Temiz ogrenci ---
ok("Hicbir sorunu olmayan ogrenci listeye girmez", sebep({}).length === 0);
ok("Yalnizca artisi olan ogrenci listeye girmez", sebep({ arti: 5 }).length === 0);

// --- Davranis kriteri ---
ok("Tek kirmizi kart davranis sebebi uretir", sebep({ kirmiziKart: 1 }).includes("DAVRANIS"));
ok(
  "Kirmizi kart, artisi cok olsa bile sebep uretir",
  sebep({ kirmiziKart: 1, arti: 50 }).includes("DAVRANIS"),
);
ok("Eksi artidan fazlaysa sebep uretir", sebep({ eksi: 3, arti: 2 }).includes("DAVRANIS"));
ok("Eksi artiya esitse sebep uretmez", sebep({ eksi: 3, arti: 3 }).length === 0);
ok("Eksi artidan azsa sebep uretmez", sebep({ eksi: 2, arti: 3 }).length === 0);
ok("Hic kaydi olmayan ogrenci (0 eksi 0 arti) sebep uretmez", sebep({ eksi: 0, arti: 0 }).length === 0);

// --- Odev kriteri: esik tam sinirda ---
ok("1 gecikmis odev yetmez", sebep({ gecikmisOdev: 1 }).length === 0);
ok("Tam 2 gecikmis odev sebep uretir", sebep({ gecikmisOdev: 2 }).includes("ODEV"));
ok("3 gecikmis odev sebep uretir", sebep({ gecikmisOdev: 3 }).includes("ODEV"));

// --- Sinav kriteri: esik tam sinirda ---
ok("Sinavi olmayan (null) sebep uretmez", sebep({ resmiOrtalama: null }).length === 0);
ok("Tam %50 sebep uretmez (esik ALTI aranir)", sebep({ resmiOrtalama: 50 }).length === 0);
ok("%49.9 sebep uretir", sebep({ resmiOrtalama: 49.9 }).includes("SINAV"));
ok("%0 sebep uretir", sebep({ resmiOrtalama: 0 }).includes("SINAV"));
ok("%80 sebep uretmez", sebep({ resmiOrtalama: 80 }).length === 0);

// --- Sebepler birikir ---
{
  const hepsi = sebep({ kirmiziKart: 1, gecikmisOdev: 2, resmiOrtalama: 30 });
  ok("Uc sebep ayni anda olabilir", hepsi.length === 3, JSON.stringify(hepsi));
  ok("Sebep sirasi sabit: davranis, odev, sinav", hepsi.join(",") === "DAVRANIS,ODEV,SINAV", hepsi.join(","));
}
{
  const ikisi = sebep({ gecikmisOdev: 2, resmiOrtalama: 10 });
  ok("Davranissiz iki sebep", ikisi.join(",") === "ODEV,SINAV", ikisi.join(","));
}

// --- Siralama: cok sebepli ustte, esitlikte davranisli ustte ---
ok(
  "Uc sebep iki sebepten once",
  dikkatSirasi(["DAVRANIS", "ODEV", "SINAV"]) > dikkatSirasi(["ODEV", "SINAV"]),
);
ok(
  "Iki sebep tek sebepten once",
  dikkatSirasi(["ODEV", "SINAV"]) > dikkatSirasi(["ODEV"]),
);
ok(
  "Esit sayida sebepte davranisli ustte",
  dikkatSirasi(["DAVRANIS", "ODEV"]) > dikkatSirasi(["ODEV", "SINAV"]),
);
ok(
  "Tek sebepte de davranis ustte",
  dikkatSirasi(["DAVRANIS"]) > dikkatSirasi(["SINAV"]),
);
ok(
  "Davranisli tek sebep, davranissiz iki sebebi GECEMEZ",
  dikkatSirasi(["DAVRANIS"]) < dikkatSirasi(["ODEV", "SINAV"]),
);

console.log(`\n${gecti} gecti, ${kaldi} kaldi`);
process.exit(kaldi === 0 ? 0 : 1);
