import Link from "next/link";
import { UstMenu } from "@/components/UstMenu";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { hedefSecenekleri } from "@/lib/assignment";

export const dynamic = "force-dynamic";

// Ödev/sınavdaki "kime verilecek" seçimi çoklu; burada tek öğrenci seçilir,
// bu yüzden HedefSecici'nin kendisi değil yalnızca veri kaynağı (aynı
// sınıf+öğrenci listesi) yeniden kullanılır.
export default async function VeliYeniSayfasi() {
  const ogretmen = await getCurrentTeacher();
  const siniflar = await hedefSecenekleri(ogretmen.id);
  const ogrenciSayisi = siniflar.reduce((t, s) => t + s.ogrenciler.length, 0);

  return (
    <>
      <UstMenu aktif="veli" />

      <main className="kart">
        <h1>Mesaj kime gidecek?</h1>

        {ogrenciSayisi === 0 ? (
          <p className="soluk">
            Mesaj gönderilebilecek öğrenci yok. Önce bir sınıf ve öğrenci ekleyin.
          </p>
        ) : (
          siniflar.map(
            (sinif) =>
              sinif.ogrenciler.length > 0 && (
                <div key={sinif.id} className="veli-secim-sinifi">
                  <h2>{sinif.ad}</h2>
                  <ul className="liste">
                    {sinif.ogrenciler.map((ogrenci) => (
                      <li key={ogrenci.id}>
                        <Link className="satir" href={`/veli/yeni/${ogrenci.id}`}>
                          <span className="satir-ad">{ogrenci.ad}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
          )
        )}
      </main>
    </>
  );
}
