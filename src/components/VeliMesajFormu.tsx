"use client";

import { useState } from "react";
import { veliMesajiOlustur } from "@/app/veli-actions";
import { BOS_FORM } from "@/lib/form-state";
import {
  EN_UZUN_MESAJ,
  mesajGecerliMi,
  whatsappBaglantisi,
  type MesajSablonu,
} from "@/lib/parent-message-rules";

// Şablon yalnızca metni ÖN DOLDURUR; gönderilmeden önce her zaman
// düzenlenebilir. Aynı sınav/ödev formundaki ilkeyle aynı (bkz. SinavFormu).
//
// Form olarak GÖNDERİLMEZ, server action doğrudan çağrılır.
//
// WhatsApp'a giden düğme de gerçek bir DÜĞME değil, `<a href target="_blank">`
// bağlantısıdır. `window.open()` bir tıklamanın içinden çağrılsa bile bazı
// tarayıcılarda popup sayılıp sessizce engellenebiliyor (denendi, engellendi);
// gerçek bir bağlantı tıklaması asla engellenmez. Kayıt, bağlantının kendi
// varsayılan davranışını beklemeden ayrıca (arka planda) yazılır.
export function VeliMesajFormu({
  ogrenciId,
  parentPhone,
  sablonlar,
}: {
  ogrenciId: string;
  parentPhone: string | null;
  sablonlar: MesajSablonu[];
}) {
  const [mesaj, setMesaj] = useState("");
  const [seciliSablon, setSeciliSablon] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  function sablonUygula(sablon: MesajSablonu) {
    setSeciliSablon(sablon.anahtar);
    setMesaj(sablon.metin);
  }

  async function kaydet(durum: "DRAFT" | "SENT") {
    setBekliyor(true);
    setHata(null);
    const veri = new FormData();
    veri.set("ogrenciId", ogrenciId);
    veri.set("mesaj", mesaj);
    veri.set("durum", durum);
    const sonuc = await veliMesajiOlustur(BOS_FORM, veri);
    setBekliyor(false);
    if (sonuc.hata) {
      setHata(sonuc.hata);
      return;
    }
    setMesaj("");
    setSeciliSablon(null);
  }

  function whatsappTiklandi() {
    void kaydet("SENT");
  }

  function kopyalaVeIsaretle() {
    navigator.clipboard?.writeText(mesaj).catch(() => {});
    void kaydet("SENT");
  }

  const gecerli = mesajGecerliMi(mesaj);
  const baglanti = whatsappBaglantisi(parentPhone, mesaj);
  const whatsappDevreDisi = bekliyor || !gecerli || !baglanti;

  return (
    <div className="form">
      <div className="alan">
        <span className="alan-etiket">Hazır şablon</span>
        <div className="veli-sablon-satiri">
          {sablonlar.map((sablon) => (
            <button
              key={sablon.anahtar}
              type="button"
              className={`veli-sablon${seciliSablon === sablon.anahtar ? " secili" : ""}`}
              onClick={() => sablonUygula(sablon)}
            >
              {sablon.ad}
            </button>
          ))}
        </div>
      </div>

      <label className="alan">
        <span className="alan-etiket">Mesaj</span>
        <textarea
          value={mesaj}
          onChange={(e) => setMesaj(e.target.value)}
          rows={5}
          maxLength={EN_UZUN_MESAJ}
          placeholder="Yukarıdan bir şablon seçin ya da doğrudan yazın…"
        />
        <span className="soluk alan-not">
          {mesaj.length} / {EN_UZUN_MESAJ}
        </span>
      </label>

      <div className="veli-gonder-satiri">
        <a
          href={whatsappDevreDisi ? undefined : (baglanti ?? undefined)}
          target="_blank"
          rel="noopener"
          aria-disabled={whatsappDevreDisi}
          tabIndex={whatsappDevreDisi ? -1 : 0}
          className={`veli-buton-baglanti${whatsappDevreDisi ? " devre-disi" : ""}`}
          onClick={() => {
            if (!whatsappDevreDisi) whatsappTiklandi();
          }}
          title={baglanti ? undefined : "Veli telefonu girilmemiş ya da çözülemedi"}
        >
          {bekliyor ? "Gönderiliyor…" : "WhatsApp'ta gönder"}
        </a>
        <button type="button" disabled={bekliyor || !gecerli} onClick={kopyalaVeIsaretle}>
          Kopyala ve gönderildi işaretle
        </button>
        <button
          type="button"
          className="veli-taslak-dugmesi"
          disabled={bekliyor || !gecerli}
          onClick={() => kaydet("DRAFT")}
        >
          Taslak olarak kaydet
        </button>
      </div>

      {hata && <p className="hata">{hata}</p>}
    </div>
  );
}
