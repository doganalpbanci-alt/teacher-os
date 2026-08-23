"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { FormState } from "@/lib/form-state";
import {
  EN_KISA_PAROLA,
  KURULUM_BEKLIYOR,
  kurulumTamamlandiMi,
  oturumAc,
  oturumKapat,
  parolaDogru,
  parolaHashle,
} from "@/lib/auth";

function metin(deger: FormDataEntryValue | null): string {
  return typeof deger === "string" ? deger.trim() : "";
}

function hata(onceki: FormState, mesaj: string, degerler: Record<string, string>): FormState {
  return { hata: mesaj, deneme: onceki.deneme + 1, degerler };
}

// Cok basit bir kontrol; amac yazim hatasini yakalamak, RFC dogrulamak degil.
const EPOSTA_BICIMI = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function girisYap(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const eposta = metin(formData.get("eposta")).toLowerCase();
  const parola = metin(formData.get("parola"));
  const girilen = { eposta };

  if (!eposta || !parola) {
    return hata(onceki, "E-posta ve parola gerekli.", girilen);
  }

  try {
    const ogretmen = await prisma.teacher.findUnique({ where: { email: eposta } });
    // Hangisinin yanlis oldugu soylenmez; aksi halde hangi e-postalarin
    // kayitli oldugu tek tek ogrenilebilir.
    if (!ogretmen || !(await parolaDogru(parola, ogretmen.passwordHash))) {
      return hata(onceki, "E-posta veya parola hatalı.", girilen);
    }
    await oturumAc(ogretmen.id);
  } catch {
    return hata(onceki, "Giriş yapılamadı. Lütfen tekrar deneyin.", girilen);
  }

  // redirect bir istisna firlatir; try blogunun disinda cagrilmali.
  redirect("/");
}

export async function kurulumuTamamla(
  onceki: FormState,
  formData: FormData,
): Promise<FormState> {
  const ad = metin(formData.get("ad"));
  const eposta = metin(formData.get("eposta")).toLowerCase();
  const parola = metin(formData.get("parola"));
  const parolaTekrar = metin(formData.get("parolaTekrar"));
  const girilen = { ad, eposta };

  if (!ad) return hata(onceki, "Ad boş olamaz.", girilen);
  if (!EPOSTA_BICIMI.test(eposta)) return hata(onceki, "Geçerli bir e-posta girin.", girilen);
  if (parola.length < EN_KISA_PAROLA) {
    return hata(onceki, `Parola en az ${EN_KISA_PAROLA} karakter olmalı.`, girilen);
  }
  if (parola !== parolaTekrar) return hata(onceki, "Parolalar aynı değil.", girilen);

  try {
    if (await kurulumTamamlandiMi()) {
      return hata(onceki, "Kurulum zaten tamamlanmış. Giriş sayfasını kullanın.", girilen);
    }

    const hashlenmis = await parolaHashle(parola);

    // Giris sistemi oncesinde olusan gecici kayit varsa YENISI ACILMAZ, o kayit
    // devralinir: siniflar, ogrenciler ve tum davranis gecmisi ona bagli.
    const gecici = await prisma.teacher.findFirst({
      where: { passwordHash: { startsWith: KURULUM_BEKLIYOR } },
      orderBy: { createdAt: "asc" },
    });

    const ayniEposta = await prisma.teacher.findUnique({ where: { email: eposta } });
    if (ayniEposta && ayniEposta.id !== gecici?.id) {
      return hata(onceki, "Bu e-posta zaten kullanılıyor.", girilen);
    }

    const ogretmen = gecici
      ? await prisma.teacher.update({
          where: { id: gecici.id },
          data: { name: ad, email: eposta, passwordHash: hashlenmis },
        })
      : await prisma.teacher.create({
          data: { name: ad, email: eposta, passwordHash: hashlenmis },
        });

    await oturumAc(ogretmen.id);
  } catch {
    return hata(onceki, "Hesap oluşturulamadı. Lütfen tekrar deneyin.", girilen);
  }

  redirect("/");
}

export async function cikisYap(): Promise<void> {
  await oturumKapat();
  redirect("/giris");
}
