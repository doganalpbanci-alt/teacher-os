import type { SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { turkceSirala } from "@/lib/siralama";

// Ödev yönetimi tek yerde toplanır: ödevin nasıl oluştuğu, öğrenci bazlı
// teslim kayıtlarının nasıl okunup güncellendiği burada tanımlıdır. Sayfalar
// ve action'lar bu kuralı bilmez, yalnızca id kullanır.
//
// Kural: bir ödev oluşturulduğunda, o an sınıftaki aktif öğrencilere PENDING
// teslim kaydı açılır. Sonradan sınıfa eklenen öğrenci geçmiş ödevlerde
// görünmez; bu bilinçli bir tercih, geriye dönük yazma yapılmaz.

const ZAMAN_DILIMI = "Europe/Istanbul";

// Listelerde gösterilen en fazla kayıt. Sayfa sınırsız büyümesin diye.
const LISTE_SINIRI = 60;

export class OdevHatasi extends Error {}

export function odevTarihiYazisi(tarih: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: ZAMAN_DILIMI,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(tarih);
}

export type OdevSayimlari = {
  pending: number;
  done: number;
  missing: number;
  late: number;
};

function bosSayimlar(): OdevSayimlari {
  return { pending: 0, done: 0, missing: 0, late: 0 };
}

function sayimlariHesapla(durumlar: SubmissionStatus[]): OdevSayimlari {
  const sayim = bosSayimlar();
  for (const durum of durumlar) {
    if (durum === "PENDING") sayim.pending += 1;
    else if (durum === "DONE") sayim.done += 1;
    else if (durum === "MISSING") sayim.missing += 1;
    else if (durum === "LATE") sayim.late += 1;
  }
  return sayim;
}

export type OdevOzeti = {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  createdAt: Date;
  ogrenciSayisi: number;
  sayimlar: OdevSayimlari;
};

/**
 * Yeni ödev açar. Sahiplik sorgunun parçası: başkasının sınıfı için
 * OdevHatasi fırlatır. Teslim kayıtları, o an sınıftaki aktif öğrenciler
 * için tek seferde oluşturulur.
 */
export async function odevOlustur(
  sinifId: string,
  ogretmenId: string,
  title: string,
  description: string | null,
  dueDate: Date | null,
): Promise<void> {
  const sinif = await prisma.classroom.findFirst({
    where: { id: sinifId, teacherId: ogretmenId },
    select: {
      id: true,
      students: { where: { isActive: true }, select: { id: true } },
    },
  });
  if (!sinif) throw new OdevHatasi("Sınıf bulunamadı.");

  await prisma.assignment.create({
    data: {
      classroomId: sinifId,
      title,
      description,
      dueDate,
      submissions: {
        create: sinif.students.map((ogrenci) => ({ studentId: ogrenci.id })),
      },
    },
  });
}

/**
 * Bir sınıfın ödevleri, en yeniden eskiye. Sahiplik sorgunun parçası;
 * başkasının sınıfı boş liste döner.
 */
export async function sinifOdevleri(
  sinifId: string,
  ogretmenId: string,
): Promise<OdevOzeti[]> {
  const odevler = await prisma.assignment.findMany({
    where: { classroomId: sinifId, classroom: { teacherId: ogretmenId } },
    orderBy: { createdAt: "desc" },
    take: LISTE_SINIRI,
    select: {
      id: true,
      title: true,
      description: true,
      dueDate: true,
      createdAt: true,
      submissions: { select: { status: true } },
    },
  });

  return odevler.map((odev) => ({
    id: odev.id,
    title: odev.title,
    description: odev.description,
    dueDate: odev.dueDate,
    createdAt: odev.createdAt,
    ogrenciSayisi: odev.submissions.length,
    sayimlar: sayimlariHesapla(odev.submissions.map((s) => s.status)),
  }));
}

export type TeslimSatiri = {
  submissionId: string;
  ogrenciId: string;
  ad: string;
  status: SubmissionStatus;
};

export type OdevDetayi = {
  odev: OdevOzeti;
  teslimler: TeslimSatiri[];
};

/**
 * Bir ödevin öğrenci bazlı teslim listesi. Sahiplik sorgunun parçası:
 * başka öğretmenin ödevi ya da yanlış sınıf altındaki id null döner.
 */
export async function odevDetayi(
  odevId: string,
  sinifId: string,
  ogretmenId: string,
): Promise<OdevDetayi | null> {
  const odev = await prisma.assignment.findFirst({
    where: { id: odevId, classroomId: sinifId, classroom: { teacherId: ogretmenId } },
    select: {
      id: true,
      title: true,
      description: true,
      dueDate: true,
      createdAt: true,
      submissions: {
        select: {
          id: true,
          status: true,
          student: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!odev) return null;

  const teslimler = turkceSirala(
    odev.submissions.map((s) => ({
      submissionId: s.id,
      ogrenciId: s.student.id,
      ad: `${s.student.firstName} ${s.student.lastName}`,
      status: s.status,
    })),
    (t) => t.ad,
  );

  return {
    odev: {
      id: odev.id,
      title: odev.title,
      description: odev.description,
      dueDate: odev.dueDate,
      createdAt: odev.createdAt,
      ogrenciSayisi: odev.submissions.length,
      sayimlar: sayimlariHesapla(odev.submissions.map((s) => s.status)),
    },
    teslimler,
  };
}

/**
 * Tek bir öğrencinin teslim durumunu günceller. Sahiplik sorgunun parçası:
 * başka öğretmenin teslim kaydı için OdevHatasi fırlatır.
 */
export async function teslimGuncelle(
  submissionId: string,
  ogretmenId: string,
  status: SubmissionStatus,
): Promise<void> {
  const teslim = await prisma.submission.findFirst({
    where: {
      id: submissionId,
      assignment: { classroom: { teacherId: ogretmenId } },
    },
    select: { id: true },
  });
  if (!teslim) throw new OdevHatasi("Teslim kaydı bulunamadı.");

  await prisma.submission.update({
    where: { id: teslim.id },
    data: { status },
  });
}

export type OgrenciOdevSatiri = {
  odevId: string;
  classroomId: string;
  baslik: string;
  dueDate: Date | null;
  status: SubmissionStatus;
};

/**
 * Bir öğrencinin ödev geçmişi, en yeniden eskiye. Sahiplik sorgunun
 * parçası; başka öğretmenin öğrencisi için boş liste döner.
 */
export async function ogrenciOdevleri(
  ogrenciId: string,
  ogretmenId: string,
): Promise<OgrenciOdevSatiri[]> {
  const teslimler = await prisma.submission.findMany({
    where: {
      studentId: ogrenciId,
      assignment: { classroom: { teacherId: ogretmenId } },
    },
    orderBy: { assignment: { createdAt: "desc" } },
    take: LISTE_SINIRI,
    select: {
      status: true,
      assignment: {
        select: { id: true, title: true, dueDate: true, classroomId: true },
      },
    },
  });

  return teslimler.map((t) => ({
    odevId: t.assignment.id,
    classroomId: t.assignment.classroomId,
    baslik: t.assignment.title,
    dueDate: t.assignment.dueDate,
    status: t.status,
  }));
}
