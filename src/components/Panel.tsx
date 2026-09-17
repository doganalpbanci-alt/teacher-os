import Link from "next/link";
import type { BehaviorTemplate } from "@prisma/client";
import type {
  BekleyenIsler,
  DikkatSatiri,
  PencereOzeti,
  SinifSatiri,
} from "@/lib/dashboard";
import { PENCERE_GUN } from "@/lib/dashboard-rules";

// Panelin dört bloğu. Hepsi sunucu bileşeni: sayılar sayfada hesaplanmış
// olarak gelir, tarayıcıda iş yapılmaz.
//
// Gündem panelindeki kural burada da geçerli: yapacak iş yoksa satır HİÇ
// çıkmaz. Her gün duran boş bir kutu bir süre sonra okunmaz olur, o zaman
// gerçekten iş olduğunda da fark edilmez.

function yuzdeYazisi(deger: number | null): string {
  return deger === null ? "—" : `%${deger}`;
}

/**
 * Rozetin üstündeki yazı yalnızca sebebi değil, sayısını da söyler: öğretmen
 * listeye bakarken kimin kaç ödevi eksik olduğunu görmek için öğrenci
 * sayfasına girmek zorunda kalmasın.
 */
function sebepYazisi(satir: DikkatSatiri, sebep: DikkatSatiri["sebepler"][number]): string {
  if (sebep === "ODEV") return `${satir.gecikmisOdev} ödev`;
  if (sebep === "SINAV") return `%${satir.resmiOrtalama}`;
  return satir.kirmiziKart > 0 ? `${satir.kirmiziKart} kırmızı` : "davranış";
}

// ---------- 1. Bekleyen işler ----------

function BekleyenSatiri({
  yazi,
  sayi,
  href,
}: {
  yazi: string;
  sayi: number;
  href: string;
}) {
  if (sayi === 0) return null;
  return (
    <li>
      <Link className="satir" href={href}>
        <span className="satir-ad">{yazi}</span>
        <span className="satir-sag">
          <span className="rozet">{sayi}</span>
        </span>
      </Link>
    </li>
  );
}

export function PanelBekleyen({ bekleyen }: { bekleyen: BekleyenIsler }) {
  const toplam =
    bekleyen.gecikmisOdev + bekleyen.acikCeza + bekleyen.veliTaslagi + bekleyen.acikHedef;
  if (toplam === 0) return null;

  return (
    <section className="kart gundem">
      <h2>Bekleyen işler</h2>
      <ul className="liste">
        <BekleyenSatiri
          yazi="Kontrol bekleyen ödev"
          sayi={bekleyen.gecikmisOdev}
          href="/odevler?filtre=gecikmis"
        />
        <BekleyenSatiri
          yazi="Gönderilmemiş veli mesajı"
          sayi={bekleyen.veliTaslagi}
          href="/veli"
        />
        {/* Ceza ve hedefin tek bir listesi yok; ikisi de sınıf sayfasında
            görülür, bağlantı oraya gider. */}
        <BekleyenSatiri
          yazi="Bitmemiş teneffüs cezası"
          sayi={bekleyen.acikCeza}
          href="/"
        />
        <BekleyenSatiri yazi="Açık sınıf hedefi" sayi={bekleyen.acikHedef} href="/" />
      </ul>
    </section>
  );
}

// ---------- 2. Dikkat gereken öğrenciler ----------

export function PanelDikkat({ dikkat }: { dikkat: DikkatSatiri[] }) {
  return (
    <section className="kart">
      <h2>Dikkat gereken öğrenciler</h2>
      {dikkat.length === 0 ? (
        <p className="soluk">
          Son {PENCERE_GUN} günde dikkat isteyen öğrenci yok.
        </p>
      ) : (
        <ul className="liste">
          {dikkat.map((satir) => (
            <li key={satir.ogrenciId}>
              <Link className="satir" href={`/ogrenci/${satir.ogrenciId}`}>
                <span className="satir-ad">
                  {satir.ad}
                  <span className="soluk odev-tarih">{satir.sinifAdi}</span>
                </span>
                <span className="satir-sag">
                  {satir.sebepler.map((sebep) => (
                    <span key={sebep} className={`sebep-rozet sebep-${sebep}`}>
                      {sebepYazisi(satir, sebep)}
                    </span>
                  ))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------- 3. Sınıf karşılaştırması ----------

export function PanelSiniflar({
  siniflar,
  sablon,
}: {
  siniflar: SinifSatiri[];
  sablon: BehaviorTemplate;
}) {
  if (siniflar.length === 0) return null;

  // Şablon yalnızca kayıtların nasıl yorumlandığını değiştirir, kayıt aynıdır:
  // Basit şablonda kart yoktur, o yüzden kart sütunu da yoktur — her satırda
  // "0/0" gösteren bir sütun tabloyu boşuna genişletir. Performans notu da
  // Basit şablonda elle girilir, sınıf ortalaması olarak anlam taşımaz.
  const kart = sablon === "CARD";

  return (
    <section className="kart">
      <h2>Sınıf karşılaştırması</h2>
      <div className="panel-tablo-sarmal">
        <table className="panel-tablo">
          <thead>
            <tr>
              <th scope="col">Sınıf</th>
              <th scope="col">Öğrenci</th>
              <th scope="col">Ders</th>
              <th scope="col">{kart ? "Yıldız" : "Artı"}</th>
              <th scope="col">{kart ? "Kart" : "Eksi"}</th>
              <th scope="col">Ödev</th>
              <th scope="col">Sınav</th>
              {kart && <th scope="col">Not</th>}
            </tr>
          </thead>
          <tbody>
            {siniflar.map((sinif) => (
              <tr key={sinif.id}>
                <th scope="row">
                  <Link className="baglanti" href={`/sinif/${sinif.id}`}>
                    {sinif.ad}
                  </Link>
                </th>
                <td>{sinif.ogrenciSayisi}</td>
                <td>{sinif.dersSayisi}</td>
                <td>{sinif.arti}</td>
                <td>
                  {/* Sarı ve kırmızı tek hücrede: ayrı sütun tabloyu
                      telefonda gereksiz genişletiyor. */}
                  {kart ? `${sinif.sariKart}/${sinif.kirmiziKart}` : sinif.eksi}
                </td>
                <td>{yuzdeYazisi(sinif.odevOrani)}</td>
                <td>{yuzdeYazisi(sinif.resmiOrtalama)}</td>
                {kart && <td>{sinif.ortalamaPuan ?? "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="soluk panel-aciklama">
        {kart && "Kart sütunu sarı/kırmızı. "}
        Ödev ve sınav yüzdeleri son {PENCERE_GUN} güne aittir; veri yoksa “—”
        görünür.
      </p>
    </section>
  );
}

// ---------- 4. Pencere özeti ----------

export function PanelOzet({
  ozet,
  sablon,
}: {
  ozet: PencereOzeti;
  sablon: BehaviorTemplate;
}) {
  const kart = sablon === "CARD";

  return (
    <section className="kart">
      <h2>Son {PENCERE_GUN} gün</h2>
      <div className="olcum-satiri">
        <div className="olcum">
          <span className="olcum-deger">{ozet.ders}</span>
          <span className="olcum-etiket">ders</span>
        </div>
        <div className="olcum">
          <span className="olcum-deger">{ozet.arti}</span>
          <span className="olcum-etiket">{kart ? "yıldız" : "artı"}</span>
        </div>
        {kart ? (
          <>
            <div className="olcum">
              <span className="olcum-deger">{ozet.sariKart}</span>
              <span className="olcum-etiket">sarı kart</span>
            </div>
            <div className="olcum">
              <span className="olcum-deger">{ozet.kirmiziKart}</span>
              <span className="olcum-etiket">kırmızı kart</span>
            </div>
          </>
        ) : (
          <div className="olcum">
            <span className="olcum-deger">{ozet.eksi}</span>
            <span className="olcum-etiket">eksi</span>
          </div>
        )}
        <div className="olcum">
          <span className="olcum-deger">{ozet.tamamlananTeslim}</span>
          <span className="olcum-etiket">ödev tamamlandı</span>
        </div>
        <div className="olcum">
          <span className="olcum-deger">{ozet.gonderilenMesaj}</span>
          <span className="olcum-etiket">veli mesajı</span>
        </div>
      </div>
    </section>
  );
}
