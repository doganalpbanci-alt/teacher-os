"use client";

import { useActionState } from "react";
import { sinifArsivDegistir, sinifSil } from "@/app/actions";
import { BOS_FORM } from "@/lib/form-state";

// Silme yalnızca sınıf tamamen boşsa (hiç öğrenci, hiç ders) mümkün. Kural
// sunucuda, kaydın silindiği katmanda; buradaki gizleme yalnızca öğretmeni
// boşuna tıklatmamak için. Düğme gizlemek yetki kontrolü değildir.
export function SinifYonetimi({
  sinifId,
  arsivde,
  silinebilir,
}: {
  sinifId: string;
  arsivde: boolean;
  silinebilir: boolean;
}) {
  const [arsivDurum, arsivGonder, arsivBekliyor] = useActionState(
    sinifArsivDegistir,
    BOS_FORM,
  );
  const [silDurum, silGonder, silBekliyor] = useActionState(sinifSil, BOS_FORM);

  return (
    <div className="yonetim-satiri">
      <form action={arsivGonder}>
        <input type="hidden" name="sinifId" value={sinifId} />
        <input type="hidden" name="arsiv" value={arsivde ? "0" : "1"} />
        <button type="submit" className="ders-dugme" disabled={arsivBekliyor}>
          {arsivde ? "Arşivden çıkar" : "Arşivle"}
        </button>
      </form>

      {silinebilir && (
        <form action={silGonder}>
          <input type="hidden" name="sinifId" value={sinifId} />
          <button type="submit" className="ders-dugme ders-bitir" disabled={silBekliyor}>
            Sil
          </button>
        </form>
      )}

      {arsivDurum.hata && <p className="hata">{arsivDurum.hata}</p>}
      {silDurum.hata && <p className="hata">{silDurum.hata}</p>}
    </div>
  );
}
