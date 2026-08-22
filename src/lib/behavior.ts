import { prisma } from "@/lib/prisma";

// CLAUDE.md: puan sabitleri tek yerden yönetilir.
export const BASLANGIC_PUANI = 90;
export const PLUS_PUAN = 1;
export const MINUS_PUAN = -5;
// Kartların kendisi puan taşımaz; ceza ayrı MINUS kaydıyla verilir.
export const KART_PUAN = 0;

export type DavranisTuru = "PLUS" | "IHLAL";
export type KartDurumu = "SARI" | "KIRMIZI";

// Kural ihlali sayılan kayıt türleri. Kart durumu bunlara bakılarak bulunur.
const IHLAL_TURLERI = ["YELLOW_CARD", "RED_CARD"] as const;

export class DavranisHatasi extends Error {}

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

/**
 * Davranış kaydı oluşturur ve öğrencinin puanını günceller.
 *
 * PLUS  → +1 puanlık tek kayıt.
 * IHLAL → derste ilk ihlalse sarı kart (puan etkisi yok),
 *         tekrar eden ihlalse kırmızı kart + MINUS (-5).
 *
 * Puan artırma/azaltma ile değil, loglardan yeniden toplanarak yazılır;
 * kaynak her zaman kayıtlardır, Student üzerindeki değer önbellektir.
 */
export async function davranisKaydet(
  ogrenciId: string,
  dersId: string,
  tur: DavranisTuru,
): Promise<void> {
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

    if (tur === "PLUS") {
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
