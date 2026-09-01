"use client";

import { useActionState } from "react";
import { veliBilgisiKaydet } from "@/app/veli-actions";
import { BOS_FORM } from "@/lib/form-state";

// Öğrenci eklenirken veli bilgisi girilebiliyordu ama sonradan düzeltmenin
// ya da eksik bırakılanı tamamlamanın bir yolu yoktu; bu formun tek işi bu.
export function VeliBilgisiFormu({
  ogrenciId,
  veliAdi,
  veliTelefonu,
}: {
  ogrenciId: string;
  veliAdi: string | null;
  veliTelefonu: string | null;
}) {
  const [durum, gonder, bekliyor] = useActionState(veliBilgisiKaydet, BOS_FORM);
  const deger = durum.degerler;
  const kaydedildi = durum.hata === null && durum.deneme > 0;

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
            aria-label="Veli telefonu"
            placeholder="Veli telefonu"
            maxLength={30}
            autoComplete="off"
          />
        </div>
        <button type="submit" disabled={bekliyor}>
          {bekliyor ? "Kaydediliyor…" : "Kaydet"}
        </button>
        {durum.hata && <p className="hata">{durum.hata}</p>}
        {kaydedildi && <p className="basari">Kaydedildi.</p>}
      </form>
    </details>
  );
}
