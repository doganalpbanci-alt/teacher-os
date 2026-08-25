import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTeacher } from "@/lib/current-teacher";
import {
  sinifOdevleri,
  sinifOdevIstatistigi,
  odevTarihiYazisi,
} from "@/lib/assignment";

export const dynamic = "force-dynamic";

export default async function SinifOdevleriSayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ogretmen = await getCurrentTeacher();

  // Sahiplik ucunun de sorgusunun parcasi, o yuzden ayni anda calisabilirler.
  const [sinif, odevler, istatistik] = await Promise.all([
    prisma.classroom.findFirst({
      where: { id, teacherId: ogretmen.id },
      select: { id: true, name: true },
    }),
    sinifOdevleri(id, ogretmen.id),
    sinifOdevIstatistigi(id, ogretmen.id),
  ]);
  if (!sinif) notFound();

  return (
    <>
      <Link className="geri" href={`/sinif/${sinif.id}`}>
        ← {sinif.name}
      </Link>

      <main className="kart">
        <div className="sayfa-basi">
          <h1>{sinif.name} · Ödevler</h1>
          <Link className="baglanti" href="/odevler/yeni">
            + Yeni ödev
          </Link>
        </div>

        {/* Sayımlar yalnızca bu sınıfın öğrencilerinden; aynı ödev başka
            sınıfa da verilmişse oradaki durumlar buraya karışmaz. */}
        <div className="olcum-satiri">
          <div className="olcum">
            <span className="olcum-deger">%{istatistik.toplam.oran}</span>
            <span className="olcum-etiket">tamamlanma</span>
          </div>
          <div className="olcum">
            <span className="olcum-deger">{odevler.length}</span>
            <span className="olcum-etiket">ödev</span>
          </div>
          <div className="olcum">
            <span className="olcum-deger">{istatistik.toplam.missing}</span>
            <span className="olcum-etiket">eksik</span>
          </div>
          <div className="olcum">
            <span className="olcum-deger">{istatistik.toplam.pending}</span>
            <span className="olcum-etiket">bekliyor</span>
          </div>
        </div>

        {odevler.length === 0 ? (
          <p className="soluk">Bu sınıfa henüz ödev verilmedi.</p>
        ) : (
          <ul className="liste">
            {odevler.map((odev) => (
              <li key={odev.id}>
                <Link className="satir" href={`/odevler/${odev.id}`}>
                  <span className="satir-ad">
                    {odev.title}
                    <span className="soluk odev-tarih">
                      {odev.dueDate
                        ? `son teslim ${odevTarihiYazisi(odev.dueDate)}`
                        : "tarihsiz"}
                    </span>
                  </span>
                  <span className="satir-sag">
                    {odev.gecikti && <span className="rozet gecikti">Süresi geçti</span>}
                    <span className="oran">%{odev.sayimlar.oran}</span>
                    <span className="rozet">
                      {odev.sayimlar.done + odev.sayimlar.late}/{odev.sayimlar.toplam}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Öğrenci dökümü: en düşük tamamlanma oranı üstte, yani öğretmenin
          kime bakması gerektiği listenin başında durur. */}
      {istatistik.ogrenciler.length > 0 && (
        <section className="kart">
          <h2>Öğrenci dökümü</h2>
          <ul className="liste">
            {istatistik.ogrenciler.map((satir) => (
              <li key={satir.ogrenciId}>
                <Link className="satir" href={`/ogrenci/${satir.ogrenciId}`}>
                  <span className="satir-ad">{satir.ad}</span>
                  <span className="satir-sag">
                    {satir.sayimlar.missing > 0 && (
                      <span className="teslim-rozet t-missing">
                        {satir.sayimlar.missing} eksik
                      </span>
                    )}
                    <span className="rozet">
                      {satir.sayimlar.done + satir.sayimlar.late}/
                      {satir.sayimlar.toplam}
                    </span>
                    <span className="oran">
                      {satir.sayimlar.toplam === 0 ? "—" : `%${satir.sayimlar.oran}`}
                    </span>
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
