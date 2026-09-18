import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  eslesmeDurumu,
  onaylanabilirMi,
  oturumAlinabilirMi,
  sonaErmeAni,
  KOD_HANE,
  type EslesmeDurumu,
} from "@/lib/pairing-rules";

// QR ile tahta girişinin kayıt katmanı.
//
// Tehdit: QR kodu sınıfın tamamı görür ve fotoğraflayabilir. QR yalnızca
// eşleşmenin herkese açık id'sini taşır. Asıl koruma, eşleşme oluşturulurken
// TAHTANIN tarayıcısına yazılan gizli değerdir (`verifier`): veritabanında
// yalnızca SHA-256 özeti durur ve oturum ancak gizi geri getirebilen tarayıcıya
// verilir. Fotoğrafı çeken cihazda o çerez yoktur.
//
// Doğrulama kodu ise ters yöndeki riski kapatır: öğretmenin, öğrencinin kendi
// ekranındaki bir QR'ı yanlışlıkla onaylaması. Tahtada yazan kod telefonda da
// görünür, öğretmen bakarak onaylar.

/** Gizin uzunluğu. Tahmin edilebilir olmaması dışında bir anlamı yok. */
const GIZ_BAYT = 32;

function ozet(giz: string): string {
  return createHash("sha256").update(giz).digest("hex");
}

/**
 * Özetleri sabit sürede karşılaştırır. İkisi de hex özet olduğu için uzunluk
 * eşittir; yine de farklı uzunlukta girdi gelirse `timingSafeEqual` istisna
 * atacağından önce uzunluk bakılır.
 */
function ozetEsitMi(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

function kodUret(): string {
  const enBuyuk = 10 ** KOD_HANE;
  return String(randomInt(0, enBuyuk)).padStart(KOD_HANE, "0");
}

export type YeniEslesme = {
  id: string;
  /** Tahtanın çerezine yazılacak giz. Bir daha asla okunamaz. */
  giz: string;
  code: string;
  expiresAt: Date;
};

/**
 * Yeni eşleşme açar. Oturum GEREKTİRMEZ: bunu isteyen taraf henüz giriş
 * yapmamış olan tahtadır.
 *
 * Süresi geçmiş kayıtlar aynı işlemde silinir. Ayrı bir temizlik işi yok:
 * eşleşme kayıtları yalnızca giriş anında üretilir, sayıları küçüktür ve
 * süresi geçmiş bir kayıt hiçbir işe yaramaz.
 */
export async function eslesmeOlustur(): Promise<YeniEslesme> {
  const giz = randomBytes(GIZ_BAYT).toString("hex");
  const expiresAt = sonaErmeAni();

  await prisma.devicePairing.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  const eslesme = await prisma.devicePairing.create({
    data: { verifierHash: ozet(giz), code: kodUret(), expiresAt },
    select: { id: true, code: true, expiresAt: true },
  });

  return { id: eslesme.id, giz, code: eslesme.code, expiresAt };
}

export type EslesmeGorunumu = {
  id: string;
  code: string;
  durum: EslesmeDurumu;
  expiresAt: Date;
};

/**
 * Eşleşmenin durumu. Gizi İSTEMEZ: bu, onay ekranının ve yoklamanın okuduğu
 * bilgidir, içinde oturuma dönüşecek bir şey yoktur. Kod da burada döner —
 * öğretmen onu tahtayla karşılaştıracak.
 */
export async function eslesmeyiGetir(id: string): Promise<EslesmeGorunumu | null> {
  const eslesme = await prisma.devicePairing.findUnique({
    where: { id },
    select: { id: true, code: true, expiresAt: true, approvedAt: true, consumedAt: true },
  });
  if (!eslesme) return null;

  return {
    id: eslesme.id,
    code: eslesme.code,
    durum: eslesmeDurumu(eslesme),
    expiresAt: eslesme.expiresAt,
  };
}

export type OnaySonucu = "TAMAM" | "BULUNAMADI" | "GECERSIZ_DURUM";

/**
 * Öğretmen tahtadaki oturumu onaylar. Oturum bu öğretmen için açılacaktır.
 *
 * Yalnızca BEKLIYOR durumundaki eşleşme onaylanır: süresi geçmiş ya da zaten
 * kullanılmış bir eşleşme yeniden onaylanamaz.
 */
export async function eslesmeyiOnayla(
  id: string,
  ogretmenId: string,
): Promise<OnaySonucu> {
  const eslesme = await prisma.devicePairing.findUnique({
    where: { id },
    select: { expiresAt: true, approvedAt: true, consumedAt: true },
  });
  if (!eslesme) return "BULUNAMADI";
  if (!onaylanabilirMi(eslesmeDurumu(eslesme))) return "GECERSIZ_DURUM";

  // Koşullu yazma: iki onay aynı anda gelirse ikincisi hiçbir satır
  // güncellemez, "zaten onaylanmış" sayılır.
  const sonuc = await prisma.devicePairing.updateMany({
    where: { id, approvedAt: null, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { approvedAt: new Date(), teacherId: ogretmenId },
  });
  return sonuc.count === 1 ? "TAMAM" : "GECERSIZ_DURUM";
}

export type OturumAlmaSonucu =
  | { tamam: true; ogretmenId: string }
  | { tamam: false; sebep: "BULUNAMADI" | "GIZ_YANLIS" | "GECERSIZ_DURUM" };

/**
 * Tahta, onaylanmış eşleşmenin oturumunu alır. ASIL KORUMA BURADA:
 *
 * - Giz doğrulanır. QR'ın fotoğrafını çeken cihazda bu çerez yoktur, eşleşme
 *   onaylanmış olsa bile oturumu alamaz.
 * - Tek kullanımlıktır: `consumedAt` koşullu yazmayla konur, aynı eşleşmeyle
 *   ikinci bir oturum açılamaz.
 */
export async function oturumuAl(id: string, giz: string | undefined): Promise<OturumAlmaSonucu> {
  if (!giz) return { tamam: false, sebep: "GIZ_YANLIS" };

  const eslesme = await prisma.devicePairing.findUnique({
    where: { id },
    select: {
      verifierHash: true,
      teacherId: true,
      expiresAt: true,
      approvedAt: true,
      consumedAt: true,
    },
  });
  if (!eslesme) return { tamam: false, sebep: "BULUNAMADI" };

  // Giz kontrolü durumdan ÖNCE: yanlış gizle gelen taraf, eşleşmenin
  // onaylanıp onaylanmadığını da öğrenemesin.
  if (!ozetEsitMi(eslesme.verifierHash, ozet(giz))) {
    return { tamam: false, sebep: "GIZ_YANLIS" };
  }

  if (!oturumAlinabilirMi(eslesmeDurumu(eslesme)) || !eslesme.teacherId) {
    return { tamam: false, sebep: "GECERSIZ_DURUM" };
  }

  const sonuc = await prisma.devicePairing.updateMany({
    where: { id, consumedAt: null, approvedAt: { not: null }, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });
  if (sonuc.count !== 1) return { tamam: false, sebep: "GECERSIZ_DURUM" };

  return { tamam: true, ogretmenId: eslesme.teacherId };
}
