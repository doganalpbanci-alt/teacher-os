"use client";

import { useActionState } from "react";
import { yeniOdevOlustur } from "@/app/actions";
import { BOS_FORM } from "@/lib/form-state";

export function OdevFormu({ sinifId }: { sinifId: string }) {
  const [durum, gonder, bekliyor] = useActionState(yeniOdevOlustur, BOS_FORM);

  return (
    <form key={durum.deneme} className="form" action={gonder}>
      <input type="hidden" name="sinifId" value={sinifId} />
      <input
        name="title"
        defaultValue={durum.degerler.title ?? ""}
        aria-label="Ödev başlığı"
        placeholder="Ödev başlığı (örn. Unit 4 workbook)"
        maxLength={120}
        autoComplete="off"
      />
      <textarea
        name="description"
        defaultValue={durum.degerler.description ?? ""}
        aria-label="Açıklama"
        placeholder="Açıklama (isteğe bağlı)"
        maxLength={500}
        rows={2}
      />
      <input
        type="date"
        name="dueDate"
        defaultValue={durum.degerler.dueDate ?? ""}
        aria-label="Son teslim tarihi"
      />
      <button type="submit" disabled={bekliyor}>
        {bekliyor ? "Ekleniyor…" : "Ödev ekle"}
      </button>
      {durum.hata && <p className="hata">{durum.hata}</p>}
    </form>
  );
}
