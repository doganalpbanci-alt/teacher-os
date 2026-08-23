"use client";

import { useActionState } from "react";
import { kurulumuTamamla } from "@/app/oturum-actions";
import { BOS_FORM } from "@/lib/form-state";

export function KurulumFormu() {
  const [durum, gonder, bekliyor] = useActionState(kurulumuTamamla, BOS_FORM);

  return (
    <form className="form" action={gonder}>
      <input
        name="ad"
        aria-label="Adınız"
        placeholder="Adınız"
        maxLength={60}
        defaultValue={durum.degerler.ad ?? ""}
      />
      <input
        name="eposta"
        type="email"
        aria-label="E-posta"
        placeholder="E-posta"
        autoComplete="username"
        defaultValue={durum.degerler.eposta ?? ""}
      />
      <input
        name="parola"
        type="password"
        aria-label="Parola"
        placeholder="Parola (en az 8 karakter)"
        autoComplete="new-password"
      />
      <input
        name="parolaTekrar"
        type="password"
        aria-label="Parola tekrar"
        placeholder="Parola tekrar"
        autoComplete="new-password"
      />
      <button type="submit" disabled={bekliyor}>
        {bekliyor ? "Oluşturuluyor…" : "Hesabı oluştur"}
      </button>
      {durum.hata && <p className="hata">{durum.hata}</p>}
    </form>
  );
}
