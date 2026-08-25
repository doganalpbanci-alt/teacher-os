import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { hedefSecenekleri, odevDuzenlemesi, tarihGirdisi } from "@/lib/assignment";
import { OdevFormu } from "@/components/OdevFormu";

export const dynamic = "force-dynamic";

export default async function OdevDuzenleSayfasi({
  params,
}: {
  params: Promise<{ odevId: string }>;
}) {
  const { odevId } = await params;

  const ogretmen = await getCurrentTeacher();
  // Sahiplik her iki sorgunun da parcasi, o yuzden ayni anda calisabilirler.
  const [siniflar, odev] = await Promise.all([
    hedefSecenekleri(ogretmen.id),
    odevDuzenlemesi(odevId, ogretmen.id),
  ]);
  if (!odev) notFound();

  return (
    <>
      <Link className="geri" href={`/odevler/${odev.id}`}>
        ← {odev.title}
      </Link>

      <main className="kart">
        <h1>Ödevi düzenle</h1>
        <p className="soluk">
          Seçimden çıkarılan öğrencinin teslim kaydı silinir. İşaretlenmiş bir
          öğrenci çıkarılıyorsa form bunu ayrıca yazar.
        </p>

        <OdevFormu
          siniflar={siniflar}
          odevId={odev.id}
          baslangic={{
            title: odev.title,
            description: odev.description ?? "",
            startDate: tarihGirdisi(odev.startDate),
            dueDate: tarihGirdisi(odev.dueDate),
          }}
          seciliIdler={odev.ogrenciIdleri}
          isaretliIdler={odev.isaretliOgrenciIdleri}
        />
      </main>
    </>
  );
}
