import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { aktifDersiGetir, dersTarihiYazisi } from "@/lib/current-lesson";
import { dersKartDurumlari, type KartDurumu } from "@/lib/behavior";
import { OgrenciFormu } from "@/components/OgrenciFormu";
import { DersBaslatFormu } from "@/components/DersBaslatFormu";
import { DavranisDugmeleri } from "@/components/DavranisDugmeleri";

export const dynamic = "force-dynamic";

const KART_YAZISI: Record<KartDurumu, { yazi: string; sinif: string }> = {
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

  const aktifDers = await aktifDersiGetir(sinif.id);
  // Kart durumu yalnızca aktif derse aittir; ders değişince sıfırdan başlar.
  const kartlar: Map<string, KartDurumu> = aktifDers
    ? await dersKartDurumlari(aktifDers.id)
    : new Map();

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
            <span className="soluk">Aktif ders yok. Puan vermek için ders başlatın.</span>
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
              return (
                <li key={ogrenci.id}>
                  <div className="satir">
                    <span className="satir-ad">
                      {ogrenci.firstName} {ogrenci.lastName}
                    </span>
                    <span className="satir-sag">
                      {kart && (
                        <span className={`kart-rozet ${KART_YAZISI[kart].sinif}`}>
                          {KART_YAZISI[kart].yazi}
                        </span>
                      )}
                      <span className="rozet">{ogrenci.performanceScore} puan</span>
                      <DavranisDugmeleri
                        ogrenciId={ogrenci.id}
                        sinifId={sinif.id}
                        dersId={aktifDers?.id ?? null}
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
