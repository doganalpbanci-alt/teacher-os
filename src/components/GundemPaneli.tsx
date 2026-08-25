import Link from "next/link";
import type { Gundem } from "@/lib/assignment";
import { odevTarihiYazisi } from "@/lib/assignment";

// Ana sayfadaki günlük gündem: öğretmen derse girmeden önce hangi ödevleri
// kontrol etmesi gerektiğini tek bakışta görsün.
//
// Yapacak iş yoksa panel HİÇ çıkmaz. Boş bir "bugün bir şey yok" kutusu her
// gün yer kaplar ve bir süre sonra okunmaz olur; o zaman gerçekten iş
// olduğunda da fark edilmez.

function Satir({
  odevId,
  baslik,
  durum,
  bekleyen,
  gecikmis,
}: {
  odevId: string;
  baslik: string;
  durum: string;
  bekleyen: number;
  gecikmis: boolean;
}) {
  return (
    <li>
      <Link className="satir" href={`/odevler/${odevId}`}>
        <span className="satir-ad">
          {baslik}
          <span className="soluk odev-tarih">{durum}</span>
        </span>
        <span className="satir-sag">
          <span className={`teslim-rozet ${gecikmis ? "t-missing" : "t-pending"}`}>
            {bekleyen} bekliyor
          </span>
        </span>
      </Link>
    </li>
  );
}

export function GundemPaneli({ gundem }: { gundem: Gundem }) {
  const toplam = gundem.gecikmis.length + gundem.bugun.length;
  if (toplam === 0) return null;

  return (
    <section className="kart gundem">
      <div className="sayfa-basi">
        <h2>Bugün kontrol edilecek</h2>
        <Link className="baglanti" href="/odevler?filtre=gecikmis">
          Tümü →
        </Link>
      </div>

      <ul className="liste">
        {/* Süresi geçmişler önce: en uzun bekleyen iş en üstte durur. */}
        {gundem.gecikmis.map((odev) => (
          <Satir
            key={odev.id}
            odevId={odev.id}
            baslik={odev.title}
            durum={`süresi geçti · ${odev.dueDate ? odevTarihiYazisi(odev.dueDate) : ""}`}
            bekleyen={odev.sayimlar.pending}
            gecikmis
          />
        ))}
        {gundem.bugun.map((odev) => (
          <Satir
            key={odev.id}
            odevId={odev.id}
            baslik={odev.title}
            durum="bugün son teslim"
            bekleyen={odev.sayimlar.pending}
            gecikmis={false}
          />
        ))}
      </ul>
    </section>
  );
}
