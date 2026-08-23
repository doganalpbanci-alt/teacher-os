"use client";

import { useActionState } from "react";
import { girisYap } from "@/app/oturum-actions";
import { BOS_FORM } from "@/lib/form-state";

export function GirisFormu() {
  const [durum, gonder, bekliyor] = useActionState(girisYap, BOS_FORM);

  return (
    <form className="form" action={gonder}>
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
        placeholder="Parola"
        autoComplete="current-password"
      />
      <button type="submit" disabled={bekliyor}>
        {bekliyor ? "Giriş yapılıyor…" : "Giriş yap"}
      </button>
      {durum.hata && <p className="hata">{durum.hata}</p>}
    </form>
  );
}
