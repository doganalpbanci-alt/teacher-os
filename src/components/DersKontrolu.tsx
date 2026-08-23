"use client";

import { useActionState } from "react";
import { yeniDersBaslat, dersiBitir } from "@/app/actions";
import { BOS_FORM } from "@/lib/form-state";

/**
 * Ders başlatma ve bitirme aynı yerde durur: aynı anda ikisinden yalnızca
 * biri geçerlidir. Süren ders varken "başlat" gösterilmez, çünkü bir sınıfın
 * aynı anda tek dersi olur.
 */
export function DersKontrolu({
  sinifId,
  aktifDersId,
}: {
  sinifId: string;
  aktifDersId: string | null;
}) {
  const [baslatDurumu, baslat, baslatiliyor] = useActionState(yeniDersBaslat, BOS_FORM);
  const [bitirDurumu, bitir, bitiriliyor] = useActionState(dersiBitir, BOS_FORM);

  if (aktifDersId) {
    return (
      <form action={bitir}>
        <input type="hidden" name="sinifId" value={sinifId} />
        <input type="hidden" name="dersId" value={aktifDersId} />
        <button className="ders-dugme ders-bitir" type="submit" disabled={bitiriliyor}>
          {bitiriliyor ? "Bitiriliyor…" : "Dersi bitir"}
        </button>
        {bitirDurumu.hata && <p className="hata">{bitirDurumu.hata}</p>}
      </form>
    );
  }

  return (
    <form action={baslat}>
      <input type="hidden" name="sinifId" value={sinifId} />
      <button className="ders-dugme" type="submit" disabled={baslatiliyor}>
        {baslatiliyor ? "Başlatılıyor…" : "Yeni ders başlat"}
      </button>
      {baslatDurumu.hata && <p className="hata">{baslatDurumu.hata}</p>}
    </form>
  );
}
