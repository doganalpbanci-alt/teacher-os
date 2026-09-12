import { prisma } from "@/lib/prisma";
import { hedefTamamlandiMi, ilerlemeYuzdesi } from "@/lib/class-goal-rules";

// Sınıf hedefinin ilerlemesi ayrıca tutulmaz: gerçek kaynak BehaviorLog'daki
// PLUS kayıtlarıdır (basit şablonda artı, kart şablonunda yıldız — ikisi de
// aynı tip). `ClassGoal` yalnızca bir pencerenin başlangıcını ve kapanışını
// işaretler; sayım her seferinde canlı hesaplanır, Student.performanceScore
// gibi ayrıca cache'lenmez çünkü sınıf başına log sayısı küçüktür.

export type HedefDurumu = {
  id: string;
  target: number;
  reward: string;
  createdAt: Date;
  sayim: number;
  yuzde: number;
  tamamlandi: boolean;
};

export type GecmisHedef = HedefDurumu & { closedAt: Date };

async function plusSayisi(
  classroomId: string,
  baslangic: Date,
  bitis: Date | null,
): Promise<number> {
  return prisma.behaviorLog.count({
    where: {
      classroomId,
      type: "PLUS",
      createdAt: { gte: baslangic, ...(bitis ? { lte: bitis } : {}) },
    },
  });
}

/** Sınıfın açık (kapanmamış) hedefi, varsa ilerlemesiyle birlikte. */
export async function acikHedefiGetir(classroomId: string): Promise<HedefDurumu | null> {
  const hedef = await prisma.classGoal.findFirst({
    where: { classroomId, closedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!hedef) return null;

  const sayim = await plusSayisi(classroomId, hedef.createdAt, null);
  return {
    id: hedef.id,
    target: hedef.target,
    reward: hedef.reward,
    createdAt: hedef.createdAt,
    sayim,
    yuzde: ilerlemeYuzdesi(sayim, hedef.target),
    tamamlandi: hedefTamamlandiMi(sayim, hedef.target),
  };
}

/** Kapanmış hedefler, en yeniden eskiye — küçük bir başarı geçmişi. */
export async function gecmisHedefleriGetir(classroomId: string): Promise<GecmisHedef[]> {
  const hedefler = await prisma.classGoal.findMany({
    where: { classroomId, closedAt: { not: null } },
    orderBy: { closedAt: "desc" },
  });

  return Promise.all(
    hedefler.map(async (hedef) => {
      const sayim = await plusSayisi(classroomId, hedef.createdAt, hedef.closedAt);
      return {
        id: hedef.id,
        target: hedef.target,
        reward: hedef.reward,
        createdAt: hedef.createdAt,
        closedAt: hedef.closedAt as Date,
        sayim,
        yuzde: ilerlemeYuzdesi(sayim, hedef.target),
        tamamlandi: hedefTamamlandiMi(sayim, hedef.target),
      };
    }),
  );
}
