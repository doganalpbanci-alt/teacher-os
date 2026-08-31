import { SignJWT, jwtVerify } from "jose";
import { imzaAnahtari } from "@/lib/session";

// Akıllı tahta kilidinin çerezde taşınan durumu.
//
// Kilit CİHAZA aittir, hesaba değil. Bu bilerek böyle: öğretmen dersi
// telefondan yönetirken tahtayı kilitli tutabilmeli. Durum çerezde durduğu
// için telefon ve tahta birbirinden habersizdir; tahtayı kilitlemek telefonu
// etkilemez.
//
// Jeton imzalıdır: içeriği okunabilir ama anahtar olmadan değiştirilemez.
// Yani "kilidi ben açtım" diye bir çerez uydurulamaz. Veritabanında tablo
// tutulmaz; oturum jetonuyla aynı yaklaşım.
//
// Bu dosya Edge'de de çalışır (middleware onu oradan okur): prisma ve bcrypt
// buraya girmez.

export const KILIT_CEREZI = "teacher_os_kilit";

const ALGORITMA = "HS256";
// Kilit, öğretmen kaldırana kadar cihazda kalmalı. Ders başına yeniden
// kurulması gereken bir kilit kullanılmazdı.
const SURE_GUN = 365;

export type KilitJetonu = {
  /** Cihazın kilitlendiği sınıf. Kilitli cihaz yalnızca bu sınıfı görebilir. */
  sinifId: string;
  /** Geçici açılışın bittiği an (ms). null ya da geçmişse cihaz kapalıdır. */
  acikBitis: number | null;
  /** Arka arkaya yanlış PIN sayısı. Doğru PIN'de sıfırlanır. */
  yanlis: number;
  /** Yeni denemeye izin verilen an (ms). null ise bekleme yok. */
  bekleBitis: number | null;
};

export async function kilitJetonuUret(kilit: KilitJetonu): Promise<string> {
  return new SignJWT({ ...kilit })
    .setProtectedHeader({ alg: ALGORITMA })
    .setIssuedAt()
    .setExpirationTime(`${SURE_GUN}d`)
    .sign(imzaAnahtari());
}

function sayiYaDaNull(deger: unknown): number | null {
  return typeof deger === "number" && Number.isFinite(deger) ? deger : null;
}

/** Jetondaki kilit durumu; imza veya süre geçersizse null. */
export async function kilitJetonunuCoz(
  jeton: string | undefined,
): Promise<KilitJetonu | null> {
  if (!jeton) return null;
  try {
    const { payload } = await jwtVerify(jeton, imzaAnahtari(), {
      algorithms: [ALGORITMA],
    });
    const sinifId = payload.sinifId;
    if (typeof sinifId !== "string" || sinifId.length === 0) return null;
    return {
      sinifId,
      acikBitis: sayiYaDaNull(payload.acikBitis),
      yanlis: sayiYaDaNull(payload.yanlis) ?? 0,
      bekleBitis: sayiYaDaNull(payload.bekleBitis),
    };
  } catch {
    return null;
  }
}

/**
 * Cihaz şu anda kapalı mı. Jeton varsa cihaz kilitlidir; geçici açılış
 * süresi dolduğunda kendiliğinden kapanır.
 *
 * Süre dolduğunda çerezi yeniden yazan bir iş YOKTUR: kapalı olmak, açılış
 * anının geçmişte kalmasıdır. Kart durumunun ders kayıtlarından hesaplanması
 * ile aynı prensip — "sıfırlama" diye bir yazma işlemi yok.
 */
export function kilitKapaliMi(kilit: KilitJetonu | null, simdi = Date.now()): boolean {
  if (!kilit) return false;
  return kilit.acikBitis === null || kilit.acikBitis <= simdi;
}

/** Açılışın bitmesine kalan saniye; kapalıysa 0. */
export function acikKalanSaniye(kilit: KilitJetonu | null, simdi = Date.now()): number {
  if (!kilit || kilit.acikBitis === null) return 0;
  return Math.max(Math.ceil((kilit.acikBitis - simdi) / 1000), 0);
}

/** Yanlış denemeden sonraki beklemenin kalan saniyesi; bekleme yoksa 0. */
export function bekleKalanSaniye(kilit: KilitJetonu | null, simdi = Date.now()): number {
  if (!kilit || kilit.bekleBitis === null) return 0;
  return Math.max(Math.ceil((kilit.bekleBitis - simdi) / 1000), 0);
}

export const KILIT_CEREZ_AYARLARI = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SURE_GUN * 24 * 60 * 60,
} as const;
