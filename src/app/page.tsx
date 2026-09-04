import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { SinifFormu } from "@/components/SinifFormu";
import { UstMenu } from "@/components/UstMenu";
import { GundemPaneli } from "@/components/GundemPaneli";
import { gunlukGundem, type Gundem } from "@/lib/assignment";

// Her istekte veritabanına gidilir; build sırasında önceden üretilmez.
export const dynamic = "force-dynamic";

type Sinif = { id: string; name: string; _count: { students: number } };

type Sonuc =
  | { ok: true; siniflar: Sinif[]; arsivliSiniflar: Sinif[]; gundem: Gundem }
  | { ok: false; mesaj: string };

async function anaSayfaVerisi(): Promise<Sonuc> {
  try {
    const ogretmen = await getCurrentTeacher();
    // Ucu de ayni ogretmene bakar, birbirini beklemez.
    const [siniflar, arsivliSiniflar, gundem] = await Promise.all([
      prisma.classroom.findMany({
        where: { teacherId: ogretmen.id, isActive: true },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, _count: { select: { students: true } } },
      }),
      // Arşivlenmiş sınıfı geri açma yolu burası: kendi listesinden kalkınca
      // bir daha görünmez, ama tamamen kaybolmaz. Arşivden çıkarma düğmesi
      // sınıfın kendi sayfasında (SinifYonetimi).
      prisma.classroom.findMany({
        where: { teacherId: ogretmen.id, isActive: false },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, _count: { select: { students: true } } },
      }),
      gunlukGundem(ogretmen.id),
    ]);
    return { ok: true, siniflar, arsivliSiniflar, gundem };
  } catch (error) {
    return {
      ok: false,
      mesaj: error instanceof Error ? error.message : String(error),
    };
  }
}

export default async function AnaSayfa() {
  const sonuc = await anaSayfaVerisi();

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

      {/* Gündem sınıfların ÜSTÜNDE: derse girmeden önce görülmesi gereken
          şey bu. Yapacak iş yoksa panel hiç çıkmaz, yer kaplamaz. */}
      <GundemPaneli gundem={sonuc.gundem} />

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

      {sonuc.arsivliSiniflar.length > 0 && (
        <details className="kart katlanir">
          <summary>Arşivlenmiş sınıflar ({sonuc.arsivliSiniflar.length})</summary>
          <ul className="liste">
            {sonuc.arsivliSiniflar.map((sinif) => (
              <li key={sinif.id}>
                <Link className="satir" href={`/sinif/${sinif.id}`}>
                  <span className="satir-ad">{sinif.name}</span>
                  <span className="rozet">{sinif._count.students} öğrenci</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
