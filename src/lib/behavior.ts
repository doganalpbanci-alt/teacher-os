import { prisma } from "@/lib/prisma";
import type { BehaviorTemplate } from "@prisma/client";

// Kart şablonunun puan sabitleri. Basit şablonda kayıtlar performans notunu
// değiştirmez; not öğretmen tarafından elle girilir.
export const BASLANGIC_PUANI = 90;
export const PLUS_PUAN = 1;
export const MINUS_PUAN = -5;
// Kartların kendisi puan taşımaz; ceza ayrı MINUS kaydıyla verilir.
export const KART_PUAN = 0;
// Basit şablonda her kayıt nötrdür.
export const NOTR_PUAN = 0;

// Basit şablonda artı/eksi, kart şablonunda artı/ihlal kullanılır.
export type Eylem = "PLUS" | "MINUS" | "IHLAL";
export type KartDurumu = "SARI" | "KIRMIZI";

// Kural ihlali sayılan kayıt türleri. Kart durumu bunlara bakılarak bulunur.
const IHLAL_TURLERI = ["YELLOW_CARD", "RED_CARD"] as const;

const SABLON_EYLEMLERI: Record<BehaviorTemplate, readonly Eylem[]> = {
  SIMPLE: ["PLUS", "MINUS"],
  CARD: ["PLUS", "IHLAL"],
};

export class DavranisHatasi extends Error {}

export function eylemGecerliMi(sablon: BehaviorTemplate, eylem: string): eylem is Eylem {
  return (SABLON_EYLEMLERI[sablon] as readonly string[]).includes(eylem);
}

/**
 * Bir dersteki kart durumları. Yalnızca verilen dersin kayıtlarına bakar;
 * bu yüzden sarı kart sonraki derse taşınmaz. Geçmiş kayıtlara dokunulmaz,
 * sıfırlama diye bir yazma işlemi yoktur.
 */
export async function dersKartDurumlari(
  dersId: string,
): Promise<Map<string, KartDurumu>> {
  const kayitlar = await prisma.behaviorLog.findMany({
    where: { lessonId: dersId, type: { in: [...IHLAL_TURLERI] } },
    select: { studentId: true, type: true },
  });

  const durumlar = new Map<string, KartDurumu>();
  for (const kayit of kayitlar) {
    if (kayit.type === "RED_CARD") durumlar.set(kayit.studentId, "KIRMIZI");
    else if (!durumlar.has(kayit.studentId)) durumlar.set(kayit.studentId, "SARI");
  }
  return durumlar;
}

export type Sayimlar = { arti: number; eksi: number };

/** Öğrencilerin toplam artı ve eksi sayıları. Basit şablonda not bunlara bakılarak verilir. */
export async function ogrenciSayimlari(
  ogrenciIdleri: string[],
): Promise<Map<string, Sayimlar>> {
  const sayimlar = new Map<string, Sayimlar>();
  if (ogrenciIdleri.length === 0) return sayimlar;

  const gruplar = await prisma.behaviorLog.groupBy({
    by: ["studentId", "type"],
    where: { studentId: { in: ogrenciIdleri } },
    _count: { _all: true },
  });

  for (const grup of gruplar) {
    const mevcut = sayimlar.get(grup.studentId) ?? { arti: 0, eksi: 0 };
    // Kırmızı kart zaten yanında bir MINUS kaydı üretir; iki kez sayılmaması
    // için burada yalnızca PLUS ve MINUS sayılır.
    if (grup.type === "PLUS") mevcut.arti += grup._count._all;
    else if (grup.type === "MINUS") mevcut.eksi += grup._count._all;
    sayimlar.set(grup.studentId, mevcut);
  }
  return sayimlar;
}

/**
 * Davranış kaydı oluşturur.
 *
 * Basit şablon: PLUS ve MINUS nötr kayıtlardır, performans notuna dokunmaz.
 * Kart şablonu: PLUS +1; IHLAL derste ilkse sarı kart (puan etkisi yok),
 * tekrar edense kırmızı kart + MINUS (-5). Not loglardan yeniden toplanır.
 */
export async function davranisKaydet(
  ogrenciId: string,
  dersId: string,
  eylem: Eylem,
  sablon: BehaviorTemplate,
): Promise<void> {
  if (!eylemGecerliMi(sablon, eylem)) {
    throw new DavranisHatasi("Bu davranış türü seçili sistemde kullanılmıyor.");
  }

  await prisma.$transaction(async (tx) => {
    const ders = await tx.lesson.findUnique({
      where: { id: dersId },
      select: { classroomId: true, classroom: { select: { teacherId: true } } },
    });
    if (!ders) throw new DavranisHatasi("Ders bulunamadı.");

    const ogrenci = await tx.student.findUnique({
      where: { id: ogrenciId },
      select: { classroomId: true },
    });
    if (!ogrenci) throw new DavranisHatasi("Öğrenci bulunamadı.");
    if (ogrenci.classroomId !== ders.classroomId) {
      throw new DavranisHatasi("Öğrenci bu dersin sınıfına ait değil.");
    }

    const ortak = {
      studentId: ogrenciId,
      lessonId: dersId,
      classroomId: ders.classroomId,
      teacherId: ders.classroom.teacherId,
    };

    if (sablon === "SIMPLE") {
      await tx.behaviorLog.create({
        data: {
          ...ortak,
          type: eylem === "PLUS" ? "PLUS" : "MINUS",
          points: NOTR_PUAN,
        },
      });
      // Not elle girildiği için performansScore'a dokunulmaz.
      return;
    }

    if (eylem === "PLUS") {
      await tx.behaviorLog.create({
        data: { ...ortak, type: "PLUS", points: PLUS_PUAN },
      });
    } else {
      const oncekiIhlal = await tx.behaviorLog.count({
        where: {
          studentId: ogrenciId,
          lessonId: dersId,
          type: { in: [...IHLAL_TURLERI] },
        },
      });

      if (oncekiIhlal === 0) {
        await tx.behaviorLog.create({
          data: { ...ortak, type: "YELLOW_CARD", points: KART_PUAN },
        });
      } else {
        await tx.behaviorLog.createMany({
          data: [
            { ...ortak, type: "RED_CARD", points: KART_PUAN },
            { ...ortak, type: "MINUS", points: MINUS_PUAN },
          ],
        });
      }
    }

    // Kart şablonunda not kayıtlardan türetilir. Artırma/azaltma yerine
    // yeniden toplanır ki önbellek kaynağından kopmasın.
    const toplam = await tx.behaviorLog.aggregate({
      where: { studentId: ogrenciId },
      _sum: { points: true },
    });
    await tx.student.update({
      where: { id: ogrenciId },
      data: { performanceScore: BASLANGIC_PUANI + (toplam._sum.points ?? 0) },
    });
  });
}
