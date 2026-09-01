"use client";

import { useActionState, useEffect, useState } from "react";
import { veliBilgisiKaydet } from "@/app/veli-actions";
import { BOS_FORM } from "@/lib/form-state";

// Öğrenci eklenirken veli bilgisi girilebiliyordu ama sonradan düzeltmenin
// ya da eksik bırakılanı tamamlamanın bir yolu yoktu; bu formun tek işi bu.
export function VeliBilgisiFormu({
  ogrenciId,
  veliAdi,
  veliTelefonu,
  sonOnayYazisi,
}: {
  ogrenciId: string;
  veliAdi: string | null;
  veliTelefonu: string | null;
  /** Son izin teyidinin tarihi, ekrana yazılmaya hazır. Hiç teyit yoksa null. */
  sonOnayYazisi: string | null;
}) {
  const [durum, gonder, bekliyor] = useActionState(veliBilgisiKaydet, BOS_FORM);
  const deger = durum.degerler;
  const kaydedildi = durum.hata === null && durum.deneme > 0;
  // `<form key={durum.deneme}>` yalnızca formun İÇİNİ sıfırlar; bu state
  // dışarıda durduğu için kendiliğinden sıfırlanmaz (bkz. OgrenciFormu'ndaki
  // aynı not) — bu yüzden her yeni sonuçta ayrıca senkron edilir.
  const [telefonVar, setTelefonVar] = useState(
    Boolean(deger.veliTelefonu ?? veliTelefonu),
  );

  useEffect(() => {
    setTelefonVar(Boolean(deger.veliTelefonu ?? veliTelefonu));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durum.deneme]);

  return (
    <details className="kart katlanir">
      <summary>Veli bilgilerini düzenle</summary>
      <form key={durum.deneme} className="form" action={gonder}>
        <input type="hidden" name="ogrenciId" value={ogrenciId} />
        <div className="ikili">
          <input
            name="veliAdi"
            defaultValue={deger.veliAdi ?? veliAdi ?? ""}
            aria-label="Veli adı"
            placeholder="Veli adı"
            maxLength={60}
            autoComplete="off"
          />
          <input
            name="veliTelefonu"
            type="tel"
            defaultValue={deger.veliTelefonu ?? veliTelefonu ?? ""}
            onChange={(e) => setTelefonVar(e.target.value.trim().length > 0)}
            aria-label="Veli telefonu"
            placeholder="Veli telefonu"
            maxLength={30}
            autoComplete="off"
          />
        </div>
        {telefonVar && (
          <>
            <label className="onay-satiri">
              <input type="checkbox" name="veliOnayi" required />
              <span>
                Veliye ait bu iletişim bilgisini kaydetmek için iznim olduğunu
                onaylıyorum.
              </span>
            </label>
            <p className="soluk alan-not">
              {sonOnayYazisi
                ? `Son onay: ${sonOnayYazisi}. Telefon her kaydedilişte yeniden istenir.`
                : "Bu numara için daha önce teyit edilmiş bir onay kaydı yok."}
            </p>
          </>
        )}
        <button type="submit" disabled={bekliyor}>
          {bekliyor ? "Kaydediliyor…" : "Kaydet"}
        </button>
        {durum.hata && <p className="hata">{durum.hata}</p>}
        {kaydedildi && <p className="basari">Kaydedildi.</p>}
      </form>
    </details>
  );
}
