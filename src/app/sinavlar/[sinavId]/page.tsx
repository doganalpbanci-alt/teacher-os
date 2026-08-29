import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { sinavDetayi, sinavTarihiYazisi } from "@/lib/exam";
import { NotHucresi } from "@/components/NotHucresi";
import { GirmediDugmesi } from "@/components/GirmediDugmesi";
import { SinavIslemleri } from "@/components/SinavIslemleri";

export const dynamic = "force-dynamic";

// Sınavın not tablosu. Sınav birden fazla şubeye verilmiş olabilir; her şube
// kendi başlığı altında kendi ortalamasıyla görünür, çünkü öğretmenin sorusu
// "9-A nasıl gitti" sorusudur, "hepsi birlikte nasıl gitti" değil.
//
// Ortalamalar yüzde olarak yazılır: sınavlar farklı tam puanlarda olabildiği
// için ham puanlar birbiriyle kıyaslanamaz.

export default async function SinavSayfasi({
  params,
}: {
  params: Promise<{ sinavId: string }>;
}) {
  const { sinavId } = await params;

  const ogretmen = await getCurrentTeacher();
  const detay = await sinavDetayi(sinavId, ogretmen.id);
  if (!detay) notFound();

  const { sinav, gruplar, bilesenOrtalamalari } = detay;
  const tekBilesen = sinav.bilesenler.length === 1;
  // Silme yalnızca hiç kayıt işlenmemişken; kural sunucuda, bu yalnızca
  // öğretmeni boşuna tıklatmamak için.
  const silinebilir = sinav.sayimlar.girilmis === 0 && sinav.sayimlar.girmeyen === 0;

  return (
    <>
      <Link className="geri" href="/sinavlar">
        ← Sınavlar
      </Link>

      <main className="kart">
        <div className="sayfa-basi">
          <h1>{sinav.title}</h1>
          {sinav.scope === "OFFICIAL" && <span className="rozet rozet-resmi">Resmî</span>}
        </div>

        <p className="soluk">
          {sinavTarihiYazisi(sinav.examDate)} · {sinav.donem.etiket} · tam puan{" "}
          {sinav.maxScore}
        </p>

        <div className="olcum-satiri">
          <div className="olcum">
            <span className="olcum-deger">{sinav.sayimlar.toplam}</span>
            <span className="olcum-etiket">öğrenci</span>
          </div>
          <div className="olcum">
            <span className="olcum-deger">{sinav.sayimlar.girilmis}</span>
            <span className="olcum-etiket">notu girildi</span>
          </div>
          <div className="olcum">
            <span className="olcum-deger">{sinav.sayimlar.bekleyen}</span>
            <span className="olcum-etiket">bekliyor</span>
          </div>
          {sinav.sayimlar.girmeyen > 0 && (
            <div className="olcum">
              <span className="olcum-deger">{sinav.sayimlar.girmeyen}</span>
              <span className="olcum-etiket">girmedi</span>
            </div>
          )}
          <div className="olcum">
            <span className="olcum-deger">
              {sinav.sayimlar.ortalama === null ? "—" : sinav.sayimlar.ortalama}
            </span>
            <span className="olcum-etiket">
              ortalama
              {sinav.sayimlar.ortalamaYuzde !== null &&
                ` (%${sinav.sayimlar.ortalamaYuzde})`}
            </span>
          </div>
        </div>

        {/* Bileşen ortalamaları tek bileşenli sınavda sınav ortalamasının
            tekrarı olur, o yüzden yalnızca çok bileşenlide gösterilir. */}
        {!tekBilesen && (
          <div className="bilesen-ortalamalar">
            <h2>Bileşen ortalamaları</h2>
            <ul className="liste">
              {bilesenOrtalamalari.map((b) => (
                <li key={b.bilesenId} className="satir satir-durgun">
                  <span className="satir-ad">{b.ad}</span>
                  <span className="satir-sag">
                    <span className="rozet">{b.girilmis} not</span>
                    <span className="oran">
                      {b.ortalamaYuzde === null ? "—" : `%${b.ortalamaYuzde}`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <SinavIslemleri sinavId={sinav.id} silinebilir={silinebilir} />
      </main>

      {gruplar.map((grup) => (
        <section className="kart" key={grup.sinifId ?? "sinifsiz"}>
          <div className="sayfa-basi">
            <h2>{grup.sinifAdi}</h2>
            <span className="rozet">
              {grup.sayimlar.ortalamaYuzde === null
                ? `${grup.sayimlar.girilmis}/${grup.sayimlar.toplam}`
                : `Ort. %${grup.sayimlar.ortalamaYuzde} · ${grup.sayimlar.girilmis}/${grup.sayimlar.toplam}`}
            </span>
          </div>

          <div className="not-tablo-kaydir">
            <table className="not-tablo">
              <thead>
                <tr>
                  <th scope="col">Öğrenci</th>
                  {sinav.bilesenler.map((b) => (
                    <th scope="col" key={b.id}>
                      {b.name}
                      {b.weight !== 100 && <span className="soluk"> %{b.weight}</span>}
                    </th>
                  ))}
                  <th scope="col">Sonuç</th>
                  <th scope="col">
                    <span className="gorunmez">Sınava girmedi</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {grup.satirlar.map((satir) => (
                  <tr key={satir.sonucId} className={satir.isAbsent ? "girmedi-satir" : ""}>
                    <th scope="row">
                      <Link className="baglanti" href={`/ogrenci/${satir.ogrenciId}`}>
                        {satir.ad}
                      </Link>
                    </th>

                    {sinav.bilesenler.map((bilesen) => {
                      const girdi = satir.girdiler[bilesen.id];
                      return (
                        <td key={bilesen.id}>
                          <NotHucresi
                            sonucId={satir.sonucId}
                            sinavId={sinav.id}
                            bilesen={bilesen}
                            devreDisi={satir.isAbsent}
                            baslangic={{
                              score: girdi?.score === null ? "" : String(girdi?.score ?? ""),
                              correct:
                                girdi?.correct === null ? "" : String(girdi?.correct ?? ""),
                              wrong: girdi?.wrong === null ? "" : String(girdi?.wrong ?? ""),
                              blank: girdi?.blank === null ? "" : String(girdi?.blank ?? ""),
                            }}
                          />
                        </td>
                      );
                    })}

                    <td className="sonuc-hucre">
                      {satir.isAbsent ? (
                        <span className="soluk">girmedi</span>
                      ) : satir.puan === null ? (
                        <span className="soluk">
                          {satir.eksikBilesen > 0
                            ? `${satir.eksikBilesen} bileşen eksik`
                            : "—"}
                        </span>
                      ) : (
                        <>
                          <strong>{satir.puan}</strong>
                          <span className="soluk"> %{satir.yuzde}</span>
                        </>
                      )}
                    </td>

                    <td>
                      <GirmediDugmesi
                        sonucId={satir.sonucId}
                        sinavId={sinav.id}
                        girmedi={satir.isAbsent}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
