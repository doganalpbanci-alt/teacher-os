"use client";

import { useActionState } from "react";
import { yeniDersBaslat } from "@/app/actions";
import { BOS_FORM } from "@/lib/form-state";

export function DersBaslatFormu({ sinifId }: { sinifId: string }) {
  const [durum, gonder, bekliyor] = useActionState(yeniDersBaslat, BOS_FORM);

  return (
    <form action={gonder}>
      <input type="hidden" name="sinifId" value={sinifId} />
      <button className="ders-dugme" type="submit" disabled={bekliyor}>
        {bekliyor ? "Başlatılıyor…" : "Yeni ders başlat"}
      </button>
      {durum.hata && <p className="hata">{durum.hata}</p>}
    </form>
  );
}
