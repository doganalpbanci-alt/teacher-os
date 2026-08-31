"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  tahtaKilidiniKaldir,
  tahtayiAc,
  tahtayiKilitle,
  tahtayiSimdiKilitle,
} from "@/app/kilit-actions";
import { BOS_FORM } from "@/lib/form-state";

// Ders ekranının üstündeki kilit şeridi ve PIN tuş takımı.
//
// Kilitliyken davranış düğmeleri görünür ama iş görmez; öğrenci basınca tuş
// takımı açılır. Düğmeler `disabled` DEĞİL, çünkü tarayıcı disabled düğmede
// tıklama olayı üretmez ve o zaman basış hiçbir şey yapmazdı. Bunun yerine
// `data-kilit-ac` taşırlar; buradaki tek dinleyici hepsini karşılar, bileşenler
// arasında prop taşımaya gerek kalmaz.

/** mm:ss */
function sureYazisi(saniye: number): string {
  const dakika = Math.floor(saniye / 60);
  const kalan = saniye % 60;
  return `${dakika}:${String(kalan).padStart(2, "0")}`;
}

/**
 * Rakamları karıştırır.
 *
 * Neden: büyük bir tahtada parmağın nereye gittiğini bütün sınıf görür. Sabit
 * düzende PIN birkaç derste öğrenilir. Yerler her açılışta değişince parmak
 * konumunu izlemek bilgi vermez.
 */
function karisikRakamlar(): string[] {
  const rakamlar = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  for (let i = rakamlar.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rakamlar[i], rakamlar[j]] = [rakamlar[j], rakamlar[i]];
  }
  return rakamlar;
}

export function TahtaKilidi({
  sinifId,
  pinVar,
  kilitli,
  kapali,
  kalanSaniye,
  bekleSaniye,
}: {
  sinifId: string;
  pinVar: boolean;
  kilitli: boolean;
  kapali: boolean;
  kalanSaniye: number;
  bekleSaniye: number;
}) {
  const router = useRouter();

  const [kilitleDurumu, kilitle, kilitleniyor] = useActionState(tahtayiKilitle, BOS_FORM);
  const [simdiDurumu, simdiKilitle] = useActionState(tahtayiSimdiKilitle, BOS_FORM);
  const [kaldirDurumu, kaldir] = useActionState(tahtaKilidiniKaldir, BOS_FORM);
  const [acDurumu, ac, aciliyor] = useActionState(tahtayiAc, BOS_FORM);

  const [padAcik, setPadAcik] = useState(false);
  const [rakamlar, setRakamlar] = useState<string[]>(karisikRakamlar);
  const [pin, setPin] = useState("");
  const [kalan, setKalan] = useState(kalanSaniye);
  const [bekle, setBekle] = useState(bekleSaniye);

  // Sunucu yeniden çizdiğinde sayaçlar oradan gelen değere döner.
  useEffect(() => setKalan(kalanSaniye), [kalanSaniye]);
  useEffect(() => setBekle(bekleSaniye), [bekleSaniye]);

  // Açılış süresi dolduğunda sayfa tazelenir: kilit sunucuda zaten kapanmış
  // olur, ekranın da onu göstermesi gerekir.
  useEffect(() => {
    if (kapali || kalan <= 0) return;
    const sayac = setInterval(() => {
      setKalan((onceki) => {
        if (onceki <= 1) {
          clearInterval(sayac);
          router.refresh();
          return 0;
        }
        return onceki - 1;
      });
    }, 1000);
    return () => clearInterval(sayac);
  }, [kapali, kalan, router]);

  useEffect(() => {
    if (bekle <= 0) return;
    const sayac = setInterval(() => setBekle((onceki) => Math.max(onceki - 1, 0)), 1000);
    return () => clearInterval(sayac);
  }, [bekle]);

  // Yanlış denemede sayfa tazelenmez; bekleme süresini action'ın döndürdüğü
  // değerden alırız.
  useEffect(() => {
    const gelen = acDurumu.degerler.bekleSaniye;
    if (gelen !== undefined) setBekle(Number(gelen));
  }, [acDurumu]);

  // Kilit açılınca sunucu sayfayı kilitsiz çizer; tuş takımı kapanır.
  useEffect(() => {
    if (!kapali) {
      setPadAcik(false);
      setPin("");
    }
  }, [kapali]);

  function padiAc() {
    setRakamlar(karisikRakamlar());
    setPin("");
    setPadAcik(true);
  }

  // Kilitli düğmelere basılınca tuş takımı açılır. Tek dinleyici; hangi
  // düğmeye basıldığı önemli değil, hepsi aynı kapıya çıkar.
  useEffect(() => {
    if (!kapali) return;
    function tiklama(olay: MouseEvent) {
      const hedef = olay.target;
      if (hedef instanceof Element && hedef.closest("[data-kilit-ac]")) padiAc();
    }
    document.addEventListener("click", tiklama);
    return () => document.removeEventListener("click", tiklama);
  }, [kapali]);

  if (!kilitli) {
    return (
      <form className="kilit-seridi" action={kilitle}>
        <input type="hidden" name="sinifId" value={sinifId} />
        <button className="kilit-dugme" type="submit" disabled={kilitleniyor || !pinVar}>
          {kilitleniyor ? "Kilitleniyor…" : "🔒 Bu cihazı kilitle"}
        </button>
        <span className="soluk kilit-not">
          {pinVar
            ? "Tahtada aç. Kilitli cihazda kart yalnızca PIN ile verilir; telefonun etkilenmez."
            : "Önce Ayarlar'dan bir tahta PIN'i belirleyin."}
        </span>
        {kilitleDurumu.hata && <span className="hata">{kilitleDurumu.hata}</span>}
      </form>
    );
  }

  if (!kapali) {
    return (
      <div className="kilit-seridi kilit-acik">
        <span className="kilit-rozet" role="status">
          Kilit açık · {sureYazisi(kalan)}
        </span>
        <form action={simdiKilitle}>
          <input type="hidden" name="sinifId" value={sinifId} />
          <button className="kilit-dugme" type="submit">
            Şimdi kilitle
          </button>
        </form>
        <form action={kaldir}>
          <input type="hidden" name="sinifId" value={sinifId} />
          <button className="kilit-dugme kilit-ikincil" type="submit">
            Kilidi kaldır
          </button>
        </form>
        {(simdiDurumu.hata || kaldirDurumu.hata) && (
          <span className="hata">{simdiDurumu.hata ?? kaldirDurumu.hata}</span>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="kilit-seridi kilit-kapali">
        <span className="kilit-rozet" role="status">
          🔒 Tahta kilitli
        </span>
        <button className="kilit-dugme" type="button" onClick={padiAc}>
          Kilidi aç
        </button>
      </div>

      {padAcik && (
        <div className="kilit-perde" role="dialog" aria-modal="true" aria-label="PIN girin">
          <form className="kilit-pad" action={ac}>
            <input type="hidden" name="pin" value={pin} />

            <p className="kilit-pad-baslik">Öğretmen PIN'i</p>
            <p className="kilit-pad-nokta" aria-label={`${pin.length} hane girildi`}>
              {pin.length > 0 ? "•".repeat(pin.length) : "—"}
            </p>

            <div className="kilit-tuslar">
              {rakamlar.map((rakam) => (
                <button
                  key={rakam}
                  type="button"
                  className="kilit-tus"
                  onClick={() => setPin((onceki) => onceki + rakam)}
                  disabled={bekle > 0}
                >
                  {rakam}
                </button>
              ))}
              <button
                type="button"
                className="kilit-tus kilit-tus-sil"
                onClick={() => setPin((onceki) => onceki.slice(0, -1))}
                aria-label="Son haneyi sil"
                disabled={bekle > 0}
              >
                ⌫
              </button>
              <button
                type="submit"
                className="kilit-tus kilit-tus-onay"
                disabled={aciliyor || pin.length === 0 || bekle > 0}
                aria-label="Kilidi aç"
              >
                {aciliyor ? "…" : "✓"}
              </button>
            </div>

            {bekle > 0 && (
              <p className="hata">Çok fazla yanlış deneme. {bekle} saniye bekleyin.</p>
            )}
            {bekle === 0 && acDurumu.hata && <p className="hata">{acDurumu.hata}</p>}

            <button
              type="button"
              className="kilit-dugme kilit-ikincil"
              onClick={() => setPadAcik(false)}
            >
              Vazgeç
            </button>
          </form>
        </div>
      )}
    </>
  );
}
