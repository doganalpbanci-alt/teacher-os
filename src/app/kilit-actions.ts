"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { parolaDogru } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";
import {
  KilitHatasi,
  cihaziKilitle,
  kilidiAc,
  kilidiKaldir,
  kilitDurumu,
  pinHashle,
  simdiKilitle,
  yazmaKilitli,
} from "@/lib/lock";
import {
  EN_KISA_PIN,
  EN_UZUN_PIN,
  EN_KISA_SURE_DAKIKA,
  EN_UZUN_SURE_DAKIKA,
  pinGecerliMi,
} from "@/lib/lock-rules";

// Tahta kilidinin server action'ları. Kilidin kendisi cihaza ait olduğu için
// (imzalı çerez) bu işlemlerin çoğu veritabanına dokunmaz; dokunan tek yer
// PIN'in ve sürenin saklandığı Teacher kaydı.

function metin(deger: FormDataEntryValue | null): string {
  return typeof deger === "string" ? deger.trim() : "";
}

function hata(onceki: FormState, mesaj: string, degerler: Record<string, string> = {}): FormState {
  return { hata: mesaj, deneme: onceki.deneme + 1, degerler };
}

function basarili(onceki: FormState, degerler: Record<string, string> = {}): FormState {
  return { hata: null, deneme: onceki.deneme + 1, degerler };
}

/** Kilidi devreye alır. PIN kurulmamışsa kilitleme yapılmaz: açılamayan bir kilit tuzaktır. */
export async function tahtayiKilitle(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const sinifId = metin(formData.get("sinifId"));
  if (!sinifId) return hata(onceki, "Sınıf bilgisi eksik.");

  try {
    const ogretmen = await getCurrentTeacher();
    if (!ogretmen.boardPin) {
      return hata(onceki, "Önce Ayarlar'dan bir tahta PIN'i belirleyin.");
    }
    // Sahiplik sorgunun parçası: başkasının sınıfına kilitlenilmez.
    const sinif = await prisma.classroom.findFirst({
      where: { id: sinifId, teacherId: ogretmen.id },
      select: { id: true },
    });
    if (!sinif) return hata(onceki, "Sınıf bulunamadı.");

    await cihaziKilitle(sinifId);
  } catch {
    return hata(onceki, "Kilit devreye alınamadı.");
  }

  revalidatePath(`/sinif/${sinifId}`);
  return basarili(onceki);
}

/** PIN girilir; doğruysa cihaz öğretmenin seçtiği süre kadar açılır. */
export async function tahtayiAc(onceki: FormState, formData: FormData): Promise<FormState> {
  const pin = metin(formData.get("pin"));
  if (!pin) return hata(onceki, "PIN boş olamaz.");

  let sinifId: string | null = null;
  try {
    const ogretmen = await getCurrentTeacher();
    const durum = await kilitDurumu();
    sinifId = durum.sinifId;
    await kilidiAc(pin, ogretmen.boardPin, ogretmen.boardUnlockMinutes);
  } catch (error) {
    if (error instanceof KilitHatasi) {
      // Kalan bekleme ekrana taşınır: yanlış denemede sayfa tazelenmediği
      // için tuş takımı bunu başka türlü öğrenemez.
      const { bekleSaniye } = await kilitDurumu();
      return hata(onceki, error.message, { bekleSaniye: String(bekleSaniye) });
    }
    return hata(onceki, "Kilit açılamadı.");
  }

  if (sinifId) revalidatePath(`/sinif/${sinifId}`);
  return basarili(onceki);
}

/** Süre dolmadan kilidi geri kapatır. */
export async function tahtayiSimdiKilitle(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const sinifId = metin(formData.get("sinifId"));
  try {
    await getCurrentTeacher();
    await simdiKilitle();
  } catch {
    return hata(onceki, "Kilit kapatılamadı.");
  }

  if (sinifId) revalidatePath(`/sinif/${sinifId}`);
  return basarili(onceki);
}

/** Kilidi cihazdan tamamen kaldırır. Yalnızca kilit açıkken yapılabilir. */
export async function tahtaKilidiniKaldir(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const sinifId = metin(formData.get("sinifId"));
  try {
    await getCurrentTeacher();
    // Kapalı kilit buradan kaldırılamaz; kaldırılabilseydi kilit kilit olmazdı.
    if (await yazmaKilitli()) return hata(onceki, "Önce PIN ile kilidi açın.");
    await kilidiKaldir();
  } catch {
    return hata(onceki, "Kilit kaldırılamadı.");
  }

  if (sinifId) revalidatePath(`/sinif/${sinifId}`);
  return basarili(onceki);
}

/**
 * PIN'i belirler ya da değiştirir. Hesap parolası istenir: PIN'i unutmuş
 * olmak çıkışsız kalmak anlamına gelmesin, ve başkası eline geçen açık bir
 * cihazda PIN'i sessizce değiştiremesin.
 */
export async function tahtaPininiKaydet(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const parola = metin(formData.get("parola"));
  const pin = metin(formData.get("pin"));
  const pinTekrar = metin(formData.get("pinTekrar"));

  if (!parola) return hata(onceki, "Hesap parolanızı girin.");
  if (!pinGecerliMi(pin)) {
    return hata(
      onceki,
      `PIN ${EN_KISA_PIN}-${EN_UZUN_PIN} haneli olmalı ve yalnızca rakam içermeli.`,
    );
  }
  if (pin !== pinTekrar) return hata(onceki, "İki PIN aynı değil.");

  try {
    const ogretmen = await getCurrentTeacher();
    if (!(await parolaDogru(parola, ogretmen.passwordHash))) {
      return hata(onceki, "Hesap parolası yanlış.");
    }
    await prisma.teacher.update({
      where: { id: ogretmen.id },
      data: { boardPin: await pinHashle(pin) },
    });
  } catch {
    return hata(onceki, "PIN kaydedilemedi. Veritabanına ulaşılamıyor olabilir.");
  }

  revalidatePath("/ayarlar");
  return basarili(onceki);
}

/** Kilit açıldığında cihazın kaç dakika açık kalacağı. */
export async function tahtaSuresiniKaydet(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const ham = metin(formData.get("dakika"));
  const dakika = Number(ham);

  if (
    !Number.isInteger(dakika) ||
    dakika < EN_KISA_SURE_DAKIKA ||
    dakika > EN_UZUN_SURE_DAKIKA
  ) {
    return hata(
      onceki,
      `Süre ${EN_KISA_SURE_DAKIKA} ile ${EN_UZUN_SURE_DAKIKA} dakika arasında olmalı.`,
      { dakika: ham },
    );
  }

  try {
    const ogretmen = await getCurrentTeacher();
    await prisma.teacher.update({
      where: { id: ogretmen.id },
      data: { boardUnlockMinutes: dakika },
    });
  } catch {
    return hata(onceki, "Süre kaydedilemedi. Veritabanına ulaşılamıyor olabilir.", {
      dakika: ham,
    });
  }

  revalidatePath("/ayarlar");
  return basarili(onceki);
}
