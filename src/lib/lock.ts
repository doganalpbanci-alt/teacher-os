import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import {
  KILIT_CEREZI,
  KILIT_CEREZ_AYARLARI,
  acikKalanSaniye,
  bekleKalanSaniye,
  kilitJetonunuCoz,
  kilitJetonuUret,
  kilitKapaliMi,
  type KilitJetonu,
} from "@/lib/lock-token";
import { BEKLEME_SANIYE, EN_FAZLA_YANLIS } from "@/lib/lock-rules";

// Akıllı tahta kilidi.
//
// Amaç: tahta sınıfın önünde açıkken kart ve yıldızı yalnızca öğretmen
// verebilsin. Öğrenci düğmeyi görür, basınca PIN sorulur.
//
// PIN neden hesap parolası DEĞİL: tahtaya yazılan şey sınıfın tamamı
// tarafından görülür. Orada hesap parolası yazılırsa mesele bir karttan
// ibaret kalmaz. PIN ayrı tutulur; ele geçerse yalnızca o değiştirilir.

const TUR_SAYISI = 12;

export class KilitHatasi extends Error {}

export async function pinHashle(pin: string): Promise<string> {
  return bcrypt.hash(pin, TUR_SAYISI);
}

export async function pinDogru(pin: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(pin, hash);
}

async function jetonuOku(): Promise<KilitJetonu | null> {
  const cerezler = await cookies();
  return kilitJetonunuCoz(cerezler.get(KILIT_CEREZI)?.value);
}

async function jetonuYaz(kilit: KilitJetonu): Promise<void> {
  const cerezler = await cookies();
  cerezler.set(KILIT_CEREZI, await kilitJetonuUret(kilit), KILIT_CEREZ_AYARLARI);
}

export type KilitDurumu = {
  /** Bu cihaz bir sınıfa kilitlenmiş mi. */
  kilitli: boolean;
  sinifId: string | null;
  /** Kilitli ve açılış süresi dolmuş: yazma işlemleri reddedilir. */
  kapali: boolean;
  /** Açılışın bitmesine kalan saniye. */
  kalanSaniye: number;
  /** Yanlış denemeden sonraki beklemenin kalan saniyesi. */
  bekleSaniye: number;
};

/** Cihazın kilit durumu. Sayfalar ekranı buna göre kurar. */
export async function kilitDurumu(): Promise<KilitDurumu> {
  const kilit = await jetonuOku();
  const simdi = Date.now();
  return {
    kilitli: kilit !== null,
    sinifId: kilit?.sinifId ?? null,
    kapali: kilitKapaliMi(kilit, simdi),
    kalanSaniye: acikKalanSaniye(kilit, simdi),
    bekleSaniye: bekleKalanSaniye(kilit, simdi),
  };
}

/**
 * Yazma işlemi kilit yüzünden reddedilmeli mi.
 *
 * Server action'lar bunu kendileri çağırır. Middleware zaten kilitli cihazı
 * tek sayfaya hapsediyor, ama düğmeyi gizlemek tek başına kural değildir:
 * kuralın yazmanın yanında durması gerekir.
 */
export async function yazmaKilitli(): Promise<boolean> {
  return kilitKapaliMi(await jetonuOku());
}

/** Cihazı sınıfa kilitler. Açılış yoktur: kilit hemen devreye girer. */
export async function cihaziKilitle(sinifId: string): Promise<void> {
  await jetonuYaz({ sinifId, acikBitis: null, yanlis: 0, bekleBitis: null });
}

/** Süresi dolmadan kilidi geri kapatır. */
export async function simdiKilitle(): Promise<void> {
  const kilit = await jetonuOku();
  if (!kilit) return;
  await jetonuYaz({ ...kilit, acikBitis: null });
}

/** Kilidi cihazdan tamamen kaldırır. Ancak kilit açıkken yapılabilir. */
export async function kilidiKaldir(): Promise<void> {
  const cerezler = await cookies();
  cerezler.delete(KILIT_CEREZI);
}

/**
 * PIN'i doğrular ve doğruysa cihazı `dakika` kadar açar.
 *
 * Yanlış denemeler sayılır; `EN_FAZLA_YANLIS` sonrası kısa bir bekleme gelir.
 * Sayaç imzalı çerezde durduğu için çerezi silen sayacı sıfırlar — bu bilinen
 * bir sınır. Asıl koruma PIN'in kendisi ve rakamları karışan tuş takımı;
 * bekleme yalnızca arka arkaya denemeyi caydırır.
 */
export async function kilidiAc(pin: string, hash: string | null, dakika: number): Promise<void> {
  const kilit = await jetonuOku();
  if (!kilit) throw new KilitHatasi("Bu cihaz kilitli değil.");

  const bekle = bekleKalanSaniye(kilit);
  if (bekle > 0) {
    throw new KilitHatasi(`Çok fazla yanlış deneme. ${bekle} saniye sonra tekrar deneyin.`);
  }

  if (!(await pinDogru(pin, hash))) {
    const yanlis = kilit.yanlis + 1;
    const doldu = yanlis >= EN_FAZLA_YANLIS;
    await jetonuYaz({
      ...kilit,
      yanlis: doldu ? 0 : yanlis,
      bekleBitis: doldu ? Date.now() + BEKLEME_SANIYE * 1000 : kilit.bekleBitis,
    });
    throw new KilitHatasi(
      doldu
        ? `Çok fazla yanlış deneme. ${BEKLEME_SANIYE} saniye sonra tekrar deneyin.`
        : "PIN yanlış.",
    );
  }

  await jetonuYaz({
    sinifId: kilit.sinifId,
    acikBitis: Date.now() + dakika * 60 * 1000,
    yanlis: 0,
    bekleBitis: null,
  });
}
