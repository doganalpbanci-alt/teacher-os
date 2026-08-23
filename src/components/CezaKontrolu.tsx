"use client";

import { useActionState, useEffect, useState } from "react";
import { cezaGuncelle } from "@/app/actions";
import { BOS_FORM } from "@/lib/form-state";

function sureYazisi(saniye: number): string {
  const dakika = Math.floor(saniye / 60);
  const kalan = saniye % 60;
  return `${dakika}:${String(kalan).padStart(2, "0")}`;
}

export function CezaKontrolu({
  cezaId,
  sinifId,
  kalanSaniye,
  calisiyor,
}: {
  cezaId: string;
  sinifId: string;
  // Sunucuda hesaplanmış kalan süre. Tarayıcı saati sunucudan sapabileceği
  // için geri sayım bu değerden başlatılır.
  kalanSaniye: number;
  calisiyor: boolean;
}) {
  const [durum, gonder, bekliyor] = useActionState(cezaGuncelle, BOS_FORM);
  const [acik, setAcik] = useState(false);
  const [kalan, setKalan] = useState(kalanSaniye);
  const [koşuyor, setKosuyor] = useState(calisiyor);

  // Süre işlemleri sayfayı tazelemediği için güncel değer action'ın
  // sonucundan gelir; panel açık kalır.
  useEffect(() => {
    if (durum.degerler.kalanSaniye === undefined) return;
    setKalan(Number(durum.degerler.kalanSaniye));
    setKosuyor(durum.degerler.calisiyor === "1");
  }, [durum]);

  useEffect(() => {
    if (!koşuyor) return;
    const zamanlayici = setInterval(() => {
      setKalan((onceki) => Math.max(onceki - 1, 0));
    }, 1000);
    return () => clearInterval(zamanlayici);
  }, [koşuyor]);

  const bitti = koşuyor && kalan === 0;

  return (
    <span className="ceza">
      <button
        type="button"
        className={`ceza-rozet${koşuyor ? " ceza-calisiyor" : ""}`}
        onClick={() => setAcik((o) => !o)}
        aria-expanded={acik}
        aria-label={`Teneffüs cezası, kalan ${sureYazisi(kalan)}`}
      >
        ⏱ {koşuyor ? sureYazisi(kalan) : `${Math.ceil(kalan / 60)} dk`}
      </button>

      {acik && (
        <span className="ceza-panel">
          <span className="ceza-sure">{sureYazisi(kalan)}</span>
          {bitti && <span className="ceza-bitti">Süre doldu</span>}

          <form action={gonder} className="ceza-islemler">
            <input type="hidden" name="cezaId" value={cezaId} />
            <input type="hidden" name="sinifId" value={sinifId} />
            {/* EKLE ve AZALT bu değeri kullanır; AYARLA aşağıdaki formda. */}
            <input type="hidden" name="dakika" value="1" />

            {!koşuyor && (
              <button type="submit" name="islem" value="BASLAT" disabled={bekliyor}>
                Başlat
              </button>
            )}
            <button type="submit" name="islem" value="EKLE" disabled={bekliyor}>
              +1 dk
            </button>
            <button type="submit" name="islem" value="AZALT" disabled={bekliyor}>
              −1 dk
            </button>
            <button
              type="submit"
              name="islem"
              value="BITIR"
              className="ceza-bitir"
              disabled={bekliyor}
            >
              Bitir
            </button>
          </form>

          <form action={gonder} className="ceza-ayarla">
            <input type="hidden" name="cezaId" value={cezaId} />
            <input type="hidden" name="sinifId" value={sinifId} />
            <input type="hidden" name="islem" value="AYARLA" />
            <input
              name="dakika"
              type="number"
              min={0}
              max={60}
              step={1}
              inputMode="numeric"
              aria-label="Süreyi dakika olarak ayarla"
              defaultValue={Math.ceil(kalanSaniye / 60)}
            />
            <button type="submit" disabled={bekliyor}>
              Süreyi ayarla
            </button>
          </form>

          {durum.hata && <span className="hata">{durum.hata}</span>}
        </span>
      )}
    </span>
  );
}
