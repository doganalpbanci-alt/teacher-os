import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { odevDetayi, odevTarihiYazisi } from "@/lib/assignment";
import { TeslimDurumu } from "@/components/TeslimDurumu";
import { TopluIsaretle } from "@/components/TopluIsaretle";
import { OdevIslemleri } from "@/components/OdevIslemleri";

export const dynamic = "force-dynamic";

export default async function OdevDetaySayfasi({
  params,
}: {
  params: Promise<{ odevId: string }>;
}) {
  const { odevId } = await params;

  const ogretmen = await getCurrentTeacher();
  // Sahiplik odevDetayi icinde sorgunun parcasi; baskasinin odevi null doner
  // ve sayfa 404 verir.
  const detay = await odevDetayi(odevId, ogretmen.id);
  if (!detay) notFound();

  const { odev, gruplar } = detay;
  // Hicbir ogrenci isaretlenmemisse odev gercekten silinebilir; yanlislikla
  // acilan odev iz birakmadan kalkar. Karar sunucuda da tekrar kontrol edilir.
  const silinebilir = odev.sayimlar.pending === odev.sayimlar.toplam;

  return (
    <>
      <Link className="geri" href="/odevler">
        ← Ödevler
      </Link>

      <main className="kart">
        <div className="sayfa-basi">
          <h1>{odev.title}</h1>
          {odev.gecikti && <span className="rozet gecikti">Süresi geçti</span>}
        </div>

        <p className="soluk">
          {odev.startDate ? `${odevTarihiYazisi(odev.startDate)} → ` : ""}
          {odev.dueDate
            ? `son teslim ${odevTarihiYazisi(odev.dueDate)}`
            : "son teslim tarihi yok"}
          {!odev.isActive && " · arşivde"}
        </p>

        {odev.description && <p className="odev-icerik">{odev.description}</p>}

        <div className="olcum-satiri">
          <div className="olcum">
            <span className="olcum-deger">%{odev.sayimlar.oran}</span>
            <span className="olcum-etiket">tamamlanma</span>
          </div>
          <div className="olcum">
            <span className="olcum-deger">{odev.sayimlar.done}</span>
            <span className="olcum-etiket">yapıldı</span>
          </div>
          <div className="olcum">
            <span className="olcum-deger">{odev.sayimlar.late}</span>
            <span className="olcum-etiket">geç</span>
          </div>
          <div className="olcum">
            <span className="olcum-deger">{odev.sayimlar.missing}</span>
            <span className="olcum-etiket">eksik</span>
          </div>
          <div className="olcum">
            <span className="olcum-deger">{odev.sayimlar.pending}</span>
            <span className="olcum-etiket">bekliyor</span>
          </div>
        </div>

        <OdevIslemleri
          odevId={odev.id}
          arsivde={!odev.isActive}
          silinebilir={silinebilir}
        />
      </main>

      {/* Ödev birden fazla sınıfa verilmiş olabilir; her sınıf kendi başlığı
          altında kendi sayımı ve kendi toplu işaretlemesiyle durur. */}
      {gruplar.map((grup) => (
        <section className="kart" key={grup.sinifId ?? "sinifsiz"}>
          <div className="sayfa-basi">
            <h2>
              {grup.sinifId ? (
                <Link className="baglanti" href={`/sinif/${grup.sinifId}/odevler`}>
                  {grup.sinifAdi}
                </Link>
              ) : (
                grup.sinifAdi
              )}
            </h2>
            <span className="rozet">
              {grup.sayimlar.done + grup.sayimlar.late}/{grup.sayimlar.toplam} · %
              {grup.sayimlar.oran}
            </span>
          </div>

          <TopluIsaretle
            odevId={odev.id}
            sinifId={grup.sinifId}
            sinifAdi={grup.sinifAdi}
          />

          <ul className="liste">
            {grup.teslimler.map((teslim) => (
              <li key={teslim.submissionId}>
                <div
                  className={`satir${
                    teslim.status === "PENDING" && odev.gecikti ? " satir-gecikti" : ""
                  }`}
                >
                  <Link className="satir-ad" href={`/ogrenci/${teslim.ogrenciId}`}>
                    {teslim.ad}
                  </Link>
                  <TeslimDurumu
                    submissionId={teslim.submissionId}
                    odevId={odev.id}
                    durum={teslim.status}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
