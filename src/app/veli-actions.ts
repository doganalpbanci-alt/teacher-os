"use server";

import { revalidatePath } from "next/cache";
import { getCurrentTeacher } from "@/lib/current-teacher";
import type { FormState } from "@/lib/form-state";
import {
  VeliMesajHatasi,
  veliBilgisiGuncelle,
  veliMesajiGonderildiIsaretle,
  veliMesajiKaydet,
} from "@/lib/parent-message";

function metin(deger: FormDataEntryValue | null): string {
  return typeof deger === "string" ? deger.trim() : "";
}

function hata(onceki: FormState, mesaj: string, degerler: Record<string, string> = {}): FormState {
  return { hata: mesaj, deneme: onceki.deneme + 1, degerler };
}

function basarili(onceki: FormState): FormState {
  return { hata: null, deneme: onceki.deneme + 1, degerler: {} };
}

/**
 * Mesajı kaydeder. `durum` gizli alanı hangi düğmeye basıldığını taşır:
 * taslak olarak sakla, ya da doğrudan gönderildi say (WhatsApp'ta açma veya
 * kopyalama, ikisi de "gönderildi" sayılır — hangisiyle ulaştığı öğretmenin
 * bileceği bir şey, kayıt yalnızca gönderildiğini tutar).
 */
export async function veliMesajiOlustur(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const ogrenciId = metin(formData.get("ogrenciId"));
  const mesaj = formData.get("mesaj");
  const durumHam = metin(formData.get("durum"));
  const durum = durumHam === "SENT" ? "SENT" : "DRAFT";

  if (!ogrenciId) return hata(onceki, "Öğrenci bilgisi eksik.");
  if (typeof mesaj !== "string") return hata(onceki, "Mesaj eksik.");

  try {
    const ogretmen = await getCurrentTeacher();
    await veliMesajiKaydet(ogrenciId, ogretmen.id, mesaj, durum);
  } catch (error) {
    if (error instanceof VeliMesajHatasi) return hata(onceki, error.message);
    return hata(onceki, "Mesaj kaydedilemedi. Veritabanına ulaşılamıyor olabilir.");
  }

  revalidatePath("/veli");
  revalidatePath(`/ogrenci/${ogrenciId}`);
  return basarili(onceki);
}

/** `/veli` listesindeki bir taslağı, metnini değiştirmeden gönderildi işaretler. */
export async function veliMesajiGonderildiIsaretleAction(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const mesajId = metin(formData.get("mesajId"));
  if (!mesajId) return hata(onceki, "Mesaj bilgisi eksik.");

  try {
    const ogretmen = await getCurrentTeacher();
    await veliMesajiGonderildiIsaretle(mesajId, ogretmen.id);
  } catch (error) {
    if (error instanceof VeliMesajHatasi) return hata(onceki, error.message);
    return hata(onceki, "Güncellenemedi. Veritabanına ulaşılamıyor olabilir.");
  }

  revalidatePath("/veli");
  return basarili(onceki);
}

export async function veliBilgisiKaydet(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const ogrenciId = metin(formData.get("ogrenciId"));
  const veliAdi = metin(formData.get("veliAdi"));
  const veliTelefonu = metin(formData.get("veliTelefonu"));
  const veliOnayi = formData.get("veliOnayi") === "on";
  const girilen = { veliAdi, veliTelefonu };

  if (!ogrenciId) return hata(onceki, "Öğrenci bilgisi eksik.", girilen);

  try {
    const ogretmen = await getCurrentTeacher();
    await veliBilgisiGuncelle(ogrenciId, ogretmen.id, veliAdi, veliTelefonu, veliOnayi);
  } catch (error) {
    if (error instanceof VeliMesajHatasi) return hata(onceki, error.message, girilen);
    return hata(onceki, "Kaydedilemedi. Veritabanına ulaşılamıyor olabilir.", girilen);
  }

  revalidatePath(`/ogrenci/${ogrenciId}`);
  revalidatePath("/veli");
  return basarili(onceki);
}
