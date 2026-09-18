import { NextResponse } from "next/server";
import { eslesmeyiGetir } from "@/lib/pairing";

export const dynamic = "force-dynamic";

/**
 * Tahtanın yokladığı durum ucu. SALT OKUMA: oturum açmaz, çerez yazmaz.
 * Yalnızca "onaylandı mı, süresi doldu mu" der.
 *
 * Oturum İSTEMEZ — isteyen taraf zaten giriş yapmamış olan tahtadır. Sızan
 * bir bilgi yok: dönen tek şey eşleşmenin durumu ve zaten tahtanın ekranında
 * yazan doğrulama kodu. Oturuma dönüşen adım ayrı uçta ve gizi ister.
 */
export async function GET(
  _istek: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const eslesme = await eslesmeyiGetir(id);
  if (!eslesme) {
    return NextResponse.json({ durum: "BULUNAMADI" }, { status: 404 });
  }
  return NextResponse.json({ durum: eslesme.durum });
}
