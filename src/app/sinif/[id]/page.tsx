import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OgrenciFormu } from "@/components/OgrenciFormu";

export const dynamic = "force-dynamic";

export default async function SinifSayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const sinif = await prisma.classroom.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      students: {
        where: { isActive: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          performanceScore: true,
        },
      },
    },
  });

  if (!sinif) notFound();

  return (
    <>
      <Link className="geri" href="/">
        ← Sınıflarım
      </Link>

      <main className="kart">
        <h1>{sinif.name}</h1>
        <p className="soluk">{sinif.students.length} öğrenci</p>

        {sinif.students.length === 0 ? (
          <p className="soluk">
            Bu sınıfta henüz öğrenci yok. Aşağıdaki formdan ekleyebilirsiniz.
          </p>
        ) : (
          <ul className="liste">
            {sinif.students.map((ogrenci) => (
              <li key={ogrenci.id}>
                <div className="satir">
                  <span className="satir-ad">
                    {ogrenci.firstName} {ogrenci.lastName}
                  </span>
                  <span className="rozet">{ogrenci.performanceScore} puan</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <section className="kart">
        <h2>Yeni öğrenci</h2>
        <OgrenciFormu sinifId={sinif.id} />
      </section>
    </>
  );
}
