"use client";

import { useActionState, useEffect, useState } from "react";
import { ogrenciAdiGuncelle } from "@/app/actions";
import { BOS_FORM } from "@/lib/form-state";

/**
 * Öğrenci sayfasındaki başlık: normalde düz metin, "Düzenle" ile küçük bir
 * forma dönüşür. Ekleme sırasında yapılan bir yazım hatasının tek düzeltme
 * yolu SQL'di; bu, o boşluğu kapatır.
 */
export function OgrenciAdiFormu({
  ogrenciId,
  ad,
  soyad,
}: {
  ogrenciId: string;
  ad: string;
  soyad: string;
}) {
  const [duzenleniyor, setDuzenleniyor] = useState(false);
  const [durum, gonder, bekliyor] = useActionState(ogrenciAdiGuncelle, BOS_FORM);

  // Kayıt başarılı olunca (deneme arttı, hata yok) düzenleme kapanır.
  useEffect(() => {
    if (durum.deneme > 0 && !durum.hata) setDuzenleniyor(false);
  }, [durum.deneme, durum.hata]);

  if (!duzenleniyor) {
    return (
      <h1 className="ogrenci-basligi">
        {ad} {soyad}
        <button
          type="button"
          className="ogrenci-adi-duzenle"
          onClick={() => setDuzenleniyor(true)}
        >
          Düzenle
        </button>
      </h1>
    );
  }

  return (
    <form key={durum.deneme} className="form ogrenci-adi-formu" action={gonder}>
      <input type="hidden" name="ogrenciId" value={ogrenciId} />
      <div className="ikili">
        <input
          name="ad"
          defaultValue={durum.degerler.ad ?? ad}
          aria-label="Ad"
          placeholder="Ad"
          maxLength={60}
          autoComplete="off"
          autoFocus
        />
        <input
          name="soyad"
          defaultValue={durum.degerler.soyad ?? soyad}
          aria-label="Soyad"
          placeholder="Soyad"
          maxLength={60}
          autoComplete="off"
        />
      </div>
      <div className="ogrenci-adi-dugmeler">
        <button type="submit" disabled={bekliyor}>
          {bekliyor ? "Kaydediliyor…" : "Kaydet"}
        </button>
        <button
          type="button"
          className="ders-dugme"
          onClick={() => setDuzenleniyor(false)}
          disabled={bekliyor}
        >
          Vazgeç
        </button>
      </div>
      {durum.hata && <p className="hata">{durum.hata}</p>}
    </form>
  );
}
