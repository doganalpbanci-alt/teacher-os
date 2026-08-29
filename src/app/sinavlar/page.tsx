import Link from "next/link";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { ogretmenSinavlari, sinavTarihiYazisi, type SinavFiltresi } from "@/lib/exam";
import { UstMenu } from "@/components/UstMenu";

export const dynamic = "force-dynamic";

const FILTRELER: { deger: SinavFiltresi; yazi: string }[] = [
  { deger: "tumu", yazi: "Tümü" },
  { deger: "resmi", yazi: "Resmî" },
  { deger: "deneme", yazi: "Deneme" },
];

function filtreCoz(deger: string | undefined): SinavFiltresi {
  return deger === "resmi" || deger === "deneme" ? deger : "tumu";
}

export default async function SinavlarSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  const { filtre: ham } = await searchParams;
  const filtre = filtreCoz(ham);

  const ogretmen = await getCurrentTeacher();
  const sinavlar = await ogretmenSinavlari(ogretmen.id, filtre);

  return (
    <>
      <UstMenu aktif="sinavlar" />

      <main className="kart">
        <div className="sayfa-basi">
          <h1>Sınavlar</h1>
          <Link className="baglanti" href="/sinavlar/yeni">
            + Yeni sınav
          </Link>
        </div>

        <div className="filtre-satiri">
          {FILTRELER.map((secenek) => (
            <Link
              key={secenek.deger}
              className={`filtre${filtre === secenek.deger ? " secili" : ""}`}
              href={`/sinavlar?filtre=${secenek.deger}`}
              aria-current={filtre === secenek.deger ? "page" : undefined}
            >
              {secenek.yazi}
            </Link>
          ))}
        </div>

        {sinavlar.length === 0 ? (
          <p className="soluk">
            {filtre === "resmi"
              ? "Karneye giren sınav yok."
              : filtre === "deneme"
                ? "Deneme ya da tarama sınavı yok."
                : "Henüz sınav yok. Yukarıdaki bağlantıdan ilk sınavınızı oluşturun."}
          </p>
        ) : (
          <ul className="liste">
            {sinavlar.map((sinav) => (
              <li key={sinav.id}>
                <Link className="satir" href={`/sinavlar/${sinav.id}`}>
                  <span className="satir-ad">
                    {sinav.title}
                    <span className="soluk odev-tarih">
                      {sinavTarihiYazisi(sinav.examDate)}
                      {" · "}
                      {sinav.donem.etiket}
                      {" · "}
                      {sinav.sayimlar.toplam} öğrenci
                    </span>
                  </span>
                  <span className="satir-sag">
                    {sinav.scope === "OFFICIAL" && (
                      <span className="rozet rozet-resmi">Resmî</span>
                    )}
                    {/* Ortalama yüzde olarak: sınavlar farklı tam puanlarda,
                        ham puanlar birbiriyle kıyaslanamaz. */}
                    {sinav.sayimlar.ortalamaYuzde !== null && (
                      <span className="oran">Ort. %{sinav.sayimlar.ortalamaYuzde}</span>
                    )}
                    <span className="rozet">
                      {sinav.sayimlar.girilmis}/{sinav.sayimlar.toplam}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
