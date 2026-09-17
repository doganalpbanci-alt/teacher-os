import { getCurrentTeacher } from "@/lib/current-teacher";
import { UstMenu } from "@/components/UstMenu";
import { panelVerisi } from "@/lib/dashboard";
import {
  PanelBekleyen,
  PanelDikkat,
  PanelOzet,
  PanelSiniflar,
} from "@/components/Panel";

// Her istekte veritabanına gidilir; build sırasında önceden üretilmez.
export const dynamic = "force-dynamic";

// Genel bakış sayfası. Ana sayfa (sınıf listesi) bilerek yerinde bıraktı:
// derse girerken en hızlı ulaşılması gereken şey sınıf listesidir, panel
// değil. Panel "bugün neye bakmalıyım" sorusunun cevabıdır.
//
// Blok sırası yapılacak işten genel resme doğru gider: önce bekleyen işler,
// sonra dikkat gereken öğrenciler, sonra sınıflar, en sonda dönem özeti.

export default async function PanelSayfasi() {
  const ogretmen = await getCurrentTeacher();
  const veri = await panelVerisi(
    ogretmen.id,
    ogretmen.behaviorTemplate,
    ogretmen.gamificationEnabled,
  );

  return (
    <>
      <UstMenu aktif="panel" />

      <main className="kart">
        <div className="sayfa-basi">
          <h1>Panel</h1>
        </div>
        <p className="soluk panel-aciklama">
          Bütün sınıfların özeti. Sayılar aksi yazmadıkça son 30 güne aittir.
        </p>
      </main>

      <PanelBekleyen bekleyen={veri.bekleyen} />
      <PanelDikkat dikkat={veri.dikkat} />
      <PanelSiniflar siniflar={veri.siniflar} sablon={ogretmen.behaviorTemplate} />
      <PanelOzet ozet={veri.ozet} sablon={ogretmen.behaviorTemplate} />
    </>
  );
}
