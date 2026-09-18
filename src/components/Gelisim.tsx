import type { BehaviorTemplate } from "@prisma/client";
import type { GelisimOlcusu, GelisimSonucu } from "@/lib/progress";
import {
  OLCU_ADET_KELIMESI,
  OLCU_ETIKETLERI,
  YUZDE_ESIGI,
} from "@/lib/progress-rules";

// Öğrenci sayfasındaki "Gelişim" bloğu: son iki dönem yan yana, her ölçü için
// sayı ve yön oku.
//
// Grafik yok. İki nokta arasına çizilen bir çizgi zaten grafik değildir;
// v0.4'te grafiklerin ertelenme gerekçesi (neyin izleneceği belli olmadan
// çizmemek) burada da geçerli.

function deger(olcu: GelisimOlcusu, hangi: "onceki" | "simdi"): string {
  const sayi = olcu.degisim[hangi];
  if (sayi === null) return "—";
  return olcu.birim === "YUZDE" ? `%${sayi}` : String(sayi);
}

/** Okun kendisi. Yön sayının yönüdür; RENK iyileşme olup olmadığını söyler. */
function Ok({ olcu }: { olcu: GelisimOlcusu }) {
  const { yon, iyilesme, fark } = olcu.degisim;

  if (yon === "YETERSIZ") {
    return <span className="gelisim-ok gelisim-yetersiz">karşılaştırılamaz</span>;
  }
  if (yon === "AYNI") {
    return <span className="gelisim-ok gelisim-ayni">≈ aynı</span>;
  }

  // Eksi/kart azalınca ok AŞAĞI bakar ama renk YEŞİLdir: yön sayının yönü,
  // renk öğrencinin lehine olup olmadığı. İkisini aynı şeye bağlamak
  // "eksi azaldı"yı kırmızı gösterirdi.
  const simge = yon === "YUKSELDI" ? "▲" : "▼";
  const sinif = iyilesme ? "gelisim-iyi" : "gelisim-kotu";
  const isaret = (fark ?? 0) > 0 ? "+" : "";
  const miktar =
    olcu.birim === "YUZDE"
      ? `${isaret}${Math.round(fark ?? 0)} puan`
      : `${isaret}${Math.round((fark ?? 0) * 100) / 100}`;

  return (
    <span className={`gelisim-ok ${sinif}`}>
      {simge} {miktar}
    </span>
  );
}

function Satir({
  olcu,
  sablon,
  oncekiDers,
  simdiDers,
}: {
  olcu: GelisimOlcusu;
  sablon: BehaviorTemplate;
  oncekiDers: number;
  simdiDers: number;
}) {
  const kelime = OLCU_ADET_KELIMESI[sablon][olcu.anahtar];
  // Ham sayı okun nereden geldiğini gösterir: "1.2/ders" tek başına, 22
  // yıldızın mı 3 yıldızın mı sonucu olduğunu söylemez.
  const ayrinti =
    olcu.birim === "DERS_BASI"
      ? `${olcu.oncekiAdet} → ${olcu.simdiAdet} ${kelime} · ${oncekiDers} → ${simdiDers} ders`
      : `${olcu.oncekiAdet} → ${olcu.simdiAdet} ${kelime}`;

  return (
    <li className="satir satir-durgun gelisim-satir">
      <span className="satir-ad">
        {OLCU_ETIKETLERI[sablon][olcu.anahtar]}
        <span className="soluk odev-tarih">{ayrinti}</span>
      </span>
      <span className="satir-sag">
        <span className="gelisim-degerler">
          {deger(olcu, "onceki")} <span className="soluk">→</span> {deger(olcu, "simdi")}
        </span>
        <Ok olcu={olcu} />
      </span>
    </li>
  );
}

export function Gelisim({
  sonuc,
  sablon,
}: {
  sonuc: GelisimSonucu;
  sablon: BehaviorTemplate;
}) {
  // Hiç kayıt yoksa blok çıkmaz: boş kutu her sayfada yer kaplar ve bir süre
  // sonra okunmaz olur (gündem panelindeki aynı kural).
  if (sonuc.durum === "VERI_YOK") return null;

  if (sonuc.durum === "TEK_DONEM") {
    return (
      <section className="kart">
        <h2>Gelişim</h2>
        <p className="soluk">
          Karşılaştırma için en az iki dönem gerekir. Şu an yalnızca{" "}
          {sonuc.donem.etiket} verisi var.
        </p>
      </section>
    );
  }

  return (
    <section className="kart">
      <h2>Gelişim</h2>
      <p className="soluk gelisim-basi">
        {sonuc.onceki.etiket} → {sonuc.simdi.etiket}
      </p>

      <ul className="liste">
        {sonuc.olculer.map((olcu) => (
          <Satir
            key={olcu.anahtar}
            olcu={olcu}
            sablon={sablon}
            oncekiDers={sonuc.oncekiDers}
            simdiDers={sonuc.simdiDers}
          />
        ))}
      </ul>

      <p className="soluk panel-aciklama">
        Davranış sayıları ders başına hesaplanır; ders sayısı dönemden döneme
        değiştiği için ham sayı tek başına karşılaştırılamaz. Yüzdelerde{" "}
        {YUZDE_ESIGI} puandan küçük fark “aynı” sayılır.
      </p>
    </section>
  );
}
