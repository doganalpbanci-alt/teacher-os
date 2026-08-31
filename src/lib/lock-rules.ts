// Tahta kilidinin saf kuralları: sınırlar ve PIN biçimi.
//
// Ayrı dosya, çünkü hem sunucu (`lock.ts`, bcrypt ve prisma ile) hem de
// tarayıcıda çalışan ayar formu aynı sayıları kullanır. `behavior-rules` ve
// `exam-rules` ile aynı ayrım: kural burada, kaydı yazan iş orada.

export const EN_KISA_PIN = 4;
export const EN_UZUN_PIN = 8;

/** Arka arkaya bu kadar yanlıştan sonra bir süre yeni deneme alınmaz. */
export const EN_FAZLA_YANLIS = 5;
export const BEKLEME_SANIYE = 60;

export const EN_KISA_SURE_DAKIKA = 1;
export const EN_UZUN_SURE_DAKIKA = 120;

/** PIN yalnızca rakamdan oluşur: tuş takımı da yalnızca rakam üretir. */
export function pinGecerliMi(pin: string): boolean {
  return pin.length >= EN_KISA_PIN && pin.length <= EN_UZUN_PIN && /^[0-9]+$/.test(pin);
}
