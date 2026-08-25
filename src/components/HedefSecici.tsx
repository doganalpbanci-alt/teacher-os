"use client";

import { useEffect, useRef } from "react";
import type { HedefSinif } from "@/lib/assignment";

// Ödevin kime verileceğini seçtiren liste. Sınıf başlığındaki kutu o sınıfın
// tamamını seçer; öğrenciler ayrıca tek tek işaretlenebilir. Birden fazla
// sınıf aynı anda seçilebilir.
//
// Seçim durumu üstteki formda tutulur: form hem seçimi gönderecek hem de
// kaç işaretli kaydın kaybolacağını yazacak, ikisi aynı veriye bakmalı.

function SinifKutusu({
  tumu,
  bazi,
  onDegis,
}: {
  tumu: boolean;
  bazi: boolean;
  onDegis: (secili: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  // "Kısmen seçili" hali yalnızca DOM üzerinden verilebilir, React özelliği
  // değildir. Sınıfın bir kısmı seçiliyse kutu ne boş ne dolu görünür.
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !tumu && bazi;
  }, [tumu, bazi]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={tumu}
      onChange={(e) => onDegis(e.target.checked)}
    />
  );
}

export function HedefSecici({
  siniflar,
  secili,
  onDegis,
  isaretliIdler,
}: {
  siniflar: HedefSinif[];
  secili: Set<string>;
  onDegis: (yeni: Set<string>) => void;
  /** Seçimden çıkarılırsa kaydı kaybolacak öğrenciler (yalnızca düzenlemede). */
  isaretliIdler: Set<string>;
}) {
  function ogrenciDegistir(id: string, isaretli: boolean) {
    const yeni = new Set(secili);
    if (isaretli) yeni.add(id);
    else yeni.delete(id);
    onDegis(yeni);
  }

  function sinifDegistir(sinif: HedefSinif, isaretli: boolean) {
    const yeni = new Set(secili);
    for (const ogrenci of sinif.ogrenciler) {
      if (isaretli) yeni.add(ogrenci.id);
      else yeni.delete(ogrenci.id);
    }
    onDegis(yeni);
  }

  if (siniflar.length === 0) {
    return (
      <p className="soluk">
        Ödev verilebilecek öğrenci yok. Önce bir sınıf ve öğrenci ekleyin.
      </p>
    );
  }

  return (
    <div className="hedef">
      {siniflar.map((sinif) => {
        const seciliSayi = sinif.ogrenciler.filter((o) => secili.has(o.id)).length;
        const tumu = sinif.ogrenciler.length > 0 && seciliSayi === sinif.ogrenciler.length;

        return (
          <fieldset className="hedef-sinif" key={sinif.id}>
            <legend className="gorunmez">{sinif.ad}</legend>

            <label className="hedef-basi">
              <SinifKutusu
                tumu={tumu}
                bazi={seciliSayi > 0}
                onDegis={(s) => sinifDegistir(sinif, s)}
              />
              <span className="hedef-ad">{sinif.ad}</span>
              <span className="rozet">
                {seciliSayi}/{sinif.ogrenciler.length}
              </span>
            </label>

            {sinif.ogrenciler.length === 0 ? (
              <p className="soluk hedef-bos">Bu sınıfta öğrenci yok.</p>
            ) : (
              <div className="hedef-ogrenciler">
                {sinif.ogrenciler.map((ogrenci) => {
                  const isaretli = secili.has(ogrenci.id);
                  // Düzenlemede: işaretlenmiş bir öğrenci seçimden çıkarılmak
                  // üzereyse uyarı görünür, çünkü kaydı silinecek.
                  const kaybolacak = isaretliIdler.has(ogrenci.id) && !isaretli;
                  return (
                    <label
                      className={`hedef-ogrenci${kaybolacak ? " kaybolacak" : ""}`}
                      key={ogrenci.id}
                    >
                      <input
                        type="checkbox"
                        name="ogrenci"
                        value={ogrenci.id}
                        checked={isaretli}
                        onChange={(e) => ogrenciDegistir(ogrenci.id, e.target.checked)}
                      />
                      <span>{ogrenci.ad}</span>
                      {kaybolacak && <span className="kaybolacak-not">kaydı silinecek</span>}
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
