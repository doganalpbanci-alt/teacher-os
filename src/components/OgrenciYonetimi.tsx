"use client";

import { useActionState } from "react";
import { ogrenciArsivDegistir, ogrenciSil } from "@/app/actions";
import { BOS_FORM } from "@/lib/form-state";

// Silme yalnızca öğrencinin hiç geçmiş kaydı (davranış, ceza, ödev, sınav,
// veli mesajı) yoksa mümkün. Kural sunucuda; buradaki gizleme yalnızca
// öğretmeni boşuna tıklatmamak için, yetki kontrolü değildir.
export function OgrenciYonetimi({
  ogrenciId,
  arsivde,
  silinebilir,
}: {
  ogrenciId: string;
  arsivde: boolean;
  silinebilir: boolean;
}) {
  const [arsivDurum, arsivGonder, arsivBekliyor] = useActionState(
    ogrenciArsivDegistir,
    BOS_FORM,
  );
  const [silDurum, silGonder, silBekliyor] = useActionState(ogrenciSil, BOS_FORM);

  return (
    <div className="yonetim-satiri">
      <form action={arsivGonder}>
        <input type="hidden" name="ogrenciId" value={ogrenciId} />
        <input type="hidden" name="arsiv" value={arsivde ? "0" : "1"} />
        <button type="submit" className="ders-dugme" disabled={arsivBekliyor}>
          {arsivde ? "Arşivden çıkar" : "Arşivle"}
        </button>
      </form>

      {silinebilir && (
        <form action={silGonder}>
          <input type="hidden" name="ogrenciId" value={ogrenciId} />
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
