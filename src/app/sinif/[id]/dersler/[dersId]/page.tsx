import Link from "next/link";
import { notFound } from "next/navigation";
import type { BehaviorType } from "@prisma/client";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { dersDetayi, dersTarihiYazisi, saatYazisi } from "@/lib/lesson";

export const dynamic = "force-dynamic";

// Öğrenci geçmişindekiyle aynı gösterim; kayıt türleri iki ekranda da
// aynı okunur.
const TUR_YAZISI: Record<BehaviorType, { yazi: string; sinif: string }> = {
  PLUS: { yazi: "Artı", sinif: "g-arti" },
  MINUS: { yazi: "Eksi", sinif: "g-eksi" },
  YELLOW_CARD: { yazi: "Sarı kart", sinif: "g-sari" },
  RED_CARD: { yazi: "Kırmızı kart", sinif: "g-kirmizi" },
};

export default async function DersDetaySayfasi({
  params,
}: {
  params: Promise<{ id: string; dersId: string }>;
}) {
  const { id, dersId } = await params;

  const ogretmen = await getCurrentTeacher();
  // Sahiplik dersDetayi icinde sorgunun parcasi: baskasinin dersi null doner.
  const detay = await dersDetayi(dersId, id, ogretmen.id);
  if (!detay) notFound();

  const { ders, ogrenciler } = detay;

  return (
    <>
      <Link className="geri" href={`/sinif/${id}/dersler`}>
        ← Ders geçmişi
      </Link>

      <main className="kart">
        <h1>
          {dersTarihiYazisi(ders.tarih)} ({ders.gunlukSira}. ders)
        </h1>
        <p className="soluk">
          {ders.suruyor
            ? "Ders sürüyor."
            : `Bitiş ${ders.bitis ? saatYazisi(ders.bitis) : "—"}`}
        </p>

        {ogrenciler.length === 0 ? (
          <p className="soluk">Bu derste kayıt yok.</p>
        ) : (
          <div className="gecmis">
            {ogrenciler.map((ogrenci) => (
              <section key={ogrenci.ogrenciId}>
                <h3 className="gecmis-baslik">
                  <Link className="baglanti" href={`/ogrenci/${ogrenci.ogrenciId}`}>
                    {ogrenci.ad}
                  </Link>
                </h3>
                <ul className="liste">
                  {ogrenci.kayitlar.map((kayit) => (
                    <li key={kayit.id}>
                      <div className="satir">
                        <span className={`gecmis-tur ${TUR_YAZISI[kayit.tur].sinif}`}>
                          {TUR_YAZISI[kayit.tur].yazi}
                        </span>
                        <span className="satir-sag">
                          {kayit.puan !== 0 && (
                            <span className="gecmis-puan">
                              {kayit.puan > 0 ? `+${kayit.puan}` : kayit.puan}
                            </span>
                          )}
                          <span className="rozet">{saatYazisi(kayit.zaman)}</span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
