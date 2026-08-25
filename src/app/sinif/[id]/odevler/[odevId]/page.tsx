import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { odevDetayi, odevTarihiYazisi } from "@/lib/assignment";
import { TeslimDurumu } from "@/components/TeslimDurumu";

export const dynamic = "force-dynamic";

export default async function OdevDetaySayfasi({
  params,
}: {
  params: Promise<{ id: string; odevId: string }>;
}) {
  const { id, odevId } = await params;

  const ogretmen = await getCurrentTeacher();
  // Sahiplik odevDetayi icinde sorgunun parcasi; baskasinin odevi ya da
  // yanlis sinif altindaki id null doner, sayfa 404 verir.
  const detay = await odevDetayi(odevId, id, ogretmen.id);
  if (!detay) notFound();

  return (
    <>
      <Link className="geri" href={`/sinif/${id}/odevler`}>
        ← Ödevler
      </Link>

      <main className="kart">
        <h1>{detay.odev.title}</h1>
        {detay.odev.description && <p className="soluk">{detay.odev.description}</p>}
        <p className="soluk">
          {detay.odev.dueDate
            ? `Son teslim: ${odevTarihiYazisi(detay.odev.dueDate)}`
            : "Son teslim tarihi belirlenmedi"}
        </p>

        {detay.teslimler.length === 0 ? (
          <p className="soluk">Bu sınıfta öğrenci yok.</p>
        ) : (
          <ul className="liste">
            {detay.teslimler.map((teslim) => (
              <li key={teslim.submissionId}>
                <div className="satir">
                  <Link className="satir-ad" href={`/ogrenci/${teslim.ogrenciId}`}>
                    {teslim.ad}
                  </Link>
                  <TeslimDurumu
                    submissionId={teslim.submissionId}
                    sinifId={id}
                    odevId={odevId}
                    durum={teslim.status}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
