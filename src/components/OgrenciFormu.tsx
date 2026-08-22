"use client";

import { useActionState } from "react";
import { ogrenciEkle } from "@/app/actions";
import { BOS_FORM } from "@/lib/form-state";

export function OgrenciFormu({ sinifId }: { sinifId: string }) {
  const [durum, gonder, bekliyor] = useActionState(ogrenciEkle, BOS_FORM);
  const deger = durum.degerler;

  return (
    // key ve defaultValue icin bkz. SinifFormu.
    <form key={durum.deneme} className="form" action={gonder}>
      <input type="hidden" name="sinifId" value={sinifId} />
      <div className="ikili">
        <input
          name="ad"
          defaultValue={deger.ad ?? ""}
          aria-label="Ad"
          placeholder="Ad"
          maxLength={60}
          autoComplete="off"
        />
        <input
          name="soyad"
          defaultValue={deger.soyad ?? ""}
          aria-label="Soyad"
          placeholder="Soyad"
          maxLength={60}
          autoComplete="off"
        />
      </div>
      <div className="ikili">
        <input
          name="veliAdi"
          defaultValue={deger.veliAdi ?? ""}
          aria-label="Veli adı (isteğe bağlı)"
          placeholder="Veli adı (isteğe bağlı)"
          maxLength={60}
          autoComplete="off"
        />
        <input
          name="veliTelefonu"
          type="tel"
          defaultValue={deger.veliTelefonu ?? ""}
          aria-label="Veli telefonu (isteğe bağlı)"
          placeholder="Veli telefonu (isteğe bağlı)"
          maxLength={30}
          autoComplete="off"
        />
      </div>
      <button type="submit" disabled={bekliyor}>
        {bekliyor ? "Ekleniyor…" : "Öğrenci ekle"}
      </button>
      {durum.hata && <p className="hata">{durum.hata}</p>}
    </form>
  );
}
