"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentTeacher } from "@/lib/current-teacher";
import type { FormState } from "@/lib/form-state";
import { dersBaslat } from "@/lib/current-lesson";
import { davranisKaydet, eylemGecerliMi, DavranisHatasi } from "@/lib/behavior";

const AD_SINIRI = 60;
const TELEFON_SINIRI = 30;

function metin(deger: FormDataEntryValue | null): string {
  return typeof deger === "string" ? deger.trim() : "";
}

function bosIseNull(deger: string): string | null {
  return deger.length > 0 ? deger : null;
}

function hata(
  onceki: FormState,
  mesaj: string,
  degerler: Record<string, string>,
): FormState {
  return { hata: mesaj, deneme: onceki.deneme + 1, degerler };
}

function basarili(onceki: FormState): FormState {
  return { hata: null, deneme: onceki.deneme + 1, degerler: {} };
}

export async function sinifOlustur(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const ad = metin(formData.get("ad"));
  const girilen = { ad };

  if (!ad) return hata(onceki, "Sınıf adı boş olamaz.", girilen);
  if (ad.length > AD_SINIRI) {
    return hata(onceki, `Sınıf adı en fazla ${AD_SINIRI} karakter olabilir.`, girilen);
  }

  try {
    const ogretmen = await getCurrentTeacher();
    await prisma.classroom.create({ data: { name: ad, teacherId: ogretmen.id } });
  } catch {
    return hata(
      onceki,
      "Sınıf kaydedilemedi. Veritabanına ulaşılamıyor olabilir.",
      girilen,
    );
  }

  revalidatePath("/");
  return basarili(onceki);
}

export async function ogrenciEkle(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const sinifId = metin(formData.get("sinifId"));
  const ad = metin(formData.get("ad"));
  const soyad = metin(formData.get("soyad"));
  const veliAdi = metin(formData.get("veliAdi"));
  const veliTelefonu = metin(formData.get("veliTelefonu"));

  const girilen = { ad, soyad, veliAdi, veliTelefonu };

  if (!sinifId) return hata(onceki, "Sınıf bilgisi eksik.", girilen);
  if (!ad) return hata(onceki, "Öğrenci adı boş olamaz.", girilen);
  if (!soyad) return hata(onceki, "Öğrenci soyadı boş olamaz.", girilen);
  if (ad.length > AD_SINIRI || soyad.length > AD_SINIRI) {
    return hata(onceki, `Ad ve soyad en fazla ${AD_SINIRI} karakter olabilir.`, girilen);
  }
  if (veliAdi.length > AD_SINIRI) {
    return hata(onceki, `Veli adı en fazla ${AD_SINIRI} karakter olabilir.`, girilen);
  }
  if (veliTelefonu.length > TELEFON_SINIRI) {
    return hata(
      onceki,
      `Veli telefonu en fazla ${TELEFON_SINIRI} karakter olabilir.`,
      girilen,
    );
  }

  try {
    // Sınıf silinmiş, id elle değiştirilmiş ya da başka bir öğretmene ait
    // olabilir. Sahiplik sorguya katılır; başkasının sınıfı "bulunamadı"
    // sayılır, "var ama senin değil" demek bile bilgi sızdırır.
    const ogretmen = await getCurrentTeacher();
    const sinif = await prisma.classroom.findFirst({
      where: { id: sinifId, teacherId: ogretmen.id },
    });
    if (!sinif) return hata(onceki, "Sınıf bulunamadı.", girilen);

    await prisma.student.create({
      data: {
        classroomId: sinifId,
        firstName: ad,
        lastName: soyad,
        parentName: bosIseNull(veliAdi),
        parentPhone: bosIseNull(veliTelefonu),
      },
    });
  } catch {
    return hata(
      onceki,
      "Öğrenci kaydedilemedi. Veritabanına ulaşılamıyor olabilir.",
      girilen,
    );
  }

  revalidatePath(`/sinif/${sinifId}`);
  revalidatePath("/");
  return basarili(onceki);
}

export async function yeniDersBaslat(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const sinifId = metin(formData.get("sinifId"));
  if (!sinifId) return hata(onceki, "Sınıf bilgisi eksik.", {});

  try {
    const ogretmen = await getCurrentTeacher();
    const sinif = await prisma.classroom.findFirst({
      where: { id: sinifId, teacherId: ogretmen.id },
    });
    if (!sinif) return hata(onceki, "Sınıf bulunamadı.", {});
    await dersBaslat(sinifId);
  } catch {
    return hata(onceki, "Ders başlatılamadı. Veritabanına ulaşılamıyor olabilir.", {});
  }

  revalidatePath(`/sinif/${sinifId}`);
  return basarili(onceki);
}

export async function davranisKaydiOlustur(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const ogrenciId = metin(formData.get("ogrenciId"));
  const dersId = metin(formData.get("dersId"));
  const tur = metin(formData.get("tur"));

  if (!ogrenciId || !dersId) return hata(onceki, "Kayıt bilgisi eksik.", {});

  try {
    // Hangi eylemlerin gecerli oldugu ogretmenin sablonuna baglidir; sablon
    // istemciden degil sunucudan okunur.
    const ogretmen = await getCurrentTeacher();
    if (!eylemGecerliMi(ogretmen.behaviorTemplate, tur)) {
      return hata(onceki, "Geçersiz davranış türü.", {});
    }
    await davranisKaydet(
      ogrenciId,
      dersId,
      tur,
      ogretmen.behaviorTemplate,
      ogretmen.id,
    );
  } catch (error) {
    if (error instanceof DavranisHatasi) return hata(onceki, error.message, {});
    return hata(onceki, "Kayıt eklenemedi. Veritabanına ulaşılamıyor olabilir.", {});
  }

  const sinifId = metin(formData.get("sinifId"));
  if (sinifId) revalidatePath(`/sinif/${sinifId}`);
  revalidatePath("/");
  return basarili(onceki);
}

export async function performansNotuKaydet(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const ogrenciId = metin(formData.get("ogrenciId"));
  const ham = metin(formData.get("not"));
  const girilen = { not: ham };

  if (!ogrenciId) return hata(onceki, "Öğrenci bilgisi eksik.", girilen);
  if (!ham) return hata(onceki, "Not boş olamaz.", girilen);

  const deger = Number(ham);
  if (!Number.isInteger(deger)) {
    return hata(onceki, "Not tam sayı olmalı.", girilen);
  }
  if (deger < 0 || deger > 100) {
    return hata(onceki, "Not 0 ile 100 arasında olmalı.", girilen);
  }

  try {
    const ogretmen = await getCurrentTeacher();
    // Ogrenci, ogretmenin bir sinifina bagli olmali.
    const ogrenci = await prisma.student.findFirst({
      where: { id: ogrenciId, classroom: { teacherId: ogretmen.id } },
      select: { id: true },
    });
    if (!ogrenci) return hata(onceki, "Öğrenci bulunamadı.", girilen);

    await prisma.student.update({
      where: { id: ogrenciId },
      data: { performanceScore: deger },
    });
  } catch {
    return hata(onceki, "Not kaydedilemedi. Veritabanına ulaşılamıyor olabilir.", girilen);
  }

  revalidatePath(`/ogrenci/${ogrenciId}`);
  revalidatePath("/");
  return basarili(onceki);
}

export async function sablonDegistir(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const secim = metin(formData.get("sablon"));
  if (secim !== "SIMPLE" && secim !== "CARD") {
    return hata(onceki, "Geçersiz sistem seçimi.", {});
  }

  try {
    const ogretmen = await getCurrentTeacher();
    await prisma.teacher.update({
      where: { id: ogretmen.id },
      data: { behaviorTemplate: secim },
    });
  } catch {
    return hata(onceki, "Ayar kaydedilemedi. Veritabanına ulaşılamıyor olabilir.", {});
  }

  // Butun siniflarda dugmeler degistigi icin tum sayfalar tazelenir.
  revalidatePath("/", "layout");
  return basarili(onceki);
}
