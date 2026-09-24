"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { BehaviorTemplate, BehaviorType } from "@prisma/client";
import { OLAY_GORUNUMU } from "@/lib/behavior-rules";
import { PIP_BOS_RENGI, PIP_RENGI } from "@/lib/board-rules";

// PiP penceresinin İÇERİĞİ. Pencerenin kendisini `board-pip.ts` açar;
// burası yalnızca ne görüneceğini söyler.
//
// `createPortal` ile BAŞKA BİR DOKÜMANA render ediliyor. React bunu yapabilir;
// önemli olan stilin o dokümanda olması (`board-pip.ts` içindeki STIL) --
// sayfanın CSS'i oraya geçmez.

export type PipOlayi = { tur: BehaviorType; ogrenciAdi: string };

export function TahtaPenceresi({
  pencere,
  olay,
  sablon,
  sinifAdi,
  dersYazisi,
}: {
  pencere: Window;
  /** Gösterilecek olay; yoksa pencere sakin halinde durur. */
  olay: PipOlayi | null;
  sablon: BehaviorTemplate;
  sinifAdi: string;
  dersYazisi: string;
}) {
  const gorunum = olay ? OLAY_GORUNUMU[sablon][olay.tur] : undefined;
  // Şablonda karşılığı olmayan tür (basit sistemde sarı kart) sakin hali
  // bozmaz: uydurulmuş bir etiket göstermektense hiç göstermemek doğru.
  const etkinOlay = olay && gorunum ? olay : null;
  const renk = etkinOlay ? PIP_RENGI[etkinOlay.tur] : PIP_BOS_RENGI;

  // Zemin `body` üzerinde: pencere küçükken bile renk kenardan kenara dolsun,
  // uzaktan bakan biri yazıyı okuyamadan renkten anlasın.
  useEffect(() => {
    pencere.document.body.style.backgroundColor = renk.zemin;
    pencere.document.body.style.color = renk.yazi;
  }, [pencere, renk]);

  return createPortal(
    <div className="pip-kutu">
      {etkinOlay && gorunum ? (
        // SİMGE YOK, bilerek. `OLAY_GORUNUMU`daki 🟥 ve 🟨 emojileri kendi
        // renklerinde geliyor; kırmızı zeminde kırmızı kart, sarı zeminde
        // sarı kart görünmez oluyordu. Burada rengi zaten ZEMİN taşıyor --
        // uzaktan bakan biri yazıyı okumadan renkten anlıyor. Üstelik
        // pencere alçak (240 piksel); simgeyi çıkarmak ada ve etikete
        // daha çok punto bırakıyor.
        <>
          <span className="pip-ad">{etkinOlay.ogrenciAdi}</span>
          <span className="pip-etiket">{gorunum.etiket}</span>
        </>
      ) : (
        <>
          <span className="pip-bos-baslik">{sinifAdi}</span>
          <span className="pip-bos-alt">{dersYazisi}</span>
        </>
      )}
    </div>,
    pencere.document.body,
  );
}
