import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { sinifOdevleri, odevTarihiYazisi } from "@/lib/assignment";
import { OdevFormu } from "@/components/OdevFormu";

export const dynamic = "force-dynamic";

export default async function OdevlerSayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ogretmen = await getCurrentTeacher();

  // Sahiplik her iki sorgunun da parcasi, o yuzden ayni anda calisabilirler.
  const [sinif, odevler] = await Promise.all([
    prisma.classroom.findFirst({
      where: { id, teacherId: ogretmen.id },
      select: { id: true, name: true },
    }),
    sinifOdevleri(id, ogretmen.id),
  ]);
  if (!sinif) notFound();

  return (
    <>
      <Link className="geri" href={`/sinif/${sinif.id}`}>
        ← {sinif.name}
      </Link>

      <main className="kart">
        <h1>Ödevler</h1>
        <p className="soluk">{odevler.length} ödev</p>

        {odevler.length === 0 ? (
          <p className="soluk">
            Bu sınıfta henüz ödev yok. Aşağıdaki formdan ekleyebilirsiniz.
          </p>
        ) : (
          <ul className="liste">
            {odevler.map((odev) => (
              <li key={odev.id}>
                <Link
                  className="satir baglanti"
                  href={`/sinif/${sinif.id}/odevler/${odev.id}`}
                >
                  <span className="satir-ad">
                    {odev.title}
                    {odev.dueDate && (
                      <span className="soluk">
                        {" "}
                        · son teslim {odevTarihiYazisi(odev.dueDate)}
                      </span>
                    )}
                  </span>
                  <span className="rozet">
                    {odev.sayimlar.done} yapıldı · {odev.sayimlar.missing} eksik ·{" "}
                    {odev.sayimlar.late} geç · {odev.sayimlar.pending} bekliyor
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <details className="kart katlanir">
        <summary>Yeni ödev</summary>
        <OdevFormu sinifId={sinif.id} />
      </details>
    </>
  );
}
