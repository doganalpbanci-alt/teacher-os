import { prisma } from "@/lib/prisma";

/**
 * Bir öğretmenin TÜM verisini siler: sınıf, öğrenci, ders, davranış geçmişi,
 * ceza, ödev, sınav, veli mesajı. Öğretmen hesabının kendisi (giriş bilgisi,
 * tahta PIN'i, şablon tercihi) dokunulmadan kalır.
 *
 * Bu, `CLAUDE.md`'deki "öğrenci geçmişi kaybolmaz" ilkesinin bilinçli bir
 * istisnasıdır: öğretmenin kendi isteğiyle, açıkça onaylayarak yaptığı bir
 * sıfırlamadır (test verisini temizlemek, yeni döneme sıfırdan başlamak
 * gibi) — kazayla basılan bir tuşun sonucu değildir. Onay akışı çağıran
 * tarafta (`hesapSifirla` action'ı): hesap parolası + yazılı bir teyit ister.
 *
 * Sıra RESTRICT ilişkilerin izin verdiği tek sıradır: bir kayıt, ona
 * RESTRICT ile bağlı bütün çocukları silinmeden silinemez.
 */
export async function hesapVerisiniSifirla(ogretmenId: string): Promise<void> {
  await prisma.$transaction([
    prisma.examResultComponent.deleteMany({
      where: { result: { exam: { teacherId: ogretmenId } } },
    }),
    prisma.examResult.deleteMany({ where: { exam: { teacherId: ogretmenId } } }),
    prisma.examComponent.deleteMany({ where: { exam: { teacherId: ogretmenId } } }),
    prisma.exam.deleteMany({ where: { teacherId: ogretmenId } }),

    prisma.submission.deleteMany({
      where: { assignment: { teacherId: ogretmenId } },
    }),
    prisma.assignment.deleteMany({ where: { teacherId: ogretmenId } }),

    prisma.parentMessage.deleteMany({ where: { teacherId: ogretmenId } }),

    prisma.behaviorLog.deleteMany({ where: { teacherId: ogretmenId } }),
    prisma.breakPenalty.deleteMany({
      where: { student: { classroom: { teacherId: ogretmenId } } },
    }),

    prisma.lesson.deleteMany({ where: { classroom: { teacherId: ogretmenId } } }),
    prisma.student.deleteMany({ where: { classroom: { teacherId: ogretmenId } } }),
    prisma.classroom.deleteMany({ where: { teacherId: ogretmenId } }),
  ]);
}
