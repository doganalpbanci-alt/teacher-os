import type { BehaviorType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Bir ekranda gösterilen en fazla kayıt. Bir öğrencinin bir dönemde bu kadar
// kaydı olması beklenmez; sınır yine de konur ki sayfa sınırsız büyümesin.
const KAYIT_SINIRI = 300;

export type GecmisKaydi = {
  id: string;
  tur: BehaviorType;
  puan: number;
  zaman: Date;
};

export type DersGrubu = {
  dersId: string;
  dersTarihi: Date;
  kayitlar: GecmisKaydi[];
};

export type Ozet = {
  arti: number;
  eksi: number;
  sariKart: number;
  kirmiziKart: number;
};

/**
 * Kırmızı kart iki satır yazar: RED_CARD (0 puan) ve yanındaki MINUS (-5).
 * İkisi aynı işlemde oluştuğu için zaman damgaları da aynıdır. Geçmişte tek
 * bir "kırmızı kart -5" satırı olarak gösterilir; ham kayıtlara dokunulmaz.
 */
function kirmiziKartlariBirlestir(kayitlar: GecmisKaydi[]): GecmisKaydi[] {
  const eslesenMinusler = new Set<string>();

  for (const kart of kayitlar) {
    if (kart.tur !== "RED_CARD") continue;
    const es = kayitlar.find(
      (k) =>
        k.tur === "MINUS" &&
        !eslesenMinusler.has(k.id) &&
        k.zaman.getTime() === kart.zaman.getTime(),
    );
    if (es) {
      eslesenMinusler.add(es.id);
      kart.puan += es.puan;
    }
  }

  return kayitlar.filter((k) => !eslesenMinusler.has(k.id));
}

/** Öğrencinin kayıtları, derslere göre gruplanmış, en yeni ders en üstte. */
export async function ogrenciGecmisi(ogrenciId: string): Promise<DersGrubu[]> {
  const kayitlar = await prisma.behaviorLog.findMany({
    where: { studentId: ogrenciId },
    orderBy: { createdAt: "desc" },
    take: KAYIT_SINIRI,
    select: {
      id: true,
      type: true,
      points: true,
      createdAt: true,
      lessonId: true,
      lesson: { select: { date: true } },
    },
  });

  const gruplar = new Map<string, DersGrubu>();
  for (const kayit of kayitlar) {
    let grup = gruplar.get(kayit.lessonId);
    if (!grup) {
      grup = { dersId: kayit.lessonId, dersTarihi: kayit.lesson.date, kayitlar: [] };
      gruplar.set(kayit.lessonId, grup);
    }
    grup.kayitlar.push({
      id: kayit.id,
      tur: kayit.type,
      puan: kayit.points,
      zaman: kayit.createdAt,
    });
  }

  return [...gruplar.values()].map((grup) => ({
    ...grup,
    kayitlar: kirmiziKartlariBirlestir(grup.kayitlar),
  }));
}

/** Dönem toplamları. Kırmızı kartın yanındaki MINUS iki kez sayılmaz. */
export async function ogrenciOzeti(ogrenciId: string): Promise<Ozet> {
  const gruplar = await prisma.behaviorLog.groupBy({
    by: ["type"],
    where: { studentId: ogrenciId },
    _count: { _all: true },
  });

  const say = (tur: BehaviorType) =>
    gruplar.find((g) => g.type === tur)?._count._all ?? 0;

  const kirmiziKart = say("RED_CARD");
  return {
    arti: say("PLUS"),
    // Kart sisteminde her kırmızı kart bir MINUS üretir; onlar ayrıca sayılmaz.
    eksi: Math.max(say("MINUS") - kirmiziKart, 0),
    sariKart: say("YELLOW_CARD"),
    kirmiziKart,
  };
}
