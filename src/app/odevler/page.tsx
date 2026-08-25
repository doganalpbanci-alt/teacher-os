import Link from "next/link";
import { getCurrentTeacher } from "@/lib/current-teacher";
import {
  ogretmenOdevleri,
  odevTarihiYazisi,
  type OdevFiltresi,
} from "@/lib/assignment";
import { UstMenu } from "@/components/UstMenu";

export const dynamic = "force-dynamic";

const FILTRELER: { deger: OdevFiltresi; yazi: string }[] = [
  { deger: "aktif", yazi: "Aktif" },
  { deger: "gecikmis", yazi: "Gecikmiş" },
  { deger: "arsiv", yazi: "Arşiv" },
];

function filtreCoz(deger: string | undefined): OdevFiltresi {
  return deger === "gecikmis" || deger === "arsiv" ? deger : "aktif";
}

export default async function OdevlerSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  const { filtre: ham } = await searchParams;
  const filtre = filtreCoz(ham);

  const ogretmen = await getCurrentTeacher();
  const odevler = await ogretmenOdevleri(ogretmen.id, filtre);

  return (
    <>
      <UstMenu aktif="odevler" />

      <main className="kart">
        <div className="sayfa-basi">
          <h1>Ödevler</h1>
          <Link className="baglanti" href="/odevler/yeni">
            + Yeni ödev
          </Link>
        </div>

        <div className="filtre-satiri">
          {FILTRELER.map((secenek) => (
            <Link
              key={secenek.deger}
              className={`filtre${filtre === secenek.deger ? " secili" : ""}`}
              href={`/odevler?filtre=${secenek.deger}`}
              aria-current={filtre === secenek.deger ? "page" : undefined}
            >
              {secenek.yazi}
            </Link>
          ))}
        </div>

        {odevler.length === 0 ? (
          <p className="soluk">
            {filtre === "gecikmis"
              ? "Süresi geçmiş ve bekleyen ödev yok."
              : filtre === "arsiv"
                ? "Arşivlenmiş ödev yok."
                : "Henüz ödev yok. Yukarıdaki bağlantıdan ilk ödevinizi verin."}
          </p>
        ) : (
          <ul className="liste">
            {odevler.map((odev) => (
              <li key={odev.id}>
                <Link className="satir" href={`/odevler/${odev.id}`}>
                  <span className="satir-ad">
                    {odev.title}
                    <span className="soluk odev-tarih">
                      {odev.dueDate
                        ? `son teslim ${odevTarihiYazisi(odev.dueDate)}`
                        : "tarihsiz"}
                      {" · "}
                      {odev.sayimlar.toplam} öğrenci
                    </span>
                  </span>
                  <span className="satir-sag">
                    {odev.gecikti && <span className="rozet gecikti">Süresi geçti</span>}
                    <span className="oran">%{odev.sayimlar.oran}</span>
                    <span className="rozet">
                      {odev.sayimlar.done + odev.sayimlar.late}/{odev.sayimlar.toplam}
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
