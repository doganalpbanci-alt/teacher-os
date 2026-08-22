"use client";

import { useActionState } from "react";
import { davranisKaydiOlustur } from "@/app/actions";
import { BOS_FORM } from "@/lib/form-state";

export function DavranisDugmeleri({
  ogrenciId,
  sinifId,
  dersId,
}: {
  ogrenciId: string;
  sinifId: string;
  // Aktif ders yoksa null gelir; düğmeler pasif olur.
  dersId: string | null;
}) {
  const [durum, gonder, bekliyor] = useActionState(davranisKaydiOlustur, BOS_FORM);
  const kapali = dersId === null || bekliyor;

  return (
    <form className="davranis" action={gonder}>
      <input type="hidden" name="ogrenciId" value={ogrenciId} />
      <input type="hidden" name="sinifId" value={sinifId} />
      <input type="hidden" name="dersId" value={dersId ?? ""} />
      {/* Tür, basılan düğmenin value'sundan gelir; iki düğme tek form paylaşır. */}
      <button
        type="submit"
        name="tur"
        value="PLUS"
        disabled={kapali}
        aria-label="Artı puan ver"
        title="Artı puan"
      >
        +
      </button>
      <button
        type="submit"
        name="tur"
        value="IHLAL"
        disabled={kapali}
        aria-label="Kural ihlali kaydet"
        title="Kural ihlali"
      >
        −
      </button>
      {durum.hata && <span className="hata">{durum.hata}</span>}
    </form>
  );
}
