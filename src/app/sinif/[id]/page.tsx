import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { aktifDersiGetir, dersTarihiYazisi } from "@/lib/current-lesson";
import { dersKartDurumlari, ogrenciSayimlari, type KartDurumu } from "@/lib/behavior";
import { OgrenciFormu } from "@/components/OgrenciFormu";
import { DersBaslatFormu } from "@/components/DersBaslatFormu";
import { DavranisDugmeleri } from "@/components/DavranisDugmeleri";

export const dynamic = "force-dynamic";

const KART_ETIKETI: Record<KartDurumu, { yazi: string; sinif: string }> = {
  SARI: { yazi: "Sarı kart", sinif: "kart-sari" },
  KIRMIZI: { yazi: "Kırmızı kart", sinif: "kart-kirmizi" },
};

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

  const ogretmen = await getCurrentTeacher();
  const kartSistemi = ogretmen.behaviorTemplate === "CARD";
  const aktifDers = await aktifDersiGetir(sinif.id);

  // Kart durumu yalnızca aktif derse aittir; ders değişince sıfırdan başlar.
  const kartlar: Map<string, KartDurumu> =
    kartSistemi && aktifDers ? await dersKartDurumlari(aktifDers.id) : new Map();
  // Basit sistemde not elle girildiği için artı/eksi sayıları öne çıkar.
  const sayimlar = kartSistemi
    ? new Map()
    : await ogrenciSayimlari(sinif.students.map((o) => o.id));

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
          <DersBaslatFormu sinifId={sinif.id} />
        </div>
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
              const kart = kartlar.get(ogrenci.id);
              const sayim = sayimlar.get(ogrenci.id) ?? { arti: 0, eksi: 0 };
              return (
                <li key={ogrenci.id}>
                  <div className="satir">
                    <Link className="satir-ad baglanti" href={`/ogrenci/${ogrenci.id}`}>
                      {ogrenci.firstName} {ogrenci.lastName}
                    </Link>
                    <span className="satir-sag">
                      {kart && (
                        <span className={`kart-rozet ${KART_ETIKETI[kart].sinif}`}>
                          {KART_ETIKETI[kart].yazi}
                        </span>
                      )}
                      {!kartSistemi && (
                        <span className="rozet">
                          {sayim.arti} artı · {sayim.eksi} eksi
                        </span>
                      )}
                      <span className="rozet">{ogrenci.performanceScore} puan</span>
                      <DavranisDugmeleri
                        ogrenciId={ogrenci.id}
                        sinifId={sinif.id}
                        dersId={aktifDers?.id ?? null}
                        sablon={ogretmen.behaviorTemplate}
                      />
                    </span>
                  </div>
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
