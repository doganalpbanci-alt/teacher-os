import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { hedefSecenekleri } from "@/lib/assignment";
import { sinavDuzenlemesi, tarihGirdisi } from "@/lib/exam";
import { SinavFormu } from "@/components/SinavFormu";

export const dynamic = "force-dynamic";

export default async function SinavDuzenleSayfasi({
  params,
}: {
  params: Promise<{ sinavId: string }>;
}) {
  const { sinavId } = await params;

  const ogretmen = await getCurrentTeacher();
  // Sahiplik her iki sorgunun da parçası, o yüzden aynı anda çalışabilirler.
  const [siniflar, sinav] = await Promise.all([
    hedefSecenekleri(ogretmen.id),
    sinavDuzenlemesi(sinavId, ogretmen.id),
  ]);
  if (!sinav) notFound();

  return (
    <>
      <Link className="geri" href={`/sinavlar/${sinav.id}`}>
        ← {sinav.title}
      </Link>

      <main className="kart">
        <h1>Sınavı düzenle</h1>
        <p className="soluk">
          Seçimden çıkarılan öğrencinin sınav kaydı silinir. Kaldırılan bir
          bileşenin girilmiş notları da silinir; form ikisini de önceden yazar.
        </p>

        <SinavFormu
          siniflar={siniflar}
          sinavId={sinav.id}
          baslangic={{
            title: sinav.title,
            examDate: tarihGirdisi(sinav.examDate),
            maxScore: String(sinav.maxScore),
            scope: sinav.scope,
            bilesenler: sinav.bilesenler.map((b) => ({
              id: b.id,
              name: b.name,
              weight: String(b.weight),
              maxScore: String(b.maxScore),
              entry: b.entry,
              questionCount: b.questionCount === null ? "" : String(b.questionCount),
              wrongDivisor: b.wrongDivisor === null ? "" : String(b.wrongDivisor),
              girdiSayisi: b.girdiSayisi,
            })),
          }}
          seciliIdler={sinav.ogrenciIdleri}
          islenmisIdler={sinav.islenmisOgrenciIdleri}
        />
      </main>
    </>
  );
}
