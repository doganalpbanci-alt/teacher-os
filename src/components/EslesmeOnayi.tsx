"use client";

import Link from "next/link";
import { useActionState } from "react";
import { eslesmeOnayla, type OnayDurumu } from "@/app/eslestirme-actions";

// Telefondaki onay düğmesi. Onayın kendisi server action: karar sunucuda
// verilir, tarayıcıya "onaylandı" diye bir söz verilmez.

const BOS: OnayDurumu = {};

export function EslesmeOnayi({ eslesmeId, kod }: { eslesmeId: string; kod: string }) {
  const [durum, gonder, bekliyor] = useActionState(eslesmeOnayla, BOS);

  if (durum.onaylandi) {
    return (
      <>
        <p className="basari">Onaylandı. Tahta birkaç saniye içinde girecek.</p>
        <Link className="baglanti" href="/">
          Ana sayfaya dön
        </Link>
      </>
    );
  }

  return (
    <>
      <p className="qr-kod-etiket">Tahtadaki kod bu mu?</p>
      <p className="qr-kod">{kod}</p>
      <p className="soluk">
        Kod tahtada yazandan farklıysa <strong>onaylamayın</strong> — okuttuğunuz
        QR sizin tahtanızın olmayabilir.
      </p>

      <form className="form" action={gonder}>
        <input type="hidden" name="id" value={eslesmeId} />
        <button type="submit" disabled={bekliyor}>
          {bekliyor ? "Onaylanıyor…" : "Onayla, tahtada oturum aç"}
        </button>
      </form>

      {durum.hata && <p className="hata">{durum.hata}</p>}

      <Link className="baglanti" href="/">
        Vazgeç
      </Link>
    </>
  );
}
