import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { CEREZ_ADI, CEREZ_AYARLARI, jetonUret, jetonuCoz } from "@/lib/session";

// Giriş sistemi gelmeden önce oluşturulan geçici kaydın parola alanı. Hiçbir
// parolanın bcrypt hash'i böyle başlamaz, yani bu kayıtla giriş yapılamaz.
export const KURULUM_BEKLIYOR = "!giris-sistemi-yok";

const TUR_SAYISI = 12;
export const EN_KISA_PAROLA = 8;

export function kurulmusMu(passwordHash: string): boolean {
  return !passwordHash.startsWith(KURULUM_BEKLIYOR);
}

/** Kurulumu tamamlanmış, yani gerçekten giriş yapılabilen bir hesap var mı? */
export async function kurulumTamamlandiMi(): Promise<boolean> {
  const sayi = await prisma.teacher.count({
    where: { NOT: { passwordHash: { startsWith: KURULUM_BEKLIYOR } } },
  });
  return sayi > 0;
}

export async function parolaHashle(parola: string): Promise<string> {
  return bcrypt.hash(parola, TUR_SAYISI);
}

export async function parolaDogru(parola: string, hash: string): Promise<boolean> {
  if (!kurulmusMu(hash)) return false;
  return bcrypt.compare(parola, hash);
}

export async function oturumAc(ogretmenId: string): Promise<void> {
  const cerezler = await cookies();
  cerezler.set(CEREZ_ADI, await jetonUret(ogretmenId), CEREZ_AYARLARI);
}

export async function oturumKapat(): Promise<void> {
  const cerezler = await cookies();
  cerezler.delete(CEREZ_ADI);
}

/** Çerezdeki öğretmen id'si; oturum yoksa ya da geçersizse null. */
export async function oturumdakiOgretmenId(): Promise<string | null> {
  const cerezler = await cookies();
  return jetonuCoz(cerezler.get(CEREZ_ADI)?.value);
}
