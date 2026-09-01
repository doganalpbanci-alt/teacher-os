import { prisma } from "@/lib/prisma";
import type { MessageStatus } from "@prisma/client";
import { mesajGecerliMi } from "@/lib/parent-message-rules";

// Veli iletişiminin kayıt katmanı. Mesaj bir kez kaydedilince metni
// değişmez — BehaviorLog ile aynı ilke: geçmiş kayıt yeniden yazılmaz.
// Taslak, yalnızca durumu (DRAFT -> SENT) değişebilen bir kayıttır.

export class VeliMesajHatasi extends Error {}

// Geçmiş listelerinde gösterilen kayıt sayısı; sayfa sınırsız büyümesin diye.
const LISTE_SINIRI = 100;

/**
 * Yeni bir veli mesajı kaydeder. Sahiplik sorgunun parçası: öğrenci
 * öğretmenin bir sınıfına ait değilse "bulunamadı" sayılır.
 */
export async function veliMesajiKaydet(
  ogrenciId: string,
  ogretmenId: string,
  mesaj: string,
  durum: MessageStatus,
): Promise<void> {
  if (!mesajGecerliMi(mesaj)) {
    throw new VeliMesajHatasi("Mesaj boş olamaz ya da çok uzun.");
  }

  const ogrenci = await prisma.student.findFirst({
    where: { id: ogrenciId, classroom: { teacherId: ogretmenId } },
    select: { id: true },
  });
  if (!ogrenci) throw new VeliMesajHatasi("Öğrenci bulunamadı.");

  await prisma.parentMessage.create({
    data: {
      studentId: ogrenciId,
      teacherId: ogretmenId,
      body: mesaj,
      status: durum,
      sentAt: durum === "SENT" ? new Date() : null,
    },
  });
}

/**
 * Bir taslağı gönderildi olarak işaretler. Metin değişmez, yalnızca durum ve
 * gönderim zamanı yazılır. Zaten gönderilmiş bir mesaj burada tekrar
 * işaretlenemez — gönderim zamanı geçmişin bir parçasıdır.
 */
export async function veliMesajiGonderildiIsaretle(
  mesajId: string,
  ogretmenId: string,
): Promise<void> {
  const mesaj = await prisma.parentMessage.findFirst({
    where: { id: mesajId, teacherId: ogretmenId },
    select: { id: true, status: true },
  });
  if (!mesaj) throw new VeliMesajHatasi("Mesaj bulunamadı.");
  if (mesaj.status === "SENT") throw new VeliMesajHatasi("Bu mesaj zaten gönderilmiş.");

  await prisma.parentMessage.update({
    where: { id: mesaj.id },
    data: { status: "SENT", sentAt: new Date() },
  });
}

export type VeliMesaji = {
  id: string;
  body: string;
  status: MessageStatus;
  sentAt: Date | null;
  createdAt: Date;
};

/** Bir öğrencinin mesaj geçmişi, en yeniden eskiye. Öğrenci sayfasında gösterilir. */
export async function ogrenciMesajGecmisi(
  ogrenciId: string,
  ogretmenId: string,
): Promise<VeliMesaji[]> {
  return prisma.parentMessage.findMany({
    where: { studentId: ogrenciId, teacherId: ogretmenId },
    orderBy: { createdAt: "desc" },
    take: LISTE_SINIRI,
    select: { id: true, body: true, status: true, sentAt: true, createdAt: true },
  });
}

export type OgretmenVeliMesaji = VeliMesaji & {
  ogrenciId: string;
  ogrenciAdi: string;
  parentPhone: string | null;
};

/** Öğretmenin tüm öğrencilerindeki mesajlar, en yeniden eskiye. Veli sekmesinde gösterilir. */
export async function tumVeliMesajlari(ogretmenId: string): Promise<OgretmenVeliMesaji[]> {
  const mesajlar = await prisma.parentMessage.findMany({
    where: { teacherId: ogretmenId },
    orderBy: { createdAt: "desc" },
    take: LISTE_SINIRI,
    select: {
      id: true,
      body: true,
      status: true,
      sentAt: true,
      createdAt: true,
      student: { select: { id: true, firstName: true, lastName: true, parentPhone: true } },
    },
  });

  return mesajlar.map((m) => ({
    id: m.id,
    body: m.body,
    status: m.status,
    sentAt: m.sentAt,
    createdAt: m.createdAt,
    ogrenciId: m.student.id,
    ogrenciAdi: `${m.student.firstName} ${m.student.lastName}`,
    parentPhone: m.student.parentPhone,
  }));
}

/** Menüdeki sayaç: henüz gönderilmemiş taslak sayısı. */
export async function taslakSayisi(ogretmenId: string): Promise<number> {
  return prisma.parentMessage.count({
    where: { teacherId: ogretmenId, status: "DRAFT" },
  });
}

const AD_SINIRI = 60;
const TELEFON_SINIRI = 30;

/**
 * Bir öğrencinin veli adı/telefonunu günceller. Öğrenci eklenirken de
 * girilebilir; bu, sonradan düzeltmek ya da eksik bırakılanı tamamlamak
 * içindir.
 */
export async function veliBilgisiGuncelle(
  ogrenciId: string,
  ogretmenId: string,
  veliAdi: string,
  veliTelefonu: string,
): Promise<void> {
  if (veliAdi.length > AD_SINIRI) {
    throw new VeliMesajHatasi(`Veli adı en fazla ${AD_SINIRI} karakter olabilir.`);
  }
  if (veliTelefonu.length > TELEFON_SINIRI) {
    throw new VeliMesajHatasi(`Veli telefonu en fazla ${TELEFON_SINIRI} karakter olabilir.`);
  }

  const ogrenci = await prisma.student.findFirst({
    where: { id: ogrenciId, classroom: { teacherId: ogretmenId } },
    select: { id: true },
  });
  if (!ogrenci) throw new VeliMesajHatasi("Öğrenci bulunamadı.");

  await prisma.student.update({
    where: { id: ogrenci.id },
    data: {
      parentName: veliAdi.length > 0 ? veliAdi : null,
      parentPhone: veliTelefonu.length > 0 ? veliTelefonu : null,
    },
  });
}
