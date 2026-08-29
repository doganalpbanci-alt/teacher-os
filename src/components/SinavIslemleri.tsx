"use client";

import { useActionState } from "react";
import Link from "next/link";
import { sinavKaldir } from "@/app/sinav-actions";
import { BOS_FORM } from "@/lib/form-state";

// Sınav detayındaki yönetim düğmeleri: düzenle, sil.
//
// Sınavda arşiv yoktur, ödevden farkı bu: ödev her hafta birikir ve listeyi
// doldurur, sınav dönemde birkaç tanedir ve geçmişi zaten görülmek istenir.
//
// Silme yalnızca hiçbir not işlenmemişse mümkün. Kural sunucuda, kaydın
// silindiği katmanda; buradaki gizleme yalnızca öğretmeni boşuna
// tıklatmamak için. Düğme gizlemek yetki kontrolü değildir.

export function SinavIslemleri({
  sinavId,
  silinebilir,
}: {
  sinavId: string;
  silinebilir: boolean;
}) {
  const [silDurum, silGonder, silBekliyor] = useActionState(sinavKaldir, BOS_FORM);

  return (
    <div className="odev-islemler">
      <Link className="ders-dugme" href={`/sinavlar/${sinavId}/duzenle`}>
        Düzenle
      </Link>

      {silinebilir && (
        <form action={silGonder}>
          <input type="hidden" name="sinavId" value={sinavId} />
          <button type="submit" className="ders-dugme ders-bitir" disabled={silBekliyor}>
            Sil
          </button>
        </form>
      )}

      {silDurum.hata && <p className="hata">{silDurum.hata}</p>}
    </div>
  );
}
