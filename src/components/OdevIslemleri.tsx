"use client";

import { useActionState } from "react";
import Link from "next/link";
import { odevArsivDegistir, odevKaldir } from "@/app/odev-actions";
import { BOS_FORM } from "@/lib/form-state";

// Ödev detayındaki yönetim düğmeleri: düzenle, kopyala, arşivle, sil.
//
// Silme yalnızca hiçbir öğrenci işaretlenmemişse mümkün. Kural sunucuda,
// kaydın silindiği katmanda; buradaki gizleme yalnızca öğretmeni boşuna
// tıklatmamak için. Düğme gizlemek yetki kontrolü değildir.

export function OdevIslemleri({
  odevId,
  arsivde,
  silinebilir,
}: {
  odevId: string;
  arsivde: boolean;
  silinebilir: boolean;
}) {
  const [arsivDurum, arsivGonder, arsivBekliyor] = useActionState(
    odevArsivDegistir,
    BOS_FORM,
  );
  const [silDurum, silGonder, silBekliyor] = useActionState(odevKaldir, BOS_FORM);

  return (
    <div className="odev-islemler">
      <Link className="ders-dugme" href={`/odevler/${odevId}/duzenle`}>
        Düzenle
      </Link>
      <Link className="ders-dugme" href={`/odevler/yeni?kaynak=${odevId}`}>
        Kopyala
      </Link>

      <form action={arsivGonder}>
        <input type="hidden" name="odevId" value={odevId} />
        <input type="hidden" name="arsiv" value={arsivde ? "0" : "1"} />
        <button type="submit" className="ders-dugme" disabled={arsivBekliyor}>
          {arsivde ? "Arşivden çıkar" : "Arşivle"}
        </button>
      </form>

      {silinebilir && (
        <form action={silGonder}>
          <input type="hidden" name="odevId" value={odevId} />
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
