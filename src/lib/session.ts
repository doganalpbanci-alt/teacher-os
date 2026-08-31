import { SignJWT, jwtVerify } from "jose";

// Oturum çerezde taşınır, veritabanında tablo tutulmaz. Çerez imzalıdır:
// içeriği okunabilir ama anahtar olmadan değiştirilemez.
export const CEREZ_ADI = "teacher_os_oturum";

const SURE_GUN = 30;
const ALGORITMA = "HS256";

/**
 * İmzalama anahtarı. Eksikse uygulama zayıf bir varsayılana düşmez, hata
 * verir: sessizce imzasız çalışan bir oturum, oturum olmamasından kötüdür.
 *
 * Tahta kilidinin jetonu da (`lock-token.ts`) aynı anahtarla imzalanır;
 * ikisi de çerezde taşınan, kısa ömürlü, sunucunun ürettiği verilerdir.
 */
export function imzaAnahtari(): Uint8Array {
  const gizli = process.env.SESSION_SECRET;
  if (!gizli || gizli.length < 32) {
    throw new Error(
      "SESSION_SECRET tanımlı değil ya da 32 karakterden kısa. " +
        "Vercel > Settings > Environment Variables altına ekleyin.",
    );
  }
  return new TextEncoder().encode(gizli);
}

export async function jetonUret(ogretmenId: string): Promise<string> {
  return new SignJWT({ oid: ogretmenId })
    .setProtectedHeader({ alg: ALGORITMA })
    .setIssuedAt()
    .setExpirationTime(`${SURE_GUN}d`)
    .sign(imzaAnahtari());
}

/** Jetondaki öğretmen id'si; imza veya süre geçersizse null. */
export async function jetonuCoz(jeton: string | undefined): Promise<string | null> {
  if (!jeton) return null;
  try {
    const { payload } = await jwtVerify(jeton, imzaAnahtari(), { algorithms: [ALGORITMA] });
    const oid = payload.oid;
    return typeof oid === "string" && oid.length > 0 ? oid : null;
  } catch {
    return null;
  }
}

export const CEREZ_AYARLARI = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SURE_GUN * 24 * 60 * 60,
} as const;
