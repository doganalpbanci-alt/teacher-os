"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { eslesmeOlustur, eslesmeyiOnayla } from "@/lib/pairing";
import { ESLESME_CEREZI, ESLESME_CEREZ_AYARLARI } from "@/lib/pairing-rules";

/**
 * Tahtada yeni bir QR açar. OTURUM İSTEMEZ: bunu isteyen taraf henüz giriş
 * yapmamış olan tahtadır, zaten giriş yapmak için buradadır.
 *
 * Gizi çereze yazan yer burasıdır. Sunucu bileşeni çerez yazamaz; bu yüzden
 * QR'ı sayfa değil, bu eylem üretir ve sayfa yalnızca çerezdeki eşleşmeyi
 * gösterir.
 */
export async function qrOlustur(): Promise<void> {
  const eslesme = await eslesmeOlustur();
  const cerezler = await cookies();
  cerezler.set(ESLESME_CEREZI, `${eslesme.id}.${eslesme.giz}`, ESLESME_CEREZ_AYARLARI);
  redirect("/giris/qr");
}

export type OnayDurumu = { hata?: string; onaylandi?: boolean };

/**
 * Öğretmen tahtadaki oturumu onaylar. Oturum, ONAYLAYAN öğretmen için açılır —
 * `getCurrentTeacher` zaten oturum yoksa girişe yönlendirir.
 */
export async function eslesmeOnayla(
  _onceki: OnayDurumu,
  formData: FormData,
): Promise<OnayDurumu> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { hata: "Eşleşme bulunamadı." };
  }

  const ogretmen = await getCurrentTeacher();
  const sonuc = await eslesmeyiOnayla(id, ogretmen.id);

  if (sonuc === "BULUNAMADI") return { hata: "Eşleşme bulunamadı." };
  if (sonuc === "GECERSIZ_DURUM") {
    return {
      hata: "Bu QR artık geçerli değil. Tahtada yeni bir QR oluşturup tekrar okutun.",
    };
  }
  return { onaylandi: true };
}
