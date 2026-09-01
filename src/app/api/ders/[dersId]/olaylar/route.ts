import { NextResponse } from "next/server";
import { oturumdakiOgretmenId } from "@/lib/auth";
import { dersOlaylari } from "@/lib/board-events";

export const dynamic = "force-dynamic";

/**
 * Tahtanın canlı yayınının yokladığı uç nokta. `sonrasi` verilen andan
 * sonraki kayıtları döner; istemci döneni bir sonraki istekte `sonrasi`
 * olarak geri gönderir.
 *
 * Zaman karşılaştırması sunucu saatiyle yapılır: istemcinin kendi saati
 * (akıllı tahtanın sistem saati güvenilir olmayabilir) hiç kullanılmaz,
 * yalnızca sunucunun döndürdüğü değer taşınır.
 */
export async function GET(
  istek: Request,
  { params }: { params: Promise<{ dersId: string }> },
) {
  const ogretmenId = await oturumdakiOgretmenId();
  if (!ogretmenId) {
    return NextResponse.json({ hata: "Oturum yok." }, { status: 401 });
  }

  const { dersId } = await params;
  const sonrasiHam = new URL(istek.url).searchParams.get("sonrasi");
  const sonrasi = sonrasiHam ? new Date(sonrasiHam) : new Date(0);
  if (Number.isNaN(sonrasi.getTime())) {
    return NextResponse.json({ hata: "Geçersiz zaman parametresi." }, { status: 400 });
  }

  const sonuc = await dersOlaylari(dersId, ogretmenId, sonrasi);
  return NextResponse.json(sonuc);
}
