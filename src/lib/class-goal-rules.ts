// Sınıf hedefi kurallarının veritabanına dokunmayan kısmı: geçerlilik ve
// ilerleme hesabı. Kayıt katmanı `class-goal.ts` bunu kullanır; ekran da
// önizleme için doğrudan buradan okur — behavior-rules ile aynı ayrım.

export const EN_KUCUK_HEDEF = 1;
export const EN_BUYUK_HEDEF = 100000;
export const EN_UZUN_ODUL = 200;

export function hedefSayisiGecerliMi(deger: number): boolean {
  return Number.isInteger(deger) && deger >= EN_KUCUK_HEDEF && deger <= EN_BUYUK_HEDEF;
}

export function odulGecerliMi(odul: string): boolean {
  const kirpilmis = odul.trim();
  return kirpilmis.length > 0 && odul.length <= EN_UZUN_ODUL;
}

/** İlerleme yüzdesi, ekranda çubuk için 0-100 arasına sıkıştırılmış. */
export function ilerlemeYuzdesi(sayim: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((sayim / target) * 100));
}

export function hedefTamamlandiMi(sayim: number, target: number): boolean {
  return sayim >= target;
}
