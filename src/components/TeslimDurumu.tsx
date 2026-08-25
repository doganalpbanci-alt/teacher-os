"use client";

import { useActionState } from "react";
import type { SubmissionStatus } from "@prisma/client";
import { teslimDurumuGuncelle } from "@/app/odev-actions";
import { BOS_FORM } from "@/lib/form-state";

// Durumlar bilerek bu sırada: ders başında en sık basılan "Yapıldı" ilk
// sırada, "Bekliyor" (geri alma) en sonda.
const SECENEKLER: { deger: SubmissionStatus; yazi: string }[] = [
  { deger: "DONE", yazi: "Yapıldı" },
  { deger: "LATE", yazi: "Geç" },
  { deger: "MISSING", yazi: "Eksik" },
  { deger: "PENDING", yazi: "Bekliyor" },
];

export function TeslimDurumu({
  submissionId,
  odevId,
  durum,
}: {
  submissionId: string;
  odevId: string;
  durum: SubmissionStatus;
}) {
  const [sonuc, gonder, bekliyor] = useActionState(teslimDurumuGuncelle, BOS_FORM);

  return (
    <form className="teslim-durum" action={gonder}>
      <input type="hidden" name="submissionId" value={submissionId} />
      <input type="hidden" name="odevId" value={odevId} />
      {SECENEKLER.map((secenek) => (
        <button
          key={secenek.deger}
          type="submit"
          name="durum"
          value={secenek.deger}
          className={`t-${secenek.deger.toLowerCase()}${durum === secenek.deger ? " secili" : ""}`}
          disabled={bekliyor}
          aria-pressed={durum === secenek.deger}
        >
          {secenek.yazi}
        </button>
      ))}
      {sonuc.hata && <span className="hata">{sonuc.hata}</span>}
    </form>
  );
}
