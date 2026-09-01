import { prisma } from "@/lib/prisma";
import type { BehaviorType } from "@prisma/client";

// Tahtanın canlı yayınının veri kaynağı. Telefondan verilen bir kart, tahtayı
// açık tutan cihaz tarafından buradan öğrenilir (yoklama ile, websocket değil
// — bkz. HANDOFF: veritabanına doğrudan tarayıcı erişimi vermek sahiplik
// kuralında delik açardı).

export type TahtaOlayi = {
  id: string;
  tur: BehaviorType;
  ogrenciAdi: string;
};

export type OlaySonucu = {
  olaylar: TahtaOlayi[];
  /** Bir sonraki yoklamada `sonrasi` olarak gönderilecek zaman; olay yoksa null. */
  sonKontrol: string | null;
};

/**
 * Bir dersin, verilen andan sonraki davranış kayıtları.
 *
 * Sahiplik sorgunun parçası: ders başka bir öğretmene aitse ya da hiç yoksa
 * sessizce boş döner — "bulunamadı" hatası bile vermez, çünkü bu bir okuma
 * uç noktasıdır ve varlığını sızdırmamalıdır.
 *
 * Kırmızı kart aynı anda bir MINUS de yazar (ceza puanı); ikisi tek öğretmen
 * eylemidir, ikinci bir bildirime çevrilmez. İkisi `davranisKaydet` içinde
 * tek `createMany` ile yazıldığı için aynı `createdAt`'i taşır; eşleştirme
 * bunun üzerinden yapılır.
 */
export async function dersOlaylari(
  dersId: string,
  ogretmenId: string,
  sonrasi: Date,
): Promise<OlaySonucu> {
  const ders = await prisma.lesson.findFirst({
    where: { id: dersId, classroom: { teacherId: ogretmenId } },
    select: { id: true },
  });
  if (!ders) return { olaylar: [], sonKontrol: null };

  const kayitlar = await prisma.behaviorLog.findMany({
    where: { lessonId: dersId, createdAt: { gt: sonrasi } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      studentId: true,
      createdAt: true,
      student: { select: { firstName: true, lastName: true } },
    },
  });
  if (kayitlar.length === 0) return { olaylar: [], sonKontrol: null };

  const kirmiziAnahtarlari = new Set(
    kayitlar
      .filter((k) => k.type === "RED_CARD")
      .map((k) => `${k.studentId}|${k.createdAt.toISOString()}`),
  );

  const olaylar = kayitlar
    .filter(
      (k) =>
        k.type !== "MINUS" ||
        !kirmiziAnahtarlari.has(`${k.studentId}|${k.createdAt.toISOString()}`),
    )
    .map((k) => ({
      id: k.id,
      tur: k.type,
      ogrenciAdi: `${k.student.firstName} ${k.student.lastName}`,
    }));

  return {
    olaylar,
    sonKontrol: kayitlar[kayitlar.length - 1].createdAt.toISOString(),
  };
}
