import Link from "next/link";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { hedefSecenekleri, odevDuzenlemesi, tarihGirdisi } from "@/lib/assignment";
import { OdevFormu, type OdevBaslangici } from "@/components/OdevFormu";

export const dynamic = "force-dynamic";

const BOS: OdevBaslangici = { title: "", description: "", startDate: "", dueDate: "" };

export default async function YeniOdevSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ kaynak?: string }>;
}) {
  const { kaynak } = await searchParams;

  const ogretmen = await getCurrentTeacher();

  // Kopyalama ayrı bir işlem değil: kaynak ödevin alanlarıyla önceden
  // doldurulmuş bir "yeni ödev" formudur. Hedef bilerek boş gelir, çünkü
  // kopyalamanın amacı aynı ödevi BAŞKA bir sınıfa vermektir.
  const [siniflar, kaynakOdev] = await Promise.all([
    hedefSecenekleri(ogretmen.id),
    kaynak ? odevDuzenlemesi(kaynak, ogretmen.id) : Promise.resolve(null),
  ]);

  const baslangic: OdevBaslangici = kaynakOdev
    ? {
        title: kaynakOdev.title,
        description: kaynakOdev.description ?? "",
        startDate: tarihGirdisi(kaynakOdev.startDate),
        dueDate: tarihGirdisi(kaynakOdev.dueDate),
      }
    : BOS;

  return (
    <>
      <Link className="geri" href="/odevler">
        ← Ödevler
      </Link>

      <main className="kart">
        <h1>{kaynakOdev ? "Ödevi kopyala" : "Yeni ödev"}</h1>
        <p className="soluk">
          {kaynakOdev
            ? "Başlık ve içerik kopyalandı. Tarihleri ve kimlere verileceğini seçin."
            : "Ödevi birden fazla sınıfa ya da tek tek seçtiğiniz öğrencilere verebilirsiniz."}
        </p>

        <OdevFormu
          siniflar={siniflar}
          baslangic={baslangic}
          seciliIdler={[]}
          isaretliIdler={[]}
        />
      </main>
    </>
  );
}
