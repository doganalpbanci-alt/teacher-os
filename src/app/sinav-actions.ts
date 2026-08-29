"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ComponentEntry, ExamScope } from "@prisma/client";
import { getCurrentTeacher } from "@/lib/current-teacher";
import type { FormState } from "@/lib/form-state";
import {
  sinavOlustur,
  sinavGuncelle,
  sinavSil,
  girdiYaz,
  girmediIsaretle,
  SinavHatasi,
} from "@/lib/exam";
import { SinavKuralHatasi, type BilesenTanimi } from "@/lib/exam-rules";

// Sınav server action'ları ayrı dosyada: ödev gibi sınav da tek başına yeterince
// büyük bir modül, actions.ts sınıf/öğrenci/ders/ceza işlerini taşıyor.

const BASLIK_SINIRI = 120;
const BILESEN_ADI_SINIRI = 40;
// Bir sınavın makul bileşen sayısı. Formdan gelen sayı sınırsız olmasın.
const BILESEN_SINIRI = 10;

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

/** Boş metin null döner; sayı olmayan "gecersiz". */
function sayi(ham: string): number | null | "gecersiz" {
  if (!ham) return null;
  const deger = Number(ham.replace(",", "."));
  return Number.isFinite(deger) ? deger : "gecersiz";
}

function tamSayi(ham: string): number | null | "gecersiz" {
  const deger = sayi(ham);
  if (deger === "gecersiz") return "gecersiz";
  if (deger === null) return null;
  return Number.isInteger(deger) ? deger : "gecersiz";
}

function tarih(ham: string): Date | "gecersiz" {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ham)) return "gecersiz";
  const deger = new Date(`${ham}T00:00:00.000Z`);
  return Number.isNaN(deger.getTime()) ? "gecersiz" : deger;
}

function scopeCoz(ham: string): ExamScope {
  return ham === "OFFICIAL" ? "OFFICIAL" : "PRACTICE";
}

function entryCoz(ham: string): ComponentEntry {
  return ham === "NET" ? "NET" : "SCORE";
}

type CozulmusForm =
  | {
      ok: true;
      alanlar: Parameters<typeof sinavOlustur>[1];
      bilesenler: (BilesenTanimi & { id: string | null })[];
      ogrenciIdleri: string[];
    }
  | { ok: false; mesaj: string; degerler: Record<string, string> };

/**
 * Oluşturma ve düzenleme formu aynı alanları taşır; doğrulama tek yerde.
 *
 * Bileşenler formda dizi olarak gelir: aynı adı taşıyan alanların sırası
 * korunur, i'inci ad i'inci ağırlıkla eşleşir.
 */
function formuCoz(formData: FormData): CozulmusForm {
  const title = metin(formData.get("title"));
  const tarihHam = metin(formData.get("examDate"));
  const maxScoreHam = metin(formData.get("maxScore"));
  const scope = scopeCoz(metin(formData.get("scope")));

  const degerler = { title, examDate: tarihHam, maxScore: maxScoreHam, scope };

  if (!title) return { ok: false, mesaj: "Sınav adı boş olamaz.", degerler };
  if (title.length > BASLIK_SINIRI) {
    return {
      ok: false,
      mesaj: `Sınav adı en fazla ${BASLIK_SINIRI} karakter olabilir.`,
      degerler,
    };
  }

  const examDate = tarih(tarihHam);
  if (examDate === "gecersiz") {
    return { ok: false, mesaj: "Sınav tarihi geçersiz.", degerler };
  }

  const maxScore = sayi(maxScoreHam);
  if (maxScore === "gecersiz" || maxScore === null || maxScore <= 0) {
    return { ok: false, mesaj: "Sınavın tam puanı sıfırdan büyük olmalı.", degerler };
  }

  const adlar = formData.getAll("bilesenAdi").filter((d): d is string => typeof d === "string");
  if (adlar.length === 0) {
    return { ok: false, mesaj: "Sınavın en az bir bileşeni olmalı.", degerler };
  }
  if (adlar.length > BILESEN_SINIRI) {
    return {
      ok: false,
      mesaj: `Bir sınavda en fazla ${BILESEN_SINIRI} bileşen olabilir.`,
      degerler,
    };
  }

  const al = (ad: string, sira: number): string => {
    const hepsi = formData.getAll(ad);
    const deger = hepsi[sira];
    return typeof deger === "string" ? deger.trim() : "";
  };

  const bilesenler: (BilesenTanimi & { id: string | null })[] = [];
  for (let i = 0; i < adlar.length; i += 1) {
    const name = adlar[i].trim();
    if (name.length > BILESEN_ADI_SINIRI) {
      return {
        ok: false,
        mesaj: `Bileşen adı en fazla ${BILESEN_ADI_SINIRI} karakter olabilir.`,
        degerler,
      };
    }

    const weight = sayi(al("bilesenAgirlik", i));
    if (weight === "gecersiz" || weight === null) {
      return { ok: false, mesaj: `"${name}" bileşeninin ağırlığı geçersiz.`, degerler };
    }

    const bilesenMax = sayi(al("bilesenTamPuan", i));
    if (bilesenMax === "gecersiz" || bilesenMax === null) {
      return { ok: false, mesaj: `"${name}" bileşeninin tam puanı geçersiz.`, degerler };
    }

    const entry = entryCoz(al("bilesenGiris", i));

    const questionCount = tamSayi(al("bilesenSoruSayisi", i));
    if (questionCount === "gecersiz") {
      return { ok: false, mesaj: `"${name}" bileşeninin soru sayısı geçersiz.`, degerler };
    }

    const wrongDivisor = tamSayi(al("bilesenYanlisBoleni", i));
    if (wrongDivisor === "gecersiz") {
      return { ok: false, mesaj: `"${name}" bileşeninde yanlış böleni geçersiz.`, degerler };
    }

    const ham = al("bilesenId", i);
    bilesenler.push({
      id: ham || null,
      name,
      weight,
      maxScore: bilesenMax,
      entry,
      // SCORE bileşeninde net alanları taşınmaz; form gizli de olsa
      // eski değerleri gönderebilir, kayıt tek anlam taşımalı.
      questionCount: entry === "NET" ? questionCount : null,
      wrongDivisor: entry === "NET" ? wrongDivisor : null,
    });
  }

  const ogrenciIdleri = formData
    .getAll("ogrenci")
    .filter((d): d is string => typeof d === "string");

  return {
    ok: true,
    alanlar: { title, examDate, maxScore, scope },
    bilesenler,
    ogrenciIdleri,
  };
}

/** Kural hataları da forma dönmeli; ikisi de öğretmenin düzeltebileceği şeyler. */
function kuralHatasiMi(error: unknown): error is Error {
  return error instanceof SinavHatasi || error instanceof SinavKuralHatasi;
}

export async function sinavKaydet(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const cozum = formuCoz(formData);
  if (!cozum.ok) return hata(onceki, cozum.mesaj, cozum.degerler);

  let yeniId: string;
  try {
    const ogretmen = await getCurrentTeacher();
    yeniId = await sinavOlustur(
      ogretmen.id,
      cozum.alanlar,
      cozum.bilesenler,
      cozum.ogrenciIdleri,
    );
  } catch (error) {
    if (kuralHatasiMi(error)) {
      return hata(onceki, error.message, {
        title: cozum.alanlar.title,
        examDate: metin(formData.get("examDate")),
        maxScore: metin(formData.get("maxScore")),
        scope: cozum.alanlar.scope,
      });
    }
    return hata(onceki, "Sınav kaydedilemedi. Veritabanına ulaşılamıyor olabilir.");
  }

  revalidatePath("/sinavlar");
  revalidatePath("/", "layout");
  // Yeni sınavın kendi sayfasına gidilir: öğretmen doğrudan not girmeye başlar.
  redirect(`/sinavlar/${yeniId}`);
}

export async function sinavDuzenlemesiKaydet(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const sinavId = metin(formData.get("sinavId"));
  if (!sinavId) return hata(onceki, "Sınav bilgisi eksik.");

  const cozum = formuCoz(formData);
  if (!cozum.ok) return hata(onceki, cozum.mesaj, cozum.degerler);

  try {
    const ogretmen = await getCurrentTeacher();
    await sinavGuncelle(
      sinavId,
      ogretmen.id,
      cozum.alanlar,
      cozum.bilesenler,
      cozum.ogrenciIdleri,
    );
  } catch (error) {
    if (kuralHatasiMi(error)) return hata(onceki, error.message);
    return hata(onceki, "Sınav güncellenemedi. Veritabanına ulaşılamıyor olabilir.");
  }

  revalidatePath("/sinavlar");
  revalidatePath("/", "layout");
  redirect(`/sinavlar/${sinavId}`);
}

export async function sinavKaldir(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const sinavId = metin(formData.get("sinavId"));
  if (!sinavId) return hata(onceki, "Sınav bilgisi eksik.");

  try {
    // Silme yalnızca hiçbir not işlenmemişse mümkün; kural sinavSil içinde,
    // kaydın silindiği en alt katmanda.
    const ogretmen = await getCurrentTeacher();
    await sinavSil(sinavId, ogretmen.id);
  } catch (error) {
    if (kuralHatasiMi(error)) return hata(onceki, error.message);
    return hata(onceki, "Sınav silinemedi. Veritabanına ulaşılamıyor olabilir.");
  }

  revalidatePath("/sinavlar");
  revalidatePath("/", "layout");
  redirect("/sinavlar");
}

/**
 * Tek bir öğrencinin tek bir bileşendeki notunu yazar. Not girme tablosundaki
 * her hücre bunu çağırır; boş gönderilmesi "girilmedi"ye dönmek demektir.
 */
export async function notGir(onceki: FormState, formData: FormData): Promise<FormState> {
  const sonucId = metin(formData.get("sonucId"));
  const bilesenId = metin(formData.get("bilesenId"));
  const sinavId = metin(formData.get("sinavId"));

  if (!sonucId || !bilesenId) return hata(onceki, "Sınav kaydı bilgisi eksik.");

  const score = sayi(metin(formData.get("score")));
  const correct = tamSayi(metin(formData.get("correct")));
  const wrong = tamSayi(metin(formData.get("wrong")));
  const blank = tamSayi(metin(formData.get("blank")));

  if (score === "gecersiz") return hata(onceki, "Puan sayı olmalı.");
  if (correct === "gecersiz" || wrong === "gecersiz" || blank === "gecersiz") {
    return hata(onceki, "Doğru, yanlış ve boş sayıları tam sayı olmalı.");
  }

  try {
    const ogretmen = await getCurrentTeacher();
    await girdiYaz(sonucId, bilesenId, ogretmen.id, { score, correct, wrong, blank });
  } catch (error) {
    if (kuralHatasiMi(error)) return hata(onceki, error.message);
    return hata(onceki, "Not kaydedilemedi. Veritabanına ulaşılamıyor olabilir.");
  }

  if (sinavId) revalidatePath(`/sinavlar/${sinavId}`);
  revalidatePath("/", "layout");
  return basarili(onceki);
}

export async function girmediDegistir(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const sonucId = metin(formData.get("sonucId"));
  const sinavId = metin(formData.get("sinavId"));
  const girmedi = metin(formData.get("girmedi")) === "1";

  if (!sonucId) return hata(onceki, "Sınav kaydı bilgisi eksik.");

  try {
    const ogretmen = await getCurrentTeacher();
    await girmediIsaretle(sonucId, ogretmen.id, girmedi);
  } catch (error) {
    if (kuralHatasiMi(error)) return hata(onceki, error.message);
    return hata(onceki, "İşaret değiştirilemedi. Veritabanına ulaşılamıyor olabilir.");
  }

  if (sinavId) revalidatePath(`/sinavlar/${sinavId}`);
  return basarili(onceki);
}
