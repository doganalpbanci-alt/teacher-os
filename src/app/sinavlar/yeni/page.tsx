import Link from "next/link";
import { getCurrentTeacher } from "@/lib/current-teacher";
// Hedef seçimi ödevle ortak: aynı "öğretmenin sınıf ve öğrencileri" sorusu.
import { hedefSecenekleri } from "@/lib/assignment";
import { sinavDuzenlemesi, tarihGirdisi } from "@/lib/exam";
import { SinavFormu, type SinavBaslangici } from "@/components/SinavFormu";
import { bosBilesen } from "@/lib/exam-rules";

export const dynamic = "force-dynamic";

export default async function YeniSinavSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ kaynak?: string }>;
}) {
  const { kaynak } = await searchParams;

  const ogretmen = await getCurrentTeacher();

  // Kopyalama ayrı bir işlem değil: kaynak sınavın düzeniyle önceden
  // doldurulmuş bir "yeni sınav" formudur. Aynı sınav başka şubeye
  // verilirken bileşenleri baştan yazmak gerekmesin diye. Hedef bilerek boş
  // gelir, çünkü kopyalamanın amacı BAŞKA bir sınıfa vermektir.
  const [siniflar, kaynakSinav] = await Promise.all([
    hedefSecenekleri(ogretmen.id),
    kaynak ? sinavDuzenlemesi(kaynak, ogretmen.id) : Promise.resolve(null),
  ]);

  const baslangic: SinavBaslangici = kaynakSinav
    ? {
        title: kaynakSinav.title,
        examDate: tarihGirdisi(kaynakSinav.examDate),
        maxScore: String(kaynakSinav.maxScore),
        scope: kaynakSinav.scope,
        bilesenler: kaynakSinav.bilesenler.map((b) => ({
          // Kopyada id taşınmaz: bunlar yeni sınavın kendi bileşenleridir.
          id: null,
          name: b.name,
          weight: String(b.weight),
          maxScore: String(b.maxScore),
          entry: b.entry,
          questionCount: b.questionCount === null ? "" : String(b.questionCount),
          wrongDivisor: b.wrongDivisor === null ? "" : String(b.wrongDivisor),
          girdiSayisi: 0,
        })),
      }
    : {
        title: "",
        examDate: "",
        maxScore: "100",
        scope: "PRACTICE",
        bilesenler: [{ ...bosBilesen(), name: "Puan", weight: "100" }],
      };

  return (
    <>
      <Link className="geri" href="/sinavlar">
        ← Sınavlar
      </Link>

      <main className="kart">
        <h1>{kaynakSinav ? "Sınavı kopyala" : "Yeni sınav"}</h1>
        <p className="soluk">
          {kaynakSinav
            ? "Bileşenler ve tam puan kopyalandı. Tarihi ve kimlere verileceğini seçin."
            : "Sınavı birden fazla sınıfa ya da tek tek seçtiğiniz öğrencilere verebilirsiniz."}
        </p>

        <SinavFormu
          siniflar={siniflar}
          baslangic={baslangic}
          seciliIdler={[]}
          islenmisIdler={[]}
        />
      </main>
    </>
  );
}
