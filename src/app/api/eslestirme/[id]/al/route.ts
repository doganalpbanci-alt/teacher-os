import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { oturumAc } from "@/lib/auth";
import { oturumuAl } from "@/lib/pairing";
import { cereziCoz, ESLESME_CEREZI } from "@/lib/pairing-rules";

export const dynamic = "force-dynamic";

/**
 * Tahta, onaylanmış eşleşmenin oturumunu alır.
 *
 * ASIL KORUMA BURADA: giz, adresten ya da gövdeden değil, tahtanın kendi
 * httpOnly ÇEREZİNDEN okunur. QR'ın fotoğrafını çeken bir cihaz o çerezi
 * taşımaz; eşleşme onaylanmış olsa bile bu ucu boşuna çağırır.
 *
 * POST: yan etkisi var (oturum açar, eşleşmeyi tüketir). GET olsaydı
 * tarayıcının bir ön-yüklemesi eşleşmeyi sessizce harcayabilirdi.
 *
 * Çerezdeki id ile adresteki id aynı olmak zorunda: tahta yalnızca KENDİ
 * açtığı eşleşmenin oturumunu alabilir.
 */
export async function POST(
  _istek: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const cerezler = await cookies();
  const cerez = cereziCoz(cerezler.get(ESLESME_CEREZI)?.value);

  if (!cerez || cerez.id !== id) {
    return NextResponse.json({ tamam: false, sebep: "GIZ_YANLIS" }, { status: 403 });
  }

  const sonuc = await oturumuAl(id, cerez.giz);
  if (!sonuc.tamam) {
    return NextResponse.json(
      { tamam: false, sebep: sonuc.sebep },
      { status: sonuc.sebep === "BULUNAMADI" ? 404 : 403 },
    );
  }

  await oturumAc(sonuc.ogretmenId);
  // Eşleşme tükendi; çerez de gitsin, ekranda unutulan bir tahtada boşuna
  // durmasın.
  cerezler.delete(ESLESME_CEREZI);
  return NextResponse.json({ tamam: true });
}
