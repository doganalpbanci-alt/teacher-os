"use client";

import { useActionState } from "react";
import { davranisGeriAl } from "@/app/actions";
import { BOS_FORM } from "@/lib/form-state";

// Yanlış öğrenciye basmak ders sırasında olağan bir hata. Yalnızca SÜREN
// dersteki son kayıt geri alınır; ders bitince kayıt geçmişe dönüşür ve
// düğme de kaybolur (kural: `sonKaydiGeriAl`).
//
// İyimser güncelleme YOK: geri alınan şeyin ne olduğunu ekran bilemez
// (kırmızı kartsa yanında eksi ve teneffüs cezası da vardır). Sunucu
// söyleyene kadar beklenir; nadiren basılan, düşünerek basılan bir düğme.
export function GeriAlDugmesi({
  ogrenciId,
  sinifId,
  dersId,
  ad,
}: {
  ogrenciId: string;
  sinifId: string;
  dersId: string;
  /** Ekran okuyucu için: satırda yalnızca bir simge görünüyor. */
  ad: string;
}) {
  const [durum, gonder, bekliyor] = useActionState(davranisGeriAl, BOS_FORM);

  return (
    <form className="geri-al" action={gonder}>
      <input type="hidden" name="ogrenciId" value={ogrenciId} />
      <input type="hidden" name="sinifId" value={sinifId} />
      <input type="hidden" name="dersId" value={dersId} />
      <button
        type="submit"
        disabled={bekliyor}
        aria-label={`${ad}: son kaydı geri al`}
        title="Son kaydı geri al"
      >
        ↶
      </button>
      {durum.hata && <span className="hata">{durum.hata}</span>}
    </form>
  );
}
