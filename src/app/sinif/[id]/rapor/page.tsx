import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { donemCozumle } from "@/lib/exam-rules";
import { sinifRaporu } from "@/lib/report";
import { RaporDonemSecici } from "@/components/RaporDonemSecici";
import { YazdirDugmesi } from "@/components/YazdirDugmesi";

export const dynamic = "force-dynamic";

// Sınıf raporu: tüm sınıfın tek sayfalık dökümü, öğrenci başına bir satır.
// Öğrenci raporuyla aynı altyapı (dönem seçici, yazdırma, @media print).
//
// Öğrenciler ALFABETİK sıralı, başarıya göre değil — gerekçesi `report.ts`te.
// "Dikkat gereken öğrenciler" listesi de bilerek yok: rapor bir döküm, bir
// değerlendirme değil.

function yuzde(deger: number | null): string {
  return deger === null ? "—" : `%${deger}`;
}

export default async function SinifRaporSayfasi({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ donem?: string }>;
}) {
  const { id } = await params;
  const { donem } = await searchParams;
  const ogretmen = await getCurrentTeacher();

  const rapor = await sinifRaporu(
    id,
    ogretmen.id,
    ogretmen.behaviorTemplate,
    donemCozumle(donem),
  );
  // Sınıf başkasınınsa ya da hiç kaydı yoksa rapor yok; ikisi de "bulunamadı".
  if (!rapor) notFound();

  const kart = rapor.kartSistemi;

  return (
    <>
      <div className="yazdirma-gizle rapor-araclar">
        <Link className="geri" href={`/sinif/${id}`}>
          ← {rapor.sinifAdi}
        </Link>
        <div className="rapor-araclar-sag">
          <RaporDonemSecici
            temelAdres={`/sinif/${id}/rapor`}
            donemler={rapor.donemler}
            secilen={rapor.secilenDonem}
          />
          <YazdirDugmesi />
        </div>
      </div>

      <main className="kart rapor">
        <header className="rapor-basi">
          <h1>{rapor.sinifAdi}</h1>
          <p className="soluk">{rapor.secilenDonem.etiket}</p>
        </header>

        <section className="rapor-bolum">
          <h2>Sınıf geneli</h2>
          <div className="olcum-satiri">
            <div className="olcum">
              <span className="olcum-deger">{rapor.ogrenciSayisi}</span>
              <span className="olcum-etiket">öğrenci</span>
            </div>
            <div className="olcum">
              <span className="olcum-deger">{rapor.dersSayisi}</span>
              <span className="olcum-etiket">ders</span>
            </div>
            <div className="olcum">
              <span className="olcum-deger">{rapor.toplam.arti}</span>
              <span className="olcum-etiket">{kart ? "yıldız" : "artı"}</span>
            </div>
            {kart ? (
              <>
                <div className="olcum">
                  <span className="olcum-deger">{rapor.toplam.sariKart}</span>
                  <span className="olcum-etiket">sarı kart</span>
                </div>
                <div className="olcum">
                  <span className="olcum-deger">{rapor.toplam.kirmiziKart}</span>
                  <span className="olcum-etiket">kırmızı kart</span>
                </div>
              </>
            ) : (
              <div className="olcum">
                <span className="olcum-deger">{rapor.toplam.eksi}</span>
                <span className="olcum-etiket">eksi</span>
              </div>
            )}
            <div className="olcum">
              <span className="olcum-deger">{yuzde(rapor.karneOrtalamasi)}</span>
              <span className="olcum-etiket">karne ortalaması</span>
            </div>
            <div className="olcum">
              <span className="olcum-deger">{yuzde(rapor.odevOrani)}</span>
              <span className="olcum-etiket">ödev tamamlama</span>
            </div>
          </div>
        </section>

        <section className="rapor-bolum">
          <h2>Öğrenciler</h2>
          {rapor.satirlar.length === 0 ? (
            <p className="soluk">Bu sınıfta aktif öğrenci yok.</p>
          ) : (
            <div className="panel-tablo-sarmal">
              <table className="rapor-tablo">
                <thead>
                  <tr>
                    <th scope="col">Öğrenci</th>
                    <th scope="col">{kart ? "Yıldız" : "Artı"}</th>
                    {kart ? (
                      <>
                        <th scope="col">Sarı</th>
                        <th scope="col">Kırmızı</th>
                      </>
                    ) : (
                      <th scope="col">Eksi</th>
                    )}
                    <th scope="col">Not</th>
                    <th scope="col">Karne</th>
                    <th scope="col">Ödev</th>
                  </tr>
                </thead>
                <tbody>
                  {rapor.satirlar.map((satir) => (
                    <tr key={satir.ogrenciId}>
                      <th scope="row">{satir.ad}</th>
                      <td>{satir.arti}</td>
                      {kart ? (
                        <>
                          <td>{satir.sariKart}</td>
                          <td>{satir.kirmiziKart}</td>
                        </>
                      ) : (
                        <td>{satir.eksi}</td>
                      )}
                      <td>{satir.performansNotu}</td>
                      <td>{yuzde(satir.karneOrtalamasi)}</td>
                      <td>{yuzde(satir.odevOrani)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="soluk rapor-not">
            Öğrenciler alfabetik sıralıdır. Performans notu güncel değerdir;
            diğer sayılar seçilen döneme aittir. Verisi olmayan ölçüler “—”
            görünür.
          </p>
        </section>

        <footer className="rapor-alti soluk">
          {rapor.ogretmenAdi} ·{" "}
          {rapor.uretimTarihi.toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </footer>
      </main>
    </>
  );
}
