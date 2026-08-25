import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { SinifFormu } from "@/components/SinifFormu";
import { UstMenu } from "@/components/UstMenu";

// Her istekte veritabanına gidilir; build sırasında önceden üretilmez.
export const dynamic = "force-dynamic";

type Sinif = { id: string; name: string; _count: { students: number } };

type Sonuc =
  | { ok: true; siniflar: Sinif[] }
  | { ok: false; mesaj: string };

async function siniflariGetir(): Promise<Sonuc> {
  try {
    const ogretmen = await getCurrentTeacher();
    const siniflar = await prisma.classroom.findMany({
      where: { teacherId: ogretmen.id, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, _count: { select: { students: true } } },
    });
    return { ok: true, siniflar };
  } catch (error) {
    return {
      ok: false,
      mesaj: error instanceof Error ? error.message : String(error),
    };
  }
}

export default async function AnaSayfa() {
  const sonuc = await siniflariGetir();

  if (!sonuc.ok) {
    return (
      <main className="kart">
        <h1>Teacher OS</h1>
        <p className="uyari">Veritabanına bağlanılamadı.</p>
        <pre className="kod">{sonuc.mesaj}</pre>
      </main>
    );
  }

  return (
    <>
      <UstMenu aktif="siniflar" />

      <main className="kart">
        <div className="sayfa-basi">
          <h1>Sınıflarım</h1>
        </div>
        {sonuc.siniflar.length === 0 ? (
          <p className="soluk">
            Henüz sınıf yok. Aşağıdaki formdan ilk sınıfınızı ekleyin.
          </p>
        ) : (
          <ul className="liste">
            {sonuc.siniflar.map((sinif) => (
              <li key={sinif.id}>
                <Link className="satir" href={`/sinif/${sinif.id}`}>
                  <span className="satir-ad">{sinif.name}</span>
                  <span className="rozet">{sinif._count.students} öğrenci</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <section className="kart">
        <h2>Yeni sınıf</h2>
        <SinifFormu />
      </section>
    </>
  );
}
