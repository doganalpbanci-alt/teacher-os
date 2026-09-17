// Panelin veritabanına dokunmayan kısmı: zaman penceresi ve "dikkat gereken
// öğrenci" eşikleri. `behavior-rules.ts` / `exp-rules.ts` ile aynı ayrım —
// sorgular `dashboard.ts`te, karar burada, ikisi ayrı test edilir.

/** Panelin bütün sayıları bu kayan pencereye göre hesaplanır. */
export const PENCERE_GUN = 30;

/** Bu sayıda (veya daha fazla) süresi geçmiş tamamlanmamış ödev dikkat ister. */
export const GECIKMIS_ODEV_ESIGI = 2;

/** Resmî sınav ortalaması bu yüzdenin ALTINDA ise dikkat ister. */
export const DUSUK_ORTALAMA_YUZDE = 50;

/**
 * Pencerenin başlangıcı. Sunucu UTC çalışır ama pencere gün değil süre
 * tabanlı olduğu için saat dilimi sorunu doğurmaz: "şu andan 30 gün geri"
 * her yerde aynı andır.
 */
export function pencereBaslangici(simdi: Date): Date {
  return new Date(simdi.getTime() - PENCERE_GUN * 24 * 60 * 60 * 1000);
}

/** Bir öğrencinin listeye neden girdiği. Bir öğrencide birden fazla olabilir. */
export type DikkatSebebi = "DAVRANIS" | "ODEV" | "SINAV";

export const SEBEP_YAZISI: Record<DikkatSebebi, string> = {
  DAVRANIS: "davranış",
  ODEV: "ödev",
  SINAV: "sınav",
};

export type DikkatGirdisi = {
  /** Pencere içinde alınan kırmızı kart sayısı. */
  kirmiziKart: number;
  /** Pencere içindeki artı/yıldız sayısı. */
  arti: number;
  /** Pencere içindeki eksi sayısı (kırmızı kartın ürettiği MINUS hariç). */
  eksi: number;
  /** Son teslim tarihi geçmiş, hâlâ tamamlanmamış ödev sayısı. */
  gecikmisOdev: number;
  /** Pencere içindeki resmî sınav ortalaması, yüzde. Sınavı yoksa null. */
  resmiOrtalama: number | null;
};

/**
 * Bir öğrencinin dikkat sebepleri. Boş dizi dönerse öğrenci listeye girmez.
 *
 * Bilerek `Student.performanceScore` kullanılmaz: Basit şablonda o notu
 * öğretmen elle girer, kayıtlarla ilgisi yoktur — nota bakan bir kural orada
 * sessizce yanlış çalışırdı. Kayıttan saymak iki şablonda da doğrudur.
 */
export function dikkatSebepleri(girdi: DikkatGirdisi): DikkatSebebi[] {
  const sebepler: DikkatSebebi[] = [];

  if (girdi.kirmiziKart > 0 || girdi.eksi > girdi.arti) sebepler.push("DAVRANIS");
  if (girdi.gecikmisOdev >= GECIKMIS_ODEV_ESIGI) sebepler.push("ODEV");
  if (girdi.resmiOrtalama !== null && girdi.resmiOrtalama < DUSUK_ORTALAMA_YUZDE) {
    sebepler.push("SINAV");
  }

  return sebepler;
}

/**
 * Listenin sırası: çok sebebi olan üstte, eşitlikte davranışı olan üstte.
 * Öğretmenin önce bakması gereken öğrenci listenin başında durur — sınıf
 * sayfalarındaki "en düşük üstte" mantığının aynısı.
 */
export function dikkatSirasi(sebepler: DikkatSebebi[]): number {
  return sebepler.length * 10 + (sebepler.includes("DAVRANIS") ? 1 : 0);
}
