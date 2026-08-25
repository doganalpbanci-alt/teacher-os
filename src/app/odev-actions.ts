"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SubmissionStatus } from "@prisma/client";
import { getCurrentTeacher } from "@/lib/current-teacher";
import type { FormState } from "@/lib/form-state";
import {
  odevOlustur,
  odevGuncelle,
  odevArsivle,
  odevSil,
  teslimGuncelle,
  topluTeslimGuncelle,
  OdevHatasi,
} from "@/lib/assignment";

// Ödev server action'ları ayrı dosyada: actions.ts sınıf, öğrenci, ders ve
// ceza işlerini taşıyor, ödev modülü tek başına o kadar büyük.

const BASLIK_SINIRI = 120;
const ACIKLAMA_SINIRI = 2000;

function metin(deger: FormDataEntryValue | null): string {
  return typeof deger === "string" ? deger.trim() : "";
}

function hata(
  onceki: FormState,
  mesaj: string,
  degerler: Record<string, string> = {},
): FormState {
  return { hata: mesaj, deneme: onceki.deneme + 1, degerler };
}

function basarili(onceki: FormState): FormState {
  return { hata: null, deneme: onceki.deneme + 1, degerler: {} };
}

/**
 * `<input type="date">` "2026-09-01" gönderir. UTC gece yarısı olarak
 * saklanır; ekranda öğretmenin saat dilimiyle okunur. Geçmiş tarih serbest:
 * geçmişe dönük ödev girilebilmeli.
 */
function tarih(ham: string): Date | null | "gecersiz" {
  if (!ham) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ham)) return "gecersiz";
  const deger = new Date(`${ham}T00:00:00.000Z`);
  return Number.isNaN(deger.getTime()) ? "gecersiz" : deger;
}

type CozulmusForm =
  | { ok: true; alanlar: Parameters<typeof odevOlustur>[1]; ogrenciIdleri: string[] }
  | { ok: false; mesaj: string; degerler: Record<string, string> };

/** Oluşturma ve düzenleme formu aynı alanları taşır; doğrulama tek yerde. */
function formuCoz(formData: FormData): CozulmusForm {
  const title = metin(formData.get("title"));
  const description = metin(formData.get("description"));
  const baslangicHam = metin(formData.get("startDate"));
  const bitisHam = metin(formData.get("dueDate"));

  const degerler = { title, description, startDate: baslangicHam, dueDate: bitisHam };

  if (!title) return { ok: false, mesaj: "Ödev başlığı boş olamaz.", degerler };
  if (title.length > BASLIK_SINIRI) {
    return {
      ok: false,
      mesaj: `Başlık en fazla ${BASLIK_SINIRI} karakter olabilir.`,
      degerler,
    };
  }
  if (description.length > ACIKLAMA_SINIRI) {
    return {
      ok: false,
      mesaj: `Ödev içeriği en fazla ${ACIKLAMA_SINIRI} karakter olabilir.`,
      degerler,
    };
  }

  const startDate = tarih(baslangicHam);
  if (startDate === "gecersiz") {
    return { ok: false, mesaj: "Başlangıç tarihi geçersiz.", degerler };
  }
  const dueDate = tarih(bitisHam);
  if (dueDate === "gecersiz") {
    return { ok: false, mesaj: "Son teslim tarihi geçersiz.", degerler };
  }
  if (startDate && dueDate && dueDate.getTime() < startDate.getTime()) {
    return {
      ok: false,
      mesaj: "Son teslim tarihi başlangıçtan önce olamaz.",
      degerler,
    };
  }

  // Seçim kutuları aynı adı taşır; işaretli olanların hepsi gelir.
  const ogrenciIdleri = formData
    .getAll("ogrenci")
    .filter((d): d is string => typeof d === "string");

  return {
    ok: true,
    alanlar: {
      title,
      description: description.length > 0 ? description : null,
      startDate,
      dueDate,
    },
    ogrenciIdleri,
  };
}

export async function odevKaydet(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const cozum = formuCoz(formData);
  if (!cozum.ok) return hata(onceki, cozum.mesaj, cozum.degerler);

  let yeniId: string;
  try {
    const ogretmen = await getCurrentTeacher();
    yeniId = await odevOlustur(ogretmen.id, cozum.alanlar, cozum.ogrenciIdleri);
  } catch (error) {
    if (error instanceof OdevHatasi) {
      return hata(onceki, error.message, {
        title: cozum.alanlar.title,
        description: cozum.alanlar.description ?? "",
        startDate: metin(formData.get("startDate")),
        dueDate: metin(formData.get("dueDate")),
      });
    }
    return hata(onceki, "Ödev kaydedilemedi. Veritabanına ulaşılamıyor olabilir.");
  }

  revalidatePath("/odevler");
  revalidatePath("/", "layout");
  // Yeni ödevin kendi sayfasına gidilir: öğretmen doğrudan işaretlemeye başlar.
  redirect(`/odevler/${yeniId}`);
}

export async function odevDuzenlemesiKaydet(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const odevId = metin(formData.get("odevId"));
  if (!odevId) return hata(onceki, "Ödev bilgisi eksik.");

  const cozum = formuCoz(formData);
  if (!cozum.ok) return hata(onceki, cozum.mesaj, cozum.degerler);

  try {
    const ogretmen = await getCurrentTeacher();
    await odevGuncelle(odevId, ogretmen.id, cozum.alanlar, cozum.ogrenciIdleri);
  } catch (error) {
    if (error instanceof OdevHatasi) return hata(onceki, error.message);
    return hata(onceki, "Ödev güncellenemedi. Veritabanına ulaşılamıyor olabilir.");
  }

  revalidatePath("/odevler");
  revalidatePath("/", "layout");
  redirect(`/odevler/${odevId}`);
}

export async function odevArsivDegistir(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const odevId = metin(formData.get("odevId"));
  const arsiv = metin(formData.get("arsiv")) === "1";
  if (!odevId) return hata(onceki, "Ödev bilgisi eksik.");

  try {
    const ogretmen = await getCurrentTeacher();
    await odevArsivle(odevId, ogretmen.id, arsiv);
  } catch (error) {
    if (error instanceof OdevHatasi) return hata(onceki, error.message);
    return hata(onceki, "Ödev güncellenemedi. Veritabanına ulaşılamıyor olabilir.");
  }

  revalidatePath("/odevler");
  revalidatePath(`/odevler/${odevId}`);
  revalidatePath("/", "layout");
  return basarili(onceki);
}

export async function odevKaldir(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const odevId = metin(formData.get("odevId"));
  if (!odevId) return hata(onceki, "Ödev bilgisi eksik.");

  try {
    // Silme yalnızca hiçbir öğrenci işaretlenmemişse mümkün; kural
    // odevSil içinde, kaydın silindiği en alt katmanda.
    const ogretmen = await getCurrentTeacher();
    await odevSil(odevId, ogretmen.id);
  } catch (error) {
    if (error instanceof OdevHatasi) return hata(onceki, error.message);
    return hata(onceki, "Ödev silinemedi. Veritabanına ulaşılamıyor olabilir.");
  }

  revalidatePath("/odevler");
  revalidatePath("/", "layout");
  redirect("/odevler");
}

const DURUMLAR = ["PENDING", "DONE", "MISSING", "LATE"] as const;

function durumGecerliMi(deger: string): deger is SubmissionStatus {
  return (DURUMLAR as readonly string[]).includes(deger);
}

export async function teslimDurumuGuncelle(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const submissionId = metin(formData.get("submissionId"));
  const durum = metin(formData.get("durum"));
  const odevId = metin(formData.get("odevId"));

  if (!submissionId) return hata(onceki, "Teslim bilgisi eksik.");
  if (!durumGecerliMi(durum)) return hata(onceki, "Geçersiz durum.");

  try {
    const ogretmen = await getCurrentTeacher();
    await teslimGuncelle(submissionId, ogretmen.id, durum);
  } catch (error) {
    if (error instanceof OdevHatasi) return hata(onceki, error.message);
    return hata(onceki, "Durum güncellenemedi. Veritabanına ulaşılamıyor olabilir.");
  }

  if (odevId) revalidatePath(`/odevler/${odevId}`);
  return basarili(onceki);
}

export async function topluDurumGuncelle(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const odevId = metin(formData.get("odevId"));
  const durum = metin(formData.get("durum"));
  // Boş gelirse ödevin tamamı; doluysa yalnızca o sınıf.
  const sinifId = metin(formData.get("sinifId"));

  if (!odevId) return hata(onceki, "Ödev bilgisi eksik.");
  if (!durumGecerliMi(durum)) return hata(onceki, "Geçersiz durum.");

  try {
    const ogretmen = await getCurrentTeacher();
    await topluTeslimGuncelle(odevId, ogretmen.id, durum, sinifId || null);
  } catch (error) {
    if (error instanceof OdevHatasi) return hata(onceki, error.message);
    return hata(onceki, "Durum güncellenemedi. Veritabanına ulaşılamıyor olabilir.");
  }

  revalidatePath(`/odevler/${odevId}`);
  return basarili(onceki);
}
