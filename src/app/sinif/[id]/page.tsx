import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { aktifDersiGetir, dersTarihiYazisi } from "@/lib/lesson";
import { dersKartDurumlari, ogrenciSayimlari, type KartDurumu } from "@/lib/behavior";
import { OgrenciFormu } from "@/components/OgrenciFormu";
import { DersKontrolu } from "@/components/DersKontrolu";
import { OgrenciSatiri, type CezaOzeti } from "@/components/OgrenciSatiri";
import { bekleyenCezalar } from "@/lib/penalty";
import type { Sayimlar } from "@/lib/behavior";

export const dynamic = "force-dynamic";

export default async function SinifSayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ogretmen = await getCurrentTeacher();

  // Sahiplik her iki sorgunun da parcasi: baskasinin sinifi 404 doner, dersi
  // bos doner. Ikisi birbirini beklemedigi icin ayni anda calisirlar.
  const [sinif, aktifDers] = await Promise.all([
    prisma.classroom.findFirst({
      where: { id, teacherId: ogretmen.id },
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
    }),
    aktifDersiGetir(id, ogretmen.id),
  ]);

  if (!sinif) notFound();

  const kartSistemi = ogretmen.behaviorTemplate === "CARD";
  const ogrenciIdleri = sinif.students.map((o) => o.id);

  // Kart durumu yalnızca aktif derse aittir; ders değişince sıfırdan başlar.
  // Basit sistemde not elle girildiği için artı/eksi sayıları öne çıkar,
  // teneffüs cezası ise yalnızca kart sisteminde oluşur.
  const [kartlar, sayimlar, cezalar] = await Promise.all<
    [Promise<Map<string, KartDurumu>>, Promise<Map<string, Sayimlar>>, Promise<Map<string, CezaOzeti>>]
  >([
    kartSistemi && aktifDers
      ? dersKartDurumlari(aktifDers.id)
      : Promise.resolve(new Map()),
    kartSistemi ? Promise.resolve(new Map()) : ogrenciSayimlari(ogrenciIdleri),
    kartSistemi ? bekleyenCezalar(ogrenciIdleri) : Promise.resolve(new Map()),
  ]);

  return (
    <>
      <Link className="geri" href="/">
        ← Sınıflarım
      </Link>

      <section className="kart">
        <div className="ders-bilgi">
          {aktifDers ? (
            <span className="soluk">
              Aktif ders: {dersTarihiYazisi(aktifDers.tarih)} ({aktifDers.gunlukSira}. ders)
            </span>
          ) : (
            <span className="soluk">Aktif ders yok. Kayıt için ders başlatın.</span>
          )}
          <DersKontrolu sinifId={sinif.id} aktifDersId={aktifDers?.id ?? null} />
        </div>
        <Link className="baglanti" href={`/sinif/${sinif.id}/dersler`}>
          Ders geçmişi →
        </Link>
      </section>

      <main className="kart">
        <h1>{sinif.name}</h1>
        <p className="soluk">{sinif.students.length} öğrenci</p>

        {sinif.students.length === 0 ? (
          <p className="soluk">
            Bu sınıfta henüz öğrenci yok. Aşağıdaki formdan ekleyebilirsiniz.
          </p>
        ) : (
          <ul className="liste">
            {sinif.students.map((ogrenci) => {
              const sayim = sayimlar.get(ogrenci.id) ?? { arti: 0, eksi: 0 };
              return (
                <li key={ogrenci.id}>
                  <OgrenciSatiri
                    ogrenciId={ogrenci.id}
                    ad={`${ogrenci.firstName} ${ogrenci.lastName}`}
                    sinifId={sinif.id}
                    dersId={aktifDers?.id ?? null}
                    sablon={ogretmen.behaviorTemplate}
                    puan={ogrenci.performanceScore}
                    kart={kartlar.get(ogrenci.id)}
                    arti={sayim.arti}
                    eksi={sayim.eksi}
                    ceza={cezalar.get(ogrenci.id)}
                  />
                </li>
              );
            })}
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
