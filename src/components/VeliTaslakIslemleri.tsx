"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { veliMesajiGonderildiIsaretleAction } from "@/app/veli-actions";
import { BOS_FORM } from "@/lib/form-state";
import { whatsappBaglantisi } from "@/lib/parent-message-rules";

// `/veli` listesindeki bir taslağın hızlı işlemleri. Metin burada
// değiştirilmez (yalnızca kaydedilirken yazılır); iki işlem de aynı "artık
// gönderildi" durumuna gider, yalnızca hangi kanaldan ulaştığı öğretmenin
// kendi bileceği bir şeydir.
//
// WhatsApp bağlantısı `window.open()` ile açılan bir düğme DEĞİL, gerçek bir
// `<a href target="_blank">`dir — bkz. VeliMesajFormu'ndaki aynı not.
export function VeliTaslakIslemleri({
  mesajId,
  mesaj,
  parentPhone,
}: {
  mesajId: string;
  mesaj: string;
  parentPhone: string | null;
}) {
  const [bekliyor, setBekliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const router = useRouter();

  async function isaretle() {
    setBekliyor(true);
    setHata(null);
    const veri = new FormData();
    veri.set("mesajId", mesajId);
    const sonuc = await veliMesajiGonderildiIsaretleAction(BOS_FORM, veri);
    setBekliyor(false);
    if (sonuc.hata) {
      setHata(sonuc.hata);
      return;
    }
    // Bu satırın "gönderildi" durumuna geçmesi için sayfa tazelenir; aksi
    // halde liste eski durumu göstermeye devam eder.
    router.refresh();
  }

  function kopyala() {
    navigator.clipboard?.writeText(mesaj).catch(() => {});
    void isaretle();
  }

  const baglanti = whatsappBaglantisi(parentPhone, mesaj);
  const whatsappDevreDisi = bekliyor || !baglanti;

  return (
    <span className="veli-taslak-islemleri">
      <a
        href={whatsappDevreDisi ? undefined : (baglanti ?? undefined)}
        target="_blank"
        rel="noopener"
        aria-disabled={whatsappDevreDisi}
        tabIndex={whatsappDevreDisi ? -1 : 0}
        className={whatsappDevreDisi ? "devre-disi" : ""}
        onClick={() => {
          if (!whatsappDevreDisi) void isaretle();
        }}
        title={baglanti ? "WhatsApp'ta aç ve gönderildi işaretle" : "Veli telefonu girilmemiş"}
      >
        WhatsApp
      </a>
      <button
        type="button"
        disabled={bekliyor}
        onClick={kopyala}
        title="Panoya kopyala ve gönderildi işaretle"
      >
        Kopyala
      </button>
      {hata && <span className="hata">{hata}</span>}
    </span>
  );
}
