"use client";

import { useActionState } from "react";
import type { BehaviorTemplate } from "@prisma/client";
import { sablonDegistir } from "@/app/actions";
import { BOS_FORM } from "@/lib/form-state";

const SECENEKLER: {
  deger: BehaviorTemplate;
  baslik: string;
  aciklama: string;
}[] = [
  {
    deger: "SIMPLE",
    baslik: "Basit artı / eksi",
    aciklama:
      "Ders içinde artı ve eksi verirsiniz, hepsi geçmişe kaydedilir. Performans notunu geçmişe bakarak kendiniz girersiniz.",
  },
  {
    deger: "CARD",
    baslik: "Kart sistemi",
    aciklama:
      "Yıldız ve uyarı düğmeleri. Bir derste ilk uyarı sarı kart, tekrarı kırmızı karttır. Performans notu kayıtlardan otomatik hesaplanır.",
  },
];

export function SablonFormu({ secili }: { secili: BehaviorTemplate }) {
  const [durum, gonder, bekliyor] = useActionState(sablonDegistir, BOS_FORM);

  return (
    <form className="sablon-formu" action={gonder}>
      {SECENEKLER.map((secenek) => (
        <label key={secenek.deger} className="sablon-secenek">
          <input
            type="radio"
            name="sablon"
            value={secenek.deger}
            defaultChecked={secili === secenek.deger}
          />
          <span>
            <strong>{secenek.baslik}</strong>
            <span className="soluk">{secenek.aciklama}</span>
          </span>
        </label>
      ))}
      <button type="submit" disabled={bekliyor}>
        {bekliyor ? "Kaydediliyor…" : "Kaydet"}
      </button>
      {durum.hata && <p className="hata">{durum.hata}</p>}
      {!durum.hata && durum.deneme > 0 && (
        <p className="basari">Sistem değiştirildi.</p>
      )}
    </form>
  );
}
