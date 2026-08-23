"use client";

import { useActionState } from "react";
import type { BehaviorTemplate } from "@prisma/client";
import { davranisKaydiOlustur } from "@/app/actions";
import { BOS_FORM } from "@/lib/form-state";

// Şablona göre hangi düğmelerin görüneceği. value sunucuya gönderilen eylemdir.
const DUGMELER: Record<
  BehaviorTemplate,
  { deger: string; yazi: string; etiket: string; sinif: string }[]
> = {
  SIMPLE: [
    { deger: "PLUS", yazi: "+", etiket: "Artı ver", sinif: "d-arti" },
    { deger: "MINUS", yazi: "−", etiket: "Eksi ver", sinif: "d-eksi" },
  ],
  CARD: [
    { deger: "PLUS", yazi: "★", etiket: "Yıldız ver", sinif: "d-yildiz" },
    { deger: "IHLAL", yazi: "!", etiket: "Uyarı ver", sinif: "d-uyari" },
    { deger: "SARI_KART", yazi: "", etiket: "Sarı kart ver", sinif: "d-sari" },
    { deger: "KIRMIZI_KART", yazi: "", etiket: "Kırmızı kart ver", sinif: "d-kirmizi" },
  ],
};

export function DavranisDugmeleri({
  ogrenciId,
  sinifId,
  dersId,
  sablon,
}: {
  ogrenciId: string;
  sinifId: string;
  // Aktif ders yoksa null gelir; düğmeler pasif olur.
  dersId: string | null;
  sablon: BehaviorTemplate;
}) {
  const [durum, gonder, bekliyor] = useActionState(davranisKaydiOlustur, BOS_FORM);
  const kapali = dersId === null || bekliyor;

  return (
    <form className="davranis" action={gonder}>
      <input type="hidden" name="ogrenciId" value={ogrenciId} />
      <input type="hidden" name="sinifId" value={sinifId} />
      <input type="hidden" name="dersId" value={dersId ?? ""} />
      {DUGMELER[sablon].map((dugme) => (
        <button
          key={dugme.deger}
          type="submit"
          name="tur"
          value={dugme.deger}
          className={dugme.sinif}
          disabled={kapali}
          aria-label={dugme.etiket}
          title={dugme.etiket}
        >
          {dugme.yazi}
        </button>
      ))}
      {durum.hata && <span className="hata">{durum.hata}</span>}
    </form>
  );
}
