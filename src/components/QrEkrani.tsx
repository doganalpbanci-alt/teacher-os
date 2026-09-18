"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Tahtadaki QR ekranının canlı kısmı. QR'ın kendisi sunucuda üretilip SVG
// olarak gelir; burada yalnızca durumu yoklarız.
//
// Yoklama, sınıf ekranındaki canlı yayınla aynı yaklaşım: websocket yok,
// kendi oturumuyla (burada henüz oturum yok) kendi sunucu ucunu yoklar.

const YOKLAMA_ARALIGI_MS = 2000;

declare global {
  interface Window {
    __qrYoklamaSayaci?: number;
  }
}

type Durum = "BEKLIYOR" | "ONAYLANDI" | "KULLANILDI" | "SURESI_DOLDU" | "BULUNAMADI";

export function QrEkrani({ eslesmeId }: { eslesmeId: string }) {
  const router = useRouter();
  const [durum, setDurum] = useState<Durum>("BEKLIYOR");
  // Oturum alma isteği bir kez gitsin: yoklama 2 saniyede bir çalışıyor ve
  // istek sürerken ikinci bir yoklama daha tetiklenebilir. Eşleşme tek
  // kullanımlık olduğu için ikinci istek "geçersiz durum" alır ve ekranda
  // sebepsiz bir hata belirirdi.
  const aliniyor = useRef(false);

  useEffect(() => {
    let durduruldu = false;

    async function yokla() {
      if (durduruldu || aliniyor.current) return;
      if (typeof window !== "undefined") {
        window.__qrYoklamaSayaci = (window.__qrYoklamaSayaci ?? 0) + 1;
      }

      try {
        const yanit = await fetch(`/api/eslestirme/${eslesmeId}`);
        const veri: { durum: Durum } = await yanit.json();
        if (durduruldu) return;
        setDurum(veri.durum);

        if (veri.durum !== "ONAYLANDI") return;

        aliniyor.current = true;
        const alma = await fetch(`/api/eslestirme/${eslesmeId}/al`, { method: "POST" });
        if (alma.ok) {
          // Oturum çerezi yazıldı; sunucu tarafı artık bizi tanıyor.
          router.replace("/");
          router.refresh();
          return;
        }
        aliniyor.current = false;
        setDurum("SURESI_DOLDU");
      } catch {
        // Ağ hatası: bir sonraki yoklamada tekrar denenir.
      }
    }

    const zamanlayici = setInterval(yokla, YOKLAMA_ARALIGI_MS);
    return () => {
      durduruldu = true;
      clearInterval(zamanlayici);
    };
  }, [eslesmeId, router]);

  if (durum === "ONAYLANDI") {
    return <p className="basari qr-durum">Onaylandı, giriş yapılıyor…</p>;
  }
  if (durum === "SURESI_DOLDU" || durum === "BULUNAMADI" || durum === "KULLANILDI") {
    return (
      <p className="uyari qr-durum">
        Bu QR artık geçerli değil. Aşağıdaki düğmeyle yenisini oluşturun.
      </p>
    );
  }
  return (
    <p className="soluk qr-durum" role="status">
      Telefonunuzla okutup onaylamanız bekleniyor…
    </p>
  );
}
