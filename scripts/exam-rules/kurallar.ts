import {
  netHesapla, bilesenYuzdesi, bilesenPuani, sinavPuani, bilesenleriDogrula,
  girdiyiDogrula, donemBul, sablonBul, SinavKuralHatasi, type Bilesen, type BilesenGirdisi,
} from "../../src/lib/exam-rules";

let gecti = 0, kaldi = 0;
const es = (ad: string, bulunan: unknown, beklenen: unknown) => {
  const ok = JSON.stringify(bulunan) === JSON.stringify(beklenen);
  console.log(`${ok ? "GECTI" : "KALDI"}  ${ad}${ok ? "" : `  bulunan=${JSON.stringify(bulunan)} beklenen=${JSON.stringify(beklenen)}`}`);
  ok ? gecti++ : kaldi++;
};
const atar = (ad: string, f: () => void) => {
  try { f(); console.log(`KALDI  ${ad}  (hata bekleniyordu)`); kaldi++; }
  catch (e) { const ok = e instanceof SinavKuralHatasi; console.log(`${ok ? "GECTI" : "KALDI"}  ${ad}`); ok ? gecti++ : kaldi++; }
};

const puan = (id: string, name: string, weight: number, maxScore = 100): Bilesen =>
  ({ id, name, weight, maxScore, entry: "SCORE", questionCount: null, wrongDivisor: null });
const g = (o: Partial<BilesenGirdisi>): BilesenGirdisi =>
  ({ score: null, correct: null, wrong: null, blank: null, ...o });

// --- net ---
es("net: 15 dogru 3 yanlis, bolen 3 -> 14", netHesapla(15, 3, 3), 14);
es("net: yanlis goturmez -> dogru", netHesapla(15, 3, null), 15);
es("net: negatife dusmez", netHesapla(1, 30, 3), 0);

// --- MEB: yazili 50, listening 25, speaking 25 ---
const meb = [puan("y", "Yazili", 50), puan("l", "Listening", 25), puan("s", "Speaking", 25)];
const tam = new Map([["y", g({score: 80})], ["l", g({score: 60})], ["s", g({score: 40})]]);
// 0.5*80 + 0.25*60 + 0.25*40 = 40 + 15 + 10 = 65
es("MEB agirlikli puan", sinavPuani(meb, tam, 100).puan, 65);
es("MEB yuzde", sinavPuani(meb, tam, 100).yuzde, 65);

const eksik = new Map([["y", g({score: 80})], ["l", g({score: 60})]]);
es("MEB eksik bilesen -> puan yok", sinavPuani(meb, eksik, 100).puan, null);
es("MEB eksik bilesen sayisi", sinavPuani(meb, eksik, 100).eksikBilesen, 1);
es("MEB sifir bir karardir, eksik degil",
   sinavPuani(meb, new Map([["y", g({score:80})],["l",g({score:60})],["s",g({score:0})]]), 100).puan, 55);

// --- Oxford: tek puan, 100 uzerinde DEGIL ---
const oxford = [puan("p", "Puan", 100, 60)];
const ox = new Map([["p", g({score: 45})]]);
es("Oxford ham puan 45/60 geri geliyor", sinavPuani(oxford, ox, 60).puan, 45);
es("Oxford yuzdesi 75", sinavPuani(oxford, ox, 60).yuzde, 75);

// --- farkli tam puanli bilesenler ---
const karisik = [puan("y","Yazili",50,100), puan("s","Speaking",50,20)];
// yazili 50/100 = %50 ; speaking 10/20 = %50 -> %50
es("farkli tam puanlar yuzde uzerinden toplaniyor",
   sinavPuani(karisik, new Map([["y",g({score:50})],["s",g({score:10})]]), 100).puan, 50);

// --- tarama / net ---
const tarama: Bilesen[] = [{ id:"n", name:"Net", weight:100, maxScore:100, entry:"NET", questionCount:20, wrongDivisor:3 }];
// 15 dogru 3 yanlis -> net 14 -> 14/20 = %70
es("tarama net -> yuzde", bilesenYuzdesi(tarama[0], g({correct:15, wrong:3})), 70);
es("tarama net -> puan", bilesenPuani(tarama[0], g({correct:15, wrong:3})), 70);
es("tarama sinav puani", sinavPuani(tarama, new Map([["n", g({correct:15,wrong:3})]]), 100).puan, 70);
es("tarama: dogru girilmemis -> null", bilesenYuzdesi(tarama[0], g({wrong:3})), null);

// --- dogrulama ---
atar("agirlik toplami 100 degil", () => bilesenleriDogrula([
  { name:"A", weight:50, maxScore:100, entry:"SCORE", questionCount:null, wrongDivisor:null }]));
atar("bilesensiz sinav", () => bilesenleriDogrula([]));
atar("NET bileseninde soru sayisi yok", () => bilesenleriDogrula([
  { name:"Net", weight:100, maxScore:100, entry:"NET", questionCount:null, wrongDivisor:3 }]));
atar("puan tam puani asiyor", () => girdiyiDogrula(puan("p","Puan",100,60), g({score:75})));
atar("dogru+yanlis+bos soru sayisini asiyor",
     () => girdiyiDogrula(tarama[0], g({correct:15, wrong:5, blank:5})));

// --- donem ---
es("Ekim 2026 -> 2026-2027 1. donem", donemBul(new Date("2026-10-15T00:00:00Z")).etiket, "2026-2027 · 1. dönem");
es("Ocak 2027 -> hala 1. donem", donemBul(new Date("2027-01-20T00:00:00Z")).etiket, "2026-2027 · 1. dönem");
es("Subat 2027 -> 2. donem", donemBul(new Date("2027-02-10T00:00:00Z")).etiket, "2026-2027 · 2. dönem");
es("Mayis 2027 -> 2. donem", donemBul(new Date("2027-05-10T00:00:00Z")).etiket, "2026-2027 · 2. dönem");
es("Eylul 2027 -> yeni yil 1. donem", donemBul(new Date("2027-09-10T00:00:00Z")).etiket, "2027-2028 · 1. dönem");

// --- sablon ---
es("MEB sablonu agirliklari", sablonBul("meb")!.bilesenler.map(b => b.weight), [50,25,25]);
es("MEB sablonu resmi", sablonBul("meb")!.scope, "OFFICIAL");
es("tarama sablonu yanlis boleni", sablonBul("tarama")!.bilesenler[0].wrongDivisor, 3);
sablonBul("meb") && bilesenleriDogrula(sablonBul("meb")!.bilesenler);
sablonBul("tek-puan") && bilesenleriDogrula(sablonBul("tek-puan")!.bilesenler);
sablonBul("tarama") && bilesenleriDogrula(sablonBul("tarama")!.bilesenler);
console.log("GECTI  butun sablonlar kendi dogrulamasindan geciyor"); gecti++;

console.log(`\n=== SONUC: ${gecti} gecti, ${kaldi} kaldi ===`);
process.exit(kaldi > 0 ? 1 : 0);
