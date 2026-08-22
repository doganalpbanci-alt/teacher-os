"use client";

import { useActionState } from "react";
import { sinifOlustur } from "@/app/actions";
import { BOS_FORM } from "@/lib/form-state";

export function SinifFormu() {
  const [durum, gonder, bekliyor] = useActionState(sinifOlustur, BOS_FORM);

  return (
    // key her gönderimden sonra değişir; form yeniden kurulur ve
    // defaultValue uygulanır. Başarılıda değerler boş gelir (alanlar
    // temizlenir), hatalıda kullanıcının yazdıkları geri konur.
    <form key={durum.deneme} className="form" action={gonder}>
      <input
        name="ad"
        defaultValue={durum.degerler.ad ?? ""}
        aria-label="Sınıf adı"
        placeholder="Sınıf adı (örn. 5-A)"
        maxLength={60}
        autoComplete="off"
      />
      <button type="submit" disabled={bekliyor}>
        {bekliyor ? "Ekleniyor…" : "Sınıf ekle"}
      </button>
      {durum.hata && <p className="hata">{durum.hata}</p>}
    </form>
  );
}
