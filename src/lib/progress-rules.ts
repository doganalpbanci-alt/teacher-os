import type { BehaviorTemplate } from "@prisma/client";

// Gelişim görünümünün veritabanına dokunmayan kısmı: eşikler, yön kararı ve
// ölçü etiketleri. `behavior-rules.ts` / `dashboard-rules.ts` ile aynı ayrım —
// sorgular `progress.ts`te, karar burada, ikisi ayrı test edilir.

/**
 * Yüzde ölçülerinde (sınav ortalaması, ödev oranı) bu kadar puandan küçük
 * fark "aynı" sayılır. Eşiksiz bir karşılaştırma %61'den %62'ye çıkışı
 * "gelişme" diye gösterir ve ok anlamını yitirir.
 */
export const YUZDE_ESIGI = 2;

/** Ders başına davranış ölçülerinde aynı işi gören eşik. */
export const DERS_BASI_ESIGI = 0.1;

/**
 * Kayan nokta payı. `0.6 - 0.5` ikili tabanda tam 0.1 etmez, 0.09999999999999998
 * eder; bu pay olmadan TAM eşikteki bir değişim sessizce "aynı" sayılırdı.
 * Değerler iki basamağa yuvarlanmış olduğu için bu kadar küçük bir pay
 * gerçek bir farkı asla yutmaz.
 */
const PAY = 1e-9;

export type Yon = "YUKSELDI" | "DUSTU" | "AYNI" | "YETERSIZ";

/**
 * Bir ölçüde hangi yönün iyi olduğu. Eksi/kart sayısı DÜŞTÜĞÜNDE iyileşme
 * vardır; bu ayrım olmasaydı "eksi azaldı" ekranda kırmızı görünürdü.
 */
export type IyiYon = "ARTIS" | "AZALIS";

export type Degisim = {
  onceki: number | null;
  simdi: number | null;
  /** simdi - onceki; iki dönemden biri boşsa null. */
  fark: number | null;
  yon: Yon;
  /** Yön iyi tarafa mı gitti. AYNI ve YETERSIZ'de null. */
  iyilesme: boolean | null;
};

export function degisimHesapla(
  onceki: number | null,
  simdi: number | null,
  esik: number,
  iyiYon: IyiYon,
): Degisim {
  // Karşılaştıracak iki nokta yoksa ok uydurulmaz. Tek dönemi olan bir
  // öğrenci için "yükseldi" demek, olmayan bir bilgiyi uydurmak olurdu.
  if (onceki === null || simdi === null) {
    return { onceki, simdi, fark: null, yon: "YETERSIZ", iyilesme: null };
  }

  const fark = simdi - onceki;
  if (Math.abs(fark) + PAY < esik) {
    return { onceki, simdi, fark, yon: "AYNI", iyilesme: null };
  }

  const yon: Yon = fark > 0 ? "YUKSELDI" : "DUSTU";
  const iyilesme = iyiYon === "ARTIS" ? fark > 0 : fark < 0;
  return { onceki, simdi, fark, yon, iyilesme };
}

export type OlcuAnahtari = "SINAV" | "ARTI" | "EKSI" | "ODEV";

export const OLCU_IYI_YON: Record<OlcuAnahtari, IyiYon> = {
  SINAV: "ARTIS",
  ARTI: "ARTIS",
  EKSI: "AZALIS",
  ODEV: "ARTIS",
};

/**
 * Ölçü adları şablona göre değişir: kayıt tipi aynı (PLUS/MINUS), değişen
 * yalnızca öğretmenin ona ne dediği. `OLAY_GORUNUMU` ile aynı fikir.
 */
export const OLCU_ADI: Record<BehaviorTemplate, Record<OlcuAnahtari, string>> = {
  SIMPLE: { SINAV: "Karne ortalaması", ARTI: "Artı", EKSI: "Eksi", ODEV: "Ödev tamamlama" },
  CARD: { SINAV: "Karne ortalaması", ARTI: "Yıldız", EKSI: "Kart", ODEV: "Ödev tamamlama" },
};

/** Gelişim kimin için hesaplanıyor. Birim buna göre değişir. */
export type Kapsam = "OGRENCI" | "SINIF";

/**
 * Davranış ölçülerinin birimi.
 *
 * Sınıfta öğrenci sayısına da bölünür: 25 kişilik bir sınıf doğal olarak
 * 10 kişilikten çok yıldız toplar. Öğrenci başına indirgeyince sayı
 * ÖĞRENCİ GELİŞİMİNDEKİYLE AYNI birime gelir — bir öğrencinin 0.6'sı
 * sınıfın 0.4'üyle doğrudan karşılaştırılabilir.
 */
export const BIRIM_ACIKLAMASI: Record<Kapsam, string> = {
  OGRENCI: "ders başına",
  SINIF: "ders başına öğrenci",
};

/** Ekranda görünen tam etiket: "Yıldız (ders başına öğrenci)" gibi. */
export function olcuEtiketi(
  anahtar: OlcuAnahtari,
  sablon: BehaviorTemplate,
  kapsam: Kapsam,
): string {
  const ad = OLCU_ADI[sablon][anahtar];
  // Yüzde ölçülerinin birimi zaten adında; parantez eklemek gürültü olurdu.
  if (anahtar === "SINAV" || anahtar === "ODEV") return ad;
  return `${ad} (${BIRIM_ACIKLAMASI[kapsam]})`;
}

/** Ham sayının yanında yazan kelime; "22 yıldız / 18 ders" gibi. */
export const OLCU_ADET_KELIMESI: Record<BehaviorTemplate, Record<OlcuAnahtari, string>> = {
  SIMPLE: { SINAV: "sınav", ARTI: "artı", EKSI: "eksi", ODEV: "ödev" },
  CARD: { SINAV: "sınav", ARTI: "yıldız", EKSI: "kart", ODEV: "ödev" },
};

export function olcuEsigi(anahtar: OlcuAnahtari): number {
  return anahtar === "SINAV" || anahtar === "ODEV" ? YUZDE_ESIGI : DERS_BASI_ESIGI;
}

/**
 * Ders başına ortalama. Ders sayısı sıfırsa null: bölme yapılmaz ve o dönem
 * "veri yok" sayılır. Ham sayıyı ders sayısına bölmek şart — 12 artı, 30
 * derslik bir dönemde ile 10 derslik bir dönemde aynı şey değildir.
 */
export function dersBasina(adet: number, dersSayisi: number): number | null {
  if (dersSayisi <= 0) return null;
  return Math.round((adet / dersSayisi) * 100) / 100;
}
