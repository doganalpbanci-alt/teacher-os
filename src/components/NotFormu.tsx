"use client";

import { useActionState } from "react";
import { performansNotuKaydet } from "@/app/actions";
import { BOS_FORM } from "@/lib/form-state";

export function NotFormu({
  ogrenciId,
  mevcutNot,
}: {
  ogrenciId: string;
  mevcutNot: number;
}) {
  const [durum, gonder, bekliyor] = useActionState(performansNotuKaydet, BOS_FORM);

  return (
    <form key={durum.deneme} className="not-formu" action={gonder}>
      <input type="hidden" name="ogrenciId" value={ogrenciId} />
      <input
        name="not"
        type="number"
        min={0}
        max={100}
        step={1}
        inputMode="numeric"
        aria-label="Performans notu"
        defaultValue={durum.degerler.not ?? String(mevcutNot)}
      />
      <button type="submit" disabled={bekliyor}>
        {bekliyor ? "Kaydediliyor…" : "Kaydet"}
      </button>
      {durum.hata && <p className="hata">{durum.hata}</p>}
    </form>
  );
}
