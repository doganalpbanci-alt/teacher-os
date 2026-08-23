import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { dersGecmisi, dersTarihiYazisi, saatYazisi } from "@/lib/lesson";

export const dynamic = "force-dynamic";

export default async function DersGecmisiSayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ogretmen = await getCurrentTeacher();

  // Sahiplik her iki sorgunun da parcasi, o yuzden ayni anda calisabilirler.
  const [sinif, dersler] = await Promise.all([
    prisma.classroom.findFirst({
      where: { id, teacherId: ogretmen.id },
      select: { id: true, name: true },
    }),
    dersGecmisi(id, ogretmen.id),
  ]);
  if (!sinif) notFound();
  const kartSistemi = ogretmen.behaviorTemplate === "CARD";

  return (
    <>
      <Link className="geri" href={`/sinif/${sinif.id}`}>
        ← {sinif.name}
      </Link>

      <main className="kart">
        <h1>Ders geçmişi</h1>
        <p className="soluk">{dersler.length} ders</p>

        {dersler.length === 0 ? (
          <p className="soluk">Bu sınıfta henüz ders işlenmedi.</p>
        ) : (
          <ul className="liste">
            {dersler.map((ders) => (
              <li key={ders.id}>
                <Link
                  className="satir baglanti"
                  href={`/sinif/${sinif.id}/dersler/${ders.id}`}
                >
                  <span className="satir-ad">
                    {dersTarihiYazisi(ders.tarih)} ({ders.gunlukSira}. ders)
                    {ders.bitis && (
                      <span className="soluk"> · bitiş {saatYazisi(ders.bitis)}</span>
                    )}
                  </span>
                  <span className="satir-sag">
                    {ders.suruyor && <span className="rozet ders-suruyor">Sürüyor</span>}
                    {kartSistemi ? (
                      <span className="rozet">
                        {ders.sayimlar.arti} yıldız · {ders.sayimlar.sariKart} sarı ·{" "}
                        {ders.sayimlar.kirmiziKart} kırmızı
                      </span>
                    ) : (
                      <span className="rozet">
                        {ders.sayimlar.arti} artı · {ders.sayimlar.eksi} eksi
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
