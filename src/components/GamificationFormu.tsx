"use client";

import { useActionState } from "react";
import { gamificationDegistir } from "@/app/actions";
import { BOS_FORM } from "@/lib/form-state";

export function GamificationFormu({ acik }: { acik: boolean }) {
  const [durum, gonder, bekliyor] = useActionState(gamificationDegistir, BOS_FORM);
  const kaydedildi = durum.hata === null && durum.deneme > 0;

  return (
    <form className="form" action={gonder}>
      <label className="onay-satiri">
        <input type="checkbox" name="acik" value="1" defaultChecked={acik} />
        <span>
          Sınıf hedeflerini kullan. Açtığınızda sınıf sayfalarında bir hedef
          belirleyip (örn. "100 yıldızda film günü") ilerlemeyi
          gösterebilirsiniz. Kullanmak istemezseniz kapalı kalabilir.
        </span>
      </label>

      <button type="submit" disabled={bekliyor}>
        {bekliyor ? "Kaydediliyor…" : "Kaydet"}
      </button>

      {durum.hata && <p className="hata">{durum.hata}</p>}
      {kaydedildi && <p className="basari">Ayar kaydedildi.</p>}
    </form>
  );
}
