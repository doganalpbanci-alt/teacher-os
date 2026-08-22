"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentTeacher } from "@/lib/current-teacher";
import type { FormState } from "@/lib/form-state";

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
    // Sınıf silinmiş ya da id elle değiştirilmiş olabilir. Doğrudan create
    // denenirse ham foreign key hatası döner; önce kontrol edilir.
    const sinif = await prisma.classroom.findUnique({ where: { id: sinifId } });
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
