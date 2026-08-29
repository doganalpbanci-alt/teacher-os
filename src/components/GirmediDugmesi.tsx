"use client";

import { useActionState } from "react";
import { girmediDegistir } from "@/app/sinav-actions";
import { BOS_FORM } from "@/lib/form-state";

// "Sınava girmedi" işareti. Boş nottan farkı: boş "henüz girilmedi", bu
// "girmeyecek" demektir. İşaretli öğrenci ortalamaya katılmaz ama sayılır.

export function GirmediDugmesi({
  sonucId,
  sinavId,
  girmedi,
}: {
  sonucId: string;
  sinavId: string;
  girmedi: boolean;
}) {
  const [sonuc, gonder, bekliyor] = useActionState(girmediDegistir, BOS_FORM);

  return (
    <form className="girmedi" action={gonder}>
      <input type="hidden" name="sonucId" value={sonucId} />
      <input type="hidden" name="sinavId" value={sinavId} />
      <button
        type="submit"
        name="girmedi"
        value={girmedi ? "0" : "1"}
        className={`girmedi-dugme${girmedi ? " secili" : ""}`}
        disabled={bekliyor}
        aria-pressed={girmedi}
      >
        {girmedi ? "Girmedi" : "Girmedi mi?"}
      </button>
      {sonuc.hata && <span className="hata">{sonuc.hata}</span>}
    </form>
  );
}
