import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { ogrenciSayimlari } from "@/lib/behavior";
import { NotFormu } from "@/components/NotFormu";

export const dynamic = "force-dynamic";

export default async function OgrenciSayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ogrenci = await prisma.student.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      parentName: true,
      parentPhone: true,
      performanceScore: true,
      classroom: { select: { id: true, name: true } },
    },
  });

  if (!ogrenci) notFound();

  const ogretmen = await getCurrentTeacher();
  const kartSistemi = ogretmen.behaviorTemplate === "CARD";
  const sayim = (await ogrenciSayimlari([ogrenci.id])).get(ogrenci.id) ?? {
    arti: 0,
    eksi: 0,
  };

  return (
    <>
      <Link className="geri" href={ogrenci.classroom ? `/sinif/${ogrenci.classroom.id}` : "/"}>
        ← {ogrenci.classroom ? ogrenci.classroom.name : "Sınıflarım"}
      </Link>

      <main className="kart">
        <h1>
          {ogrenci.firstName} {ogrenci.lastName}
        </h1>
        <p className="soluk">
          {ogrenci.classroom ? ogrenci.classroom.name : "Sınıfa atanmamış"}
          {ogrenci.parentName ? ` · Veli: ${ogrenci.parentName}` : ""}
          {ogrenci.parentPhone ? ` · ${ogrenci.parentPhone}` : ""}
        </p>

        <div className="olcum-satiri">
          <div className="olcum">
            <span className="olcum-deger">{sayim.arti}</span>
            <span className="olcum-etiket">artı</span>
          </div>
          <div className="olcum">
            <span className="olcum-deger">{sayim.eksi}</span>
            <span className="olcum-etiket">eksi</span>
          </div>
          <div className="olcum">
            <span className="olcum-deger">{ogrenci.performanceScore}</span>
            <span className="olcum-etiket">performans notu</span>
          </div>
        </div>
      </main>

      <section className="kart">
        <h2>Performans notu</h2>
        {kartSistemi ? (
          <p className="soluk">
            Kart sisteminde not kayıtlardan otomatik hesaplanır, elle
            değiştirilmez. Elle girmek için <Link href="/ayarlar">ayarlardan</Link>{" "}
            basit sisteme geçin.
          </p>
        ) : (
          <>
            <p className="soluk">
              Artı ve eksi sayılarına bakarak notu kendiniz belirlersiniz.
              Uygulama bu değeri kendiliğinden değiştirmez.
            </p>
            <NotFormu ogrenciId={ogrenci.id} mevcutNot={ogrenci.performanceScore} />
          </>
        )}
      </section>

      <section className="kart">
        <h2>Geçmiş</h2>
        <p className="soluk">
          Öğrencinin bütün artı, eksi ve kart kayıtları burada listelenecek.
          Sıradaki adımda ekleniyor.
        </p>
      </section>
    </>
  );
}
