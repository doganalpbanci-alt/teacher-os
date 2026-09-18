// QR ile tahta girişinin veritabanına dokunmayan kısmı: süreler, doğrulama
// kodunun biçimi ve eşleşme durumunun kayıttan türetilmesi.
// `behavior-rules.ts` / `exp-rules.ts` ile aynı ayrım.

/**
 * QR'ın geçerlilik süresi. Öğretmenin tahtadan telefonuna dönüp okutmasına
 * yetecek kadar uzun, ekranda unutulan bir QR'ın gün boyu geçerli kalmasına
 * izin vermeyecek kadar kısa.
 */
export const GECERLILIK_SANIYE = 5 * 60;

/** Tahtada ve telefonda karşılaştırılan doğrulama kodunun hane sayısı. */
export const KOD_HANE = 4;

export const KOD_BICIMI = /^[0-9]{4}$/;

export function kodGecerliMi(kod: string): boolean {
  return KOD_BICIMI.test(kod);
}

/**
 * Eşleşmenin durumu. Veritabanında ayrı bir kolon YOK: üç zaman damgasından
 * türetilir. Sıra önemli — kullanılmış bir eşleşme, süresi de geçmiş olsa
 * "kullanıldı" sayılır; öğretmene "süresi doldu" demek yanıltıcı olurdu.
 */
export type EslesmeDurumu =
  | "BEKLIYOR"
  | "ONAYLANDI"
  | "KULLANILDI"
  | "SURESI_DOLDU";

export type EslesmeZamanlari = {
  expiresAt: Date;
  approvedAt: Date | null;
  consumedAt: Date | null;
};

export function eslesmeDurumu(
  eslesme: EslesmeZamanlari,
  simdi: Date = new Date(),
): EslesmeDurumu {
  if (eslesme.consumedAt !== null) return "KULLANILDI";
  if (eslesme.expiresAt.getTime() <= simdi.getTime()) return "SURESI_DOLDU";
  if (eslesme.approvedAt !== null) return "ONAYLANDI";
  return "BEKLIYOR";
}

/** Tahtanın oturumu alabileceği tek durum. */
export function oturumAlinabilirMi(durum: EslesmeDurumu): boolean {
  return durum === "ONAYLANDI";
}

/** Öğretmenin onaylayabileceği tek durum. */
export function onaylanabilirMi(durum: EslesmeDurumu): boolean {
  return durum === "BEKLIYOR";
}

export function sonaErmeAni(simdi: Date = new Date()): Date {
  return new Date(simdi.getTime() + GECERLILIK_SANIYE * 1000);
}

/** Tahtanın gizli çerezi. Oturum çerezinden ayrıdır ve kısa ömürlüdür. */
export const ESLESME_CEREZI = "teacher_os_eslesme";

export const ESLESME_CEREZ_AYARLARI = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: GECERLILIK_SANIYE,
} as const;

/**
 * Çerez eşleşmenin id'sini ve gizini birlikte taşır (`<id>.<giz>`). İkisi
 * ayrı çerez olsaydı biri silinip diğeri kalabilir, "gizi var ama id'si yok"
 * gibi anlamsız bir ara durum doğardı.
 *
 * Giz hex olduğu için nokta içermez; ilk noktadan bölmek yeterlidir.
 */
export function cereziCoz(deger: string | undefined): { id: string; giz: string } | null {
  if (!deger) return null;
  const ayirac = deger.indexOf(".");
  if (ayirac <= 0 || ayirac === deger.length - 1) return null;
  return { id: deger.slice(0, ayirac), giz: deger.slice(ayirac + 1) };
}
