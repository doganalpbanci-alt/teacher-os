import type { ComponentEntry, ExamScope } from "@prisma/client";

// Sınav kurallarının veritabanına dokunmayan kısmı. Not girme ekranı, öğretmen
// sayıyı yazdığı anda sonucu göstermek için aynı hesabı kullanır; kural iki
// yere kopyalanmaz. Kaydı yazan taraf `exam.ts`.
//
// Temel kural: bir sınav bileşenlerden oluşur. MEB sınavı üç bileşendir
// (Yazılı %50, Listening %25, Speaking %25); tek puanlı bir sınav tek
// bileşendir. Böylece dört ayrı sınav türü için dört ayrı model yazmak yerine
// tek mekanizma hepsini karşılar.
//
// İkinci kural: ağırlıklı hesap HAM PUANI DEĞİL YÜZDEYİ kullanır. Bileşenler
// farklı tam puanlarda olabilir ve sınavların kendisi de 100 üzerinden
// olmayabilir (Oxford sınavları çoğunlukla değil). Yüzde üzerinden gidilmezse
// 20 üzerinden bir Speaking, 100 üzerinden bir Yazılı ile toplanamaz.

/** Bileşen ağırlıklarının toplaması gereken değer. */
export const AGIRLIK_TOPLAMI = 100;

/** Yeni bir NET bileşeninde varsayılan: 3 yanlış 1 doğruyu götürür. */
export const VARSAYILAN_YANLIS_BOLENI = 3;

export class SinavKuralHatasi extends Error {}

// ---------- Şablonlar ----------

/**
 * Sınav oluştururken seçilen hazır bileşen düzeni. Şablon yalnızca formu ön
 * doldurur; bileşenler sonrasında düzenlenebilir. Kurum adları (Oxford,
 * Cambridge) bilerek şablon DEĞİLDİR: kişiye özel kurallar koda gömülmez,
 * `CLAUDE.md`'deki davranış şablonu prensibinin aynısı. Oxford sınavı "Tek
 * puan" şablonuyla, kendi tam puanı girilerek açılır.
 */
export type BilesenTanimi = {
  name: string;
  weight: number;
  maxScore: number;
  entry: ComponentEntry;
  questionCount: number | null;
  wrongDivisor: number | null;
};

export type SinavSablonu = {
  anahtar: string;
  ad: string;
  aciklama: string;
  scope: ExamScope;
  maxScore: number;
  bilesenler: BilesenTanimi[];
};

function puanBileseni(name: string, weight: number, maxScore = 100): BilesenTanimi {
  return { name, weight, maxScore, entry: "SCORE", questionCount: null, wrongDivisor: null };
}

export const SINAV_SABLONLARI: readonly SinavSablonu[] = [
  {
    anahtar: "meb",
    ad: "MEB sınavı",
    aciklama: "Karneye giren resmî sınav. Yazılı %50, Listening %25, Speaking %25.",
    scope: "OFFICIAL",
    maxScore: 100,
    bilesenler: [
      puanBileseni("Yazılı", 50),
      puanBileseni("Listening", 25),
      puanBileseni("Speaking", 25),
    ],
  },
  {
    anahtar: "tek-puan",
    ad: "Tek puan",
    aciklama:
      "Tek bir puan girilir. Tam puanı serbesttir; 100 üzerinden olmayan sınavlar için de uygundur.",
    scope: "PRACTICE",
    maxScore: 100,
    bilesenler: [puanBileseni("Puan", 100)],
  },
  {
    anahtar: "tarama",
    ad: "Tarama / deneme",
    aciklama: "Doğru ve yanlış sayısı girilir, net ve puan hesaplanır.",
    scope: "PRACTICE",
    maxScore: 100,
    bilesenler: [
      {
        name: "Net",
        weight: 100,
        maxScore: 100,
        entry: "NET",
        questionCount: 20,
        wrongDivisor: VARSAYILAN_YANLIS_BOLENI,
      },
    ],
  },
];

export function sablonBul(anahtar: string): SinavSablonu | null {
  return SINAV_SABLONLARI.find((s) => s.anahtar === anahtar) ?? null;
}

// ---------- Net ----------

/**
 * Net = doğru − yanlış / bölen. Bölen null ise yanlışlar puanı etkilemez;
 * sayıları yine de kayıtta durur, çünkü öğretmen sonradan bakmak isteyebilir.
 * Net negatife düşmez: −2 net bir puan taşımaz, sıfır taşır.
 */
export function netHesapla(
  correct: number,
  wrong: number,
  wrongDivisor: number | null,
): number {
  const ham = wrongDivisor && wrongDivisor > 0 ? correct - wrong / wrongDivisor : correct;
  return Math.max(0, ham);
}

// ---------- Bileşen yüzdesi ----------

export type Bilesen = {
  id: string;
  name: string;
  weight: number;
  maxScore: number;
  entry: ComponentEntry;
  questionCount: number | null;
  wrongDivisor: number | null;
};

/** Öğretmenin bir bileşene girdiği ham değerler. */
export type BilesenGirdisi = {
  score: number | null;
  correct: number | null;
  wrong: number | null;
  blank: number | null;
};

export const BOS_GIRDI: BilesenGirdisi = {
  score: null,
  correct: null,
  wrong: null,
  blank: null,
};

/**
 * Bir bileşenin yüzdesi (0–100). Girdi eksikse null döner — "sıfır" ile
 * "girilmedi" aynı şey değildir; sıfır bir karardır, boş bir eksikliktir.
 */
export function bilesenYuzdesi(bilesen: Bilesen, girdi: BilesenGirdisi): number | null {
  if (bilesen.entry === "NET") {
    if (girdi.correct === null || girdi.wrong === null) return null;
    const soru = bilesen.questionCount;
    if (!soru || soru <= 0) return null;
    const net = netHesapla(girdi.correct, girdi.wrong, bilesen.wrongDivisor);
    return sinirla((net / soru) * 100);
  }

  if (girdi.score === null) return null;
  if (bilesen.maxScore <= 0) return null;
  return sinirla((girdi.score / bilesen.maxScore) * 100);
}

/** Bileşenin ham puan karşılığı; not girme ekranında NET satırında gösterilir. */
export function bilesenPuani(bilesen: Bilesen, girdi: BilesenGirdisi): number | null {
  const yuzde = bilesenYuzdesi(bilesen, girdi);
  return yuzde === null ? null : yuvarla((yuzde / 100) * bilesen.maxScore);
}

function sinirla(yuzde: number): number {
  return Math.min(100, Math.max(0, yuzde));
}

/** İki ondalık. Kayan nokta artığı ekrana "84.99999999" diye düşmesin. */
export function yuvarla(deger: number): number {
  return Math.round(deger * 100) / 100;
}

// ---------- Sınav puanı ----------

export type SinavPuani = {
  /** Sınavın kendi tam puanı üzerinden sonuç. Eksik girdi varsa null. */
  puan: number | null;
  /** Yüzde karşılığı (0–100). Farklı tam puanlı sınavlar bununla karşılaştırılır. */
  yuzde: number | null;
  /** Henüz girilmemiş bileşen sayısı. 0 ise sonuç tamdır. */
  eksikBilesen: number;
};

/**
 * Bir öğrencinin sınav puanı: bileşen yüzdelerinin ağırlıklı ortalaması,
 * sınavın tam puanına ölçeklenmiş.
 *
 * Bir bileşen bile eksikse puan HESAPLANMAZ. Sebep öğretmenin gerçek akışı:
 * MEB sınavında Yazılı bugün, Speaking gelecek hafta girilir. Eksik bileşeni
 * sıfır saymak arada geçen sürede yanıltıcı bir düşük not gösterirdi. Öğrenci
 * bir bileşene gerçekten girmediyse öğretmen sıfırı kendisi yazar; sıfır bir
 * karardır ve kayıtta öyle durur.
 */
export function sinavPuani(
  bilesenler: Bilesen[],
  girdiler: Map<string, BilesenGirdisi>,
  sinavMaxScore: number,
): SinavPuani {
  if (bilesenler.length === 0) return { puan: null, yuzde: null, eksikBilesen: 0 };

  let agirlikliToplam = 0;
  let agirlikToplami = 0;
  let eksik = 0;

  for (const bilesen of bilesenler) {
    const yuzde = bilesenYuzdesi(bilesen, girdiler.get(bilesen.id) ?? BOS_GIRDI);
    if (yuzde === null) {
      eksik += 1;
      continue;
    }
    agirlikliToplam += yuzde * bilesen.weight;
    agirlikToplami += bilesen.weight;
  }

  if (eksik > 0 || agirlikToplami <= 0) {
    return { puan: null, yuzde: null, eksikBilesen: eksik };
  }

  const yuzde = yuvarla(agirlikliToplam / agirlikToplami);
  return {
    puan: yuvarla((yuzde / 100) * sinavMaxScore),
    yuzde,
    eksikBilesen: 0,
  };
}

// ---------- Doğrulama ----------

/**
 * Bileşen tanımlarının tutarlılığı. Sınav oluşturma ve düzenleme formu bunu
 * kullanır; sunucu tarafı da aynı fonksiyonu çağırır, çünkü form istemciden
 * gelir ve düğme gizlemek doğrulama değildir.
 */
export function bilesenleriDogrula(bilesenler: BilesenTanimi[]): void {
  if (bilesenler.length === 0) {
    throw new SinavKuralHatasi("Sınavın en az bir bileşeni olmalı.");
  }

  for (const b of bilesenler) {
    if (!b.name.trim()) {
      throw new SinavKuralHatasi("Bileşen adı boş olamaz.");
    }
    if (!(b.weight > 0)) {
      throw new SinavKuralHatasi(`"${b.name}" bileşeninin ağırlığı sıfırdan büyük olmalı.`);
    }
    if (!(b.maxScore > 0)) {
      throw new SinavKuralHatasi(`"${b.name}" bileşeninin tam puanı sıfırdan büyük olmalı.`);
    }
    if (b.entry === "NET" && (!b.questionCount || b.questionCount <= 0)) {
      throw new SinavKuralHatasi(`"${b.name}" bileşeninin soru sayısı girilmeli.`);
    }
    if (b.entry === "NET" && b.wrongDivisor !== null && b.wrongDivisor <= 0) {
      throw new SinavKuralHatasi(
        `"${b.name}" bileşeninde yanlış böleni sıfırdan büyük olmalı.`,
      );
    }
  }

  const toplam = yuvarla(bilesenler.reduce((t, b) => t + b.weight, 0));
  if (toplam !== AGIRLIK_TOPLAMI) {
    throw new SinavKuralHatasi(
      `Bileşen ağırlıkları toplam ${AGIRLIK_TOPLAMI} etmeli, şu an ${toplam}.`,
    );
  }
}

/** Bir öğrencinin girdisinin kendi içinde tutarlılığı. */
export function girdiyiDogrula(bilesen: Bilesen, girdi: BilesenGirdisi): void {
  if (bilesen.entry === "NET") {
    const soru = bilesen.questionCount ?? 0;
    const sayilar = [girdi.correct, girdi.wrong, girdi.blank];
    for (const sayi of sayilar) {
      if (sayi !== null && (sayi < 0 || !Number.isInteger(sayi))) {
        throw new SinavKuralHatasi(
          `"${bilesen.name}" bileşeninde soru sayıları negatif olamaz.`,
        );
      }
    }
    const toplam = (girdi.correct ?? 0) + (girdi.wrong ?? 0) + (girdi.blank ?? 0);
    if (toplam > soru) {
      throw new SinavKuralHatasi(
        `"${bilesen.name}" bileşeninde doğru+yanlış+boş toplamı ${soru} soruyu aşamaz.`,
      );
    }
    return;
  }

  if (girdi.score === null) return;
  if (girdi.score < 0) {
    throw new SinavKuralHatasi(`"${bilesen.name}" bileşeninde puan negatif olamaz.`);
  }
  if (girdi.score > bilesen.maxScore) {
    throw new SinavKuralHatasi(
      `"${bilesen.name}" bileşeninde puan en fazla ${bilesen.maxScore} olabilir.`,
    );
  }
}

// ---------- Form satırı ----------

// Bileşen düzenleyicinin satır tipi ve yardımcıları burada, bileşenin kendi
// dosyasında değil: o dosya "use client", oradan export edilen bir fonksiyonu
// sunucu bileşeni ÇAĞIRAMAZ. Sınav oluşturma sayfası (sunucu) formu ön
// doldurmak için `bosBilesen`e ihtiyaç duyuyor. Bu modül iki tarafın da
// kullanabildiği ortak katman.

export type BilesenSatiri = {
  /** Var olan bileşenin id'si; yeni satırda null. */
  id: string | null;
  name: string;
  weight: string;
  maxScore: string;
  entry: ComponentEntry;
  questionCount: string;
  wrongDivisor: string;
  /** Bu bileşende kaç öğrencinin girdisi var. Silinirse kaybolacak sayı. */
  girdiSayisi: number;
};

export function bosBilesen(): BilesenSatiri {
  return {
    id: null,
    name: "",
    weight: "",
    maxScore: "100",
    entry: "SCORE",
    questionCount: "",
    wrongDivisor: String(VARSAYILAN_YANLIS_BOLENI),
    girdiSayisi: 0,
  };
}

export function agirlikToplami(bilesenler: BilesenSatiri[]): number {
  return yuvarla(
    bilesenler.reduce((toplam, b) => {
      const deger = Number(b.weight.replace(",", "."));
      return toplam + (Number.isFinite(deger) ? deger : 0);
    }, 0),
  );
}

// ---------- Dönem ----------

/**
 * Dönem, sınavın tarihinden türetilir; ayrı bir tablo yoktur. Türk okul
 * takviminde 1. dönem Eylül'de başlar, 2. dönem Şubat'ta. Sınırlar burada
 * merkezî sabit olarak durur: okula göre birkaç gün kayabilir ama sınav
 * tarihleri dönem ortasına düştüğü için ayrım pratikte netliğini korur.
 *
 * İleride öğretmenin kendi tarihlerini girmesi gerekirse burası bir tabloya
 * dönüşür; çağıran taraflar yalnızca bu fonksiyonu kullandığı için o değişim
 * tek dosyada kalır.
 */
export const IKINCI_DONEM_BASLANGIC_AYI = 2; // Şubat
export const OGRETIM_YILI_BASLANGIC_AYI = 9; // Eylül

export type Donem = {
  /** Öğretim yılının başladığı takvim yılı. 2026-2027 için 2026. */
  yil: number;
  /** 1 ya da 2. */
  sira: 1 | 2;
  etiket: string;
};

export function donemBul(tarih: Date): Donem {
  const yilNo = tarih.getUTCFullYear();
  const ay = tarih.getUTCMonth() + 1;

  // Eylül-Aralık: öğretim yılının ilk dönemi, yıl aynı.
  // Ocak: hâlâ 1. dönem ama öğretim yılı bir önceki yılda başlamıştır.
  // Şubat-Haziran: 2. dönem, öğretim yılı bir önceki yılda başlamıştır.
  if (ay >= OGRETIM_YILI_BASLANGIC_AYI) {
    return donem(yilNo, 1);
  }
  if (ay < IKINCI_DONEM_BASLANGIC_AYI) {
    return donem(yilNo - 1, 1);
  }
  return donem(yilNo - 1, 2);
}

function donem(yil: number, sira: 1 | 2): Donem {
  return { yil, sira, etiket: `${yil}-${yil + 1} · ${sira}. dönem` };
}

export function ayniDonem(a: Donem, b: Donem): boolean {
  return a.yil === b.yil && a.sira === b.sira;
}
