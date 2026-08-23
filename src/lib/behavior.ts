import { prisma } from "@/lib/prisma";
import type { BehaviorTemplate } from "@prisma/client";
import { kirmiziKartCezasiEkle } from "@/lib/penalty";
import {
  BASLANGIC_PUANI,
  KART_PUAN,
  MINUS_PUAN,
  NOTR_PUAN,
  PLUS_PUAN,
  eylemGecerliMi,
  type Eylem,
  type KartDurumu,
} from "@/lib/behavior-rules";

// Şablon kurallarının veritabanısız kısmı `behavior-rules.ts` içindedir; ekran
// da onu kullanır. Burası kaydı yazan taraftır. Çağıranlar tek bir yerden
// okusun diye sabitler ve tipler buradan da açılır.
export {
  BASLANGIC_PUANI,
  KART_PUAN,
  MINUS_PUAN,
  NOTR_PUAN,
  PLUS_PUAN,
  eylemGecerliMi,
} from "@/lib/behavior-rules";
export type { Eylem, KartDurumu } from "@/lib/behavior-rules";

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
 * Kart şablonu: PLUS +1; SARI_KART derste ilkse sarı kart (puan etkisi yok),
 * üstüne gelirse kırmızı kart + MINUS (-5); KIRMIZI_KART koşulsuz kırmızıdır.
 * Not loglardan yeniden toplanır.
 */
export async function davranisKaydet(
  ogrenciId: string,
  dersId: string,
  eylem: Eylem,
  sablon: BehaviorTemplate,
  ogretmenId: string,
): Promise<void> {
  if (!eylemGecerliMi(sablon, eylem)) {
    throw new DavranisHatasi("Bu davranış türü seçili sistemde kullanılmıyor.");
  }

  await prisma.$transaction(async (tx) => {
    const ders = await tx.lesson.findUnique({
      where: { id: dersId },
      select: {
        classroomId: true,
        endedAt: true,
        classroom: { select: { teacherId: true } },
      },
    });
    if (!ders) throw new DavranisHatasi("Ders bulunamadı.");
    // Baska bir ogretmenin dersine kayit yazilamaz. Kontrol en alt katmanda
    // yapilir ki hicbir cagri yolu bunu atlayamasin.
    if (ders.classroom.teacherId !== ogretmenId) {
      throw new DavranisHatasi("Bu ders size ait değil.");
    }
    // Bitmis ders gecmistir; sonradan kayit eklenirse kart kurallari ve ceza
    // sayaci gecmise dogru degisir. Ayni sebeple bu kontrol de burada durur.
    if (ders.endedAt) {
      throw new DavranisHatasi("Bu ders bitmiş. Kayıt için yeni ders başlatın.");
    }

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
      teacherId: ogretmenId,
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

    // Kırmızı kart üç şey yazar: kartın kendisi, cezası olan MINUS ve
    // teneffüs cezası. Üçü aynı transaction içindedir; biri olmadan diğeri
    // kalamaz.
    const kirmiziYaz = async () => {
      await tx.behaviorLog.createMany({
        data: [
          { ...ortak, type: "RED_CARD", points: KART_PUAN },
          { ...ortak, type: "MINUS", points: MINUS_PUAN },
        ],
      });
      await kirmiziKartCezasiEkle(tx, ogrenciId, ders.classroomId, dersId);
    };

    if (eylem === "PLUS") {
      await tx.behaviorLog.create({
        data: { ...ortak, type: "PLUS", points: PLUS_PUAN },
      });
    } else if (eylem === "KIRMIZI_KART") {
      // Doğrudan kırmızı: derste kart olup olmadığına bakılmaz.
      await kirmiziYaz();
    } else if (eylem === "SARI_KART") {
      // Sarı üstüne sarı kırmızı demektir: derste zaten kart varsa yükselir.
      const oncekiKart = await tx.behaviorLog.count({
        where: {
          studentId: ogrenciId,
          lessonId: dersId,
          type: { in: [...IHLAL_TURLERI] },
        },
      });

      if (oncekiKart === 0) {
        await tx.behaviorLog.create({
          data: { ...ortak, type: "YELLOW_CARD", points: KART_PUAN },
        });
      } else {
        await kirmiziYaz();
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
