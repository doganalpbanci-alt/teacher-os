"use client";

import { useActionState } from "react";
import { topluDurumGuncelle } from "@/app/odev-actions";
import { BOS_FORM } from "@/lib/form-state";

// Ders başında sınıfı hızlı kontrol etmek için: hepsini bir kerede işaretle,
// sonra istisnaları tek tek değiştir. 25 kişilik sınıfta 25 basış yerine
// 1 + birkaç basış.

export function TopluIsaretle({
  odevId,
  sinifId,
  sinifAdi,
}: {
  odevId: string;
  /** Boş bırakılırsa ödevin tamamı; doluysa yalnızca o sınıf. */
  sinifId: string | null;
  sinifAdi: string;
}) {
  const [durum, gonder, bekliyor] = useActionState(topluDurumGuncelle, BOS_FORM);

  return (
    <form className="toplu" action={gonder}>
      <input type="hidden" name="odevId" value={odevId} />
      <input type="hidden" name="sinifId" value={sinifId ?? ""} />
      <span className="soluk">Tümü:</span>
      <button
        type="submit"
        name="durum"
        value="DONE"
        className="t-done"
        disabled={bekliyor}
        title={`${sinifAdi} sınıfının tamamını Yapıldı işaretle`}
      >
        Yapıldı
      </button>
      <button
        type="submit"
        name="durum"
        value="MISSING"
        className="t-missing"
        disabled={bekliyor}
        title={`${sinifAdi} sınıfının tamamını Eksik işaretle`}
      >
        Eksik
      </button>
      <button
        type="submit"
        name="durum"
        value="PENDING"
        className="t-pending"
        disabled={bekliyor}
        title={`${sinifAdi} sınıfının tamamını Bekliyor'a çevir`}
      >
        Sıfırla
      </button>
      {durum.hata && <span className="hata">{durum.hata}</span>}
    </form>
  );
}
