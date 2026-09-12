import { prisma } from "@/lib/prisma";
import type { Prisma, ExpKaynagi } from "@prisma/client";
import { seviyeHesapla, type SeviyeDurumu } from "@/lib/exp-rules";

export { seviyeHesapla } from "@/lib/exp-rules";
export type { SeviyeDurumu } from "@/lib/exp-rules";

type Tx = Prisma.TransactionClient;

/**
 * Bir öğrenciye EXP ekler ve `Student.expTotal`i yeniden hesaplar (aynı
 * "kayıttan türet, cache'le" prensibi `performanceScore` ile). `referenceId`
 * kaynağın kendi id'sidir (BehaviorLog/Submission); (source, referenceId)
 * eşsizdir, aynı olay ikinci kez EXP yazmaya çalışırsa veritabanı sessizce
 * atlar (`skipDuplicates`) — çağıran taraf "zaten verildi mi" diye ayrıca
 * sormaz.
 *
 * Çağıran, işlemi kendi transaction'ının içinde geçirir (`tx`): EXP, olayın
 * kendisiyle (yıldız kaydı, ödev durumu) aynı anda ya hep ya hiç yazılsın.
 */
export async function expEkle(
  tx: Tx,
  studentId: string,
  source: ExpKaynagi,
  referenceId: string,
  amount: number,
): Promise<void> {
  await tx.expEvent.createMany({
    data: [{ studentId, source, referenceId, amount }],
    skipDuplicates: true,
  });

  const toplam = await tx.expEvent.aggregate({
    where: { studentId },
    _sum: { amount: true },
  });
  await tx.student.update({
    where: { id: studentId },
    data: { expTotal: toplam._sum.amount ?? 0 },
  });
}

/** Bir yıldız kaydı geri alınınca EXP'sini de geri alır (bkz. `sonKaydiGeriAl`). */
export async function expGeriAl(tx: Tx, studentId: string, referenceId: string): Promise<void> {
  const silinen = await tx.expEvent.deleteMany({
    where: { studentId, source: "YILDIZ", referenceId },
  });
  if (silinen.count === 0) return;

  const toplam = await tx.expEvent.aggregate({
    where: { studentId },
    _sum: { amount: true },
  });
  await tx.student.update({
    where: { id: studentId },
    data: { expTotal: toplam._sum.amount ?? 0 },
  });
}

/** Bir grup öğrencinin seviye durumu; ders ekranındaki rozet için. */
export async function ogrenciSeviyeleri(
  ogrenciIdleri: string[],
): Promise<Map<string, SeviyeDurumu>> {
  const sonuc = new Map<string, SeviyeDurumu>();
  if (ogrenciIdleri.length === 0) return sonuc;

  const ogrenciler = await prisma.student.findMany({
    where: { id: { in: ogrenciIdleri } },
    select: { id: true, expTotal: true },
  });
  for (const o of ogrenciler) {
    sonuc.set(o.id, seviyeHesapla(o.expTotal));
  }
  return sonuc;
}
