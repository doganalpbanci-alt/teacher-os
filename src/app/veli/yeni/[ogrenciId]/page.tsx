import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UstMenu } from "@/components/UstMenu";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { ogrenciOzeti } from "@/lib/student-history";
import { ogrenciOdevIstatistigi } from "@/lib/assignment";
import { ogrenciSinavlari } from "@/lib/exam";
import { mesajSablonlari } from "@/lib/parent-message-rules";
import { VeliMesajFormu } from "@/components/VeliMesajFormu";

export const dynamic = "force-dynamic";

export default async function VeliYeniMesajSayfasi({
  params,
}: {
  params: Promise<{ ogrenciId: string }>;
}) {
  const { ogrenciId } = await params;
  const ogretmen = await getCurrentTeacher();

  // Sahiplik sorgunun parçası: başka öğretmenin öğrencisi 404 döner.
  const ogrenci = await prisma.student.findFirst({
    where: { id: ogrenciId, classroom: { teacherId: ogretmen.id } },
    select: { id: true, firstName: true, lastName: true, parentName: true, parentPhone: true },
  });
  if (!ogrenci) notFound();

  const kartSistemi = ogretmen.behaviorTemplate === "CARD";
  const [ozet, odevOzeti, sinavlar] = await Promise.all([
    ogrenciOzeti(ogrenci.id),
    ogrenciOdevIstatistigi(ogrenci.id, ogretmen.id),
    ogrenciSinavlari(ogrenci.id, ogretmen.id),
  ]);

  const sonSinav = sinavlar.find((s) => !s.isAbsent && s.puan !== null && s.yuzde !== null);
  const ad = `${ogrenci.firstName} ${ogrenci.lastName}`;

  const sablonlar = mesajSablonlari({
    ogrenciAdi: ad,
    veliAdi: ogrenci.parentName,
    kartSistemi,
    ozet,
    odevOzeti,
    sonSinav: sonSinav
      ? {
          baslik: sonSinav.baslik,
          puan: sonSinav.puan as number,
          maxScore: sonSinav.maxScore,
          yuzde: sonSinav.yuzde as number,
        }
      : null,
  });

  return (
    <>
      <UstMenu aktif="veli" />

      <main className="kart">
        <Link className="geri" href="/veli/yeni">
          ← Öğrenci seç
        </Link>

        <h1>{ad}</h1>
        <p className="soluk">
          {ogrenci.parentName ? `Veli: ${ogrenci.parentName}` : "Veli adı girilmemiş"}
          {ogrenci.parentPhone ? ` · ${ogrenci.parentPhone}` : " · telefon girilmemiş"}
        </p>

        <VeliMesajFormu
          ogrenciId={ogrenci.id}
          parentPhone={ogrenci.parentPhone}
          sablonlar={sablonlar}
        />
      </main>
    </>
  );
}
