"use client";

import { useActionState } from "react";
import { tahtaPininiKaydet, tahtaSuresiniKaydet } from "@/app/kilit-actions";
import { BOS_FORM } from "@/lib/form-state";
import {
  EN_KISA_PIN,
  EN_KISA_SURE_DAKIKA,
  EN_UZUN_PIN,
  EN_UZUN_SURE_DAKIKA,
} from "@/lib/lock-rules";

// Tahta kilidinin ayarları. PIN'i değiştirmek hesap parolası ister: PIN'i
// unutmak çıkışsız kalmak olmasın, ve açık kalmış bir cihazda başkası PIN'i
// sessizce değiştiremesin.

export function TahtaPinFormu({ pinVar }: { pinVar: boolean }) {
  const [durum, gonder, bekliyor] = useActionState(tahtaPininiKaydet, BOS_FORM);
  const kaydedildi = durum.hata === null && durum.deneme > 0;

  return (
    <form className="form" action={gonder}>
      <label className="alan">
        <span className="alan-etiket">Hesap parolanız</span>
        <input name="parola" type="password" autoComplete="current-password" />
      </label>

      <div className="ikili">
        <label className="alan">
          <span className="alan-etiket">
            {pinVar ? "Yeni tahta PIN'i" : "Tahta PIN'i"}
          </span>
          <input
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            minLength={EN_KISA_PIN}
            maxLength={EN_UZUN_PIN}
          />
        </label>

        <label className="alan">
          <span className="alan-etiket">PIN tekrar</span>
          <input
            name="pinTekrar"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            minLength={EN_KISA_PIN}
            maxLength={EN_UZUN_PIN}
          />
        </label>
      </div>

      <button type="submit" disabled={bekliyor}>
        {bekliyor ? "Kaydediliyor…" : pinVar ? "PIN'i değiştir" : "PIN'i belirle"}
      </button>

      {durum.hata && <p className="hata">{durum.hata}</p>}
      {kaydedildi && <p className="basari">PIN kaydedildi.</p>}
    </form>
  );
}

export function TahtaSuresiFormu({ dakika }: { dakika: number }) {
  const [durum, gonder, bekliyor] = useActionState(tahtaSuresiniKaydet, BOS_FORM);
  const kaydedildi = durum.hata === null && durum.deneme > 0;

  return (
    <form className="form" action={gonder}>
      <label className="alan">
        <span className="alan-etiket">Açık kalma süresi (dakika)</span>
        <input
          name="dakika"
          type="number"
          inputMode="numeric"
          min={EN_KISA_SURE_DAKIKA}
          max={EN_UZUN_SURE_DAKIKA}
          step={1}
          defaultValue={durum.degerler.dakika ?? String(dakika)}
        />
        <span className="soluk alan-not">
          PIN girildikten sonra cihaz bu süre boyunca açık kalır, sonra
          kendiliğinden kilitlenir.
        </span>
      </label>

      {/* "Kaydet" DENMEZ: bu sayfadaki davranış şablonu formunun düğmesi
          zaten öyle ve iki düğme birbirine karışır. */}
      <button type="submit" disabled={bekliyor}>
        {bekliyor ? "Güncelleniyor…" : "Süreyi güncelle"}
      </button>

      {durum.hata && <p className="hata">{durum.hata}</p>}
      {kaydedildi && <p className="basari">Süre kaydedildi.</p>}
    </form>
  );
}
