"use client";

import { useActionState } from "react";
import { hesapSifirla } from "@/app/actions";
import { BOS_FORM } from "@/lib/form-state";

// Geri alınamaz olduğu için iki ayrı doğrulama ister: hesap parolası ve
// yazılı bir teyit. Tek bir yanlış tıklamayla tetiklenmesin diye.
export function HesapSifirlamaFormu() {
  const [durum, gonder, bekliyor] = useActionState(hesapSifirla, BOS_FORM);

  return (
    <form className="form" action={gonder}>
      <label className="alan">
        <span className="alan-etiket">Parolanız (sıfırlamak için)</span>
        <input name="parola" type="password" autoComplete="current-password" />
      </label>

      <label className="alan">
        <span className="alan-etiket">Onaylamak için &quot;SIFIRLA&quot; yazın</span>
        <input name="onay" type="text" autoComplete="off" />
      </label>

      <button type="submit" className="tehlike-dugmesi" disabled={bekliyor}>
        {bekliyor ? "Siliniyor…" : "Tüm verilerimi sil"}
      </button>

      {durum.hata && <p className="hata">{durum.hata}</p>}
    </form>
  );
}
