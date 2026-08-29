import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { sinifSinavlari, sinifSinavIstatistigi, sinavTarihiYazisi } from "@/lib/exam";

export const dynamic = "force-dynamic";

// Sınıfın sınav görünümü. Ortalamalar yüzde olarak: aynı sınıfta 100'lük bir
// MEB yazılısı ile 60'lık bir Oxford sınavı yan yana durabilir, ham puanlar
// birbiriyle kıyaslanamaz.
//
// Resmî ve deneme ortalaması bilerek AYRI: karneye giren not ile tarama
// sonucu aynı sayıya karışırsa ikisi de anlamını yitirir.

function yuzde(deger: number | null): string {
  return deger === null ? "—" : `%${deger}`;
}

export default async function SinifSinavlariSayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ogretmen = await getCurrentTeacher();

  // Sahiplik üçünün de sorgusunun parçası, o yüzden aynı anda çalışabilirler.
  const [sinif, sinavlar, istatistik] = await Promise.all([
    prisma.classroom.findFirst({
      where: { id, teacherId: ogretmen.id },
      select: { id: true, name: true },
    }),
    sinifSinavlari(id, ogretmen.id),
    sinifSinavIstatistigi(id, ogretmen.id),
  ]);
  if (!sinif) notFound();

  return (
    <>
      <Link className="geri" href={`/sinif/${sinif.id}`}>
        ← {sinif.name}
      </Link>

      <main className="kart">
        <div className="sayfa-basi">
          <h1>{sinif.name} · Sınavlar</h1>
          <Link className="baglanti" href="/sinavlar/yeni">
            + Yeni sınav
          </Link>
        </div>

        {/* Sayımlar yalnızca bu sınıfın öğrencilerinden; aynı sınav başka
            şubeye de verilmişse oradaki puanlar buraya karışmaz. */}
        <div className="olcum-satiri">
          <div className="olcum">
            <span className="olcum-deger">{yuzde(istatistik.resmiOrtalama)}</span>
            <span className="olcum-etiket">resmî ortalama</span>
          </div>
          <div className="olcum">
            <span className="olcum-deger">{yuzde(istatistik.denemeOrtalama)}</span>
            <span className="olcum-etiket">deneme ortalaması</span>
          </div>
          <div className="olcum">
            <span className="olcum-deger">{sinavlar.length}</span>
            <span className="olcum-etiket">sınav</span>
          </div>
        </div>

        {sinavlar.length === 0 ? (
          <p className="soluk">Bu sınıfa henüz sınav verilmedi.</p>
        ) : (
          <ul className="liste">
            {sinavlar.map((sinav) => (
              <li key={sinav.id}>
                <Link className="satir" href={`/sinavlar/${sinav.id}`}>
                  <span className="satir-ad">
                    {sinav.title}
                    <span className="soluk odev-tarih">
                      {sinavTarihiYazisi(sinav.examDate)} · {sinav.donem.etiket}
                    </span>
                  </span>
                  <span className="satir-sag">
                    {sinav.scope === "OFFICIAL" && (
                      <span className="rozet rozet-resmi">Resmî</span>
                    )}
                    <span className="oran">{yuzde(sinav.sayimlar.ortalamaYuzde)}</span>
                    <span className="rozet">
                      {sinav.sayimlar.girilmis}/{sinav.sayimlar.toplam}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Öğrenci dökümü: en düşük resmî ortalama üstte, yani öğretmenin kime
          bakması gerektiği listenin başında durur. */}
      {istatistik.ogrenciler.length > 0 && (
        <section className="kart">
          <h2>Öğrenci dökümü</h2>
          <ul className="liste">
            {istatistik.ogrenciler.map((satir) => (
              <li key={satir.ogrenciId}>
                <Link className="satir" href={`/ogrenci/${satir.ogrenciId}`}>
                  <span className="satir-ad">{satir.ad}</span>
                  <span className="satir-sag">
                    <span className="rozet">{satir.girilmisSinav} sınav</span>
                    {satir.denemeOrtalama !== null && (
                      <span className="rozet">deneme {yuzde(satir.denemeOrtalama)}</span>
                    )}
                    <span className="oran">{yuzde(satir.resmiOrtalama)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
