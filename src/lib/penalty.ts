import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// Arka arkaya kaçıncı kırmızı olduğuna göre ceza. Üçüncüden sonrası hep 5 dk.
const CEZA_DAKIKALARI = [2, 3, 5] as const;

// Sayaç geriye doğru bu kadar derse bakar. Bir sınıfta arka arkaya bundan
// fazla kırmızı kart alınmışsa zaten en yüksek cezadadır.
const GERIYE_BAKILAN_DERS = 40;

export function cezaDakikasi(kacinciKirmizi: number): number {
  const sira = Math.max(kacinciKirmizi, 1);
  return CEZA_DAKIKALARI[Math.min(sira, CEZA_DAKIKALARI.length) - 1];
}

/**
 * Bu kırmızı kart, arka arkaya kaçıncı? Kırmızı kart almadan geçen bir ders
 * sayacı sıfırlar; o yüzden aktif dersten geriye doğru gidilir ve ilk temiz
 * derste durulur. Aktif dersin kendisi "temiz" sayılmaz, henüz sürüyor.
 */
async function kacinciKirmizi(
  tx: Prisma.TransactionClient,
  ogrenciId: string,
  sinifId: string,
  aktifDersId: string,
): Promise<number> {
  const dersler = await tx.lesson.findMany({
    where: { classroomId: sinifId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: GERIYE_BAKILAN_DERS,
    select: { id: true },
  });

  const kirmizilar = await tx.behaviorLog.groupBy({
    by: ["lessonId"],
    where: {
      studentId: ogrenciId,
      type: "RED_CARD",
      lessonId: { in: dersler.map((d) => d.id) },
    },
    _count: { _all: true },
  });
  const sayilar = new Map(kirmizilar.map((k) => [k.lessonId, k._count._all]));

  let toplam = 0;
  for (const ders of dersler) {
    const adet = sayilar.get(ders.id) ?? 0;
    // Aktif ders sürüyor; kart yoksa da seri kırılmış sayılmaz.
    if (adet === 0 && ders.id !== aktifDersId) break;
    toplam += adet;
  }
  return toplam;
}

/**
 * Kırmızı kart verildiğinde çağrılır. Öğrencinin açık cezası varsa süresi
 * ona eklenir, yoksa yeni ceza açılır: öğretmen öğrenciyi bir kez tutar.
 */
export async function kirmiziKartCezasiEkle(
  tx: Prisma.TransactionClient,
  ogrenciId: string,
  sinifId: string,
  aktifDersId: string,
): Promise<void> {
  // Bu kart zaten yazıldıktan sonra çağrıldığı için sayım onu da kapsar.
  const sira = await kacinciKirmizi(tx, ogrenciId, sinifId, aktifDersId);
  const eklenecek = cezaDakikasi(sira) * 60;

  const acik = await tx.breakPenalty.findFirst({
    where: { studentId: ogrenciId, completedAt: null },
    orderBy: { createdAt: "asc" },
  });

  if (acik) {
    await tx.breakPenalty.update({
      where: { id: acik.id },
      data: { seconds: acik.seconds + eklenecek },
    });
  } else {
    await tx.breakPenalty.create({
      data: { studentId: ogrenciId, seconds: eklenecek },
    });
  }
}

export type CezaDurumu = {
  id: string;
  toplamSaniye: number;
  kalanSaniye: number;
  calisiyor: boolean;
};

function kalan(saniye: number, baslangic: Date | null): number {
  if (!baslangic) return saniye;
  const gecen = Math.floor((Date.now() - baslangic.getTime()) / 1000);
  return Math.max(saniye - gecen, 0);
}

/**
 * Öğrencilerin bekleyen cezaları. Süresi dolmuş cezalar burada kapatılır:
 * sayfa kapalıyken biten bir ceza aksi halde sonsuza kadar bekler görünürdü.
 */
export async function bekleyenCezalar(
  ogrenciIdleri: string[],
): Promise<Map<string, CezaDurumu>> {
  const sonuc = new Map<string, CezaDurumu>();
  if (ogrenciIdleri.length === 0) return sonuc;

  const cezalar = await prisma.breakPenalty.findMany({
    where: { studentId: { in: ogrenciIdleri }, completedAt: null },
    orderBy: { createdAt: "asc" },
  });

  const bitenler: string[] = [];
  for (const ceza of cezalar) {
    const kalanSaniye = kalan(ceza.seconds, ceza.startedAt);
    if (ceza.startedAt && kalanSaniye === 0) {
      bitenler.push(ceza.id);
      continue;
    }
    if (!sonuc.has(ceza.studentId)) {
      sonuc.set(ceza.studentId, {
        id: ceza.id,
        toplamSaniye: ceza.seconds,
        kalanSaniye,
        calisiyor: ceza.startedAt !== null,
      });
    }
  }

  if (bitenler.length > 0) {
    await prisma.breakPenalty.updateMany({
      where: { id: { in: bitenler } },
      data: { completedAt: new Date() },
    });
  }

  return sonuc;
}

export type CezaKaydi = {
  id: string;
  dakika: number;
  durum: "BEKLIYOR" | "SURUYOR" | "TAMAMLANDI";
  olusturuldu: Date;
  tamamlandi: Date | null;
};

/** Öğrencinin tüm cezaları, en yeniden eskiye. Geçmiş sayfasında listelenir. */
export async function ogrenciCezalari(ogrenciId: string): Promise<CezaKaydi[]> {
  const cezalar = await prisma.breakPenalty.findMany({
    where: { studentId: ogrenciId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return cezalar.map((ceza) => ({
    id: ceza.id,
    dakika: Math.ceil(ceza.seconds / 60),
    durum: ceza.completedAt ? "TAMAMLANDI" : ceza.startedAt ? "SURUYOR" : "BEKLIYOR",
    olusturuldu: ceza.createdAt,
    tamamlandi: ceza.completedAt,
  }));
}
