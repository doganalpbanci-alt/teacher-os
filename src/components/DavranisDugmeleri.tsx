"use client";

import { useActionState } from "react";
import type { BehaviorTemplate } from "@prisma/client";
import { davranisKaydiOlustur } from "@/app/actions";
import { BOS_FORM } from "@/lib/form-state";
import { eylemGecerliMi, type Eylem } from "@/lib/behavior-rules";

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
    { deger: "SARI_KART", yazi: "", etiket: "Sarı kart ver", sinif: "d-sari" },
    { deger: "KIRMIZI_KART", yazi: "", etiket: "Kırmızı kart ver", sinif: "d-kirmizi" },
  ],
};

export function DavranisDugmeleri({
  ogrenciId,
  sinifId,
  dersId,
  sablon,
  kilitli = false,
  onIyimser,
}: {
  ogrenciId: string;
  sinifId: string;
  // Aktif ders yoksa null gelir; düğmeler pasif olur.
  dersId: string | null;
  sablon: BehaviorTemplate;
  // Tahta kilitli: düğmeler görünür kalır ama kayıt yazmaz, basılınca PIN
  // sorulur.
  kilitli?: boolean;
  // Basılan eylemin sonucunu sunucuyu beklemeden gösterir. Kaydı yine sunucu
  // yazar; bu yalnızca ekrandaki geri bildirimdir.
  onIyimser?: (eylem: Eylem) => void;
}) {
  // Gönderimler sıraya girer: bir kayıt sürerken basılan ikinci düğme onun
  // bitmesini bekler. Bu bilerek böyle — kart yükselme kuralı "derste kart
  // var mı" sorusuna bakar; iki kayıt aynı anda gitseydi ikisi de "yok"
  // görüp iki sarı kart yazabilirdi. Basış kaybolmaz, sırasını bekler.
  const [durum, gonder] = useActionState(
    async (onceki: typeof BOS_FORM, veri: FormData) => {
      const tur = veri.get("tur");
      // Sunucu da aynı kontrolü yapar; buradaki yalnızca ekranı yanlış
      // güncellememek için.
      if (typeof tur === "string" && eylemGecerliMi(sablon, tur)) onIyimser?.(tur);
      return davranisKaydiOlustur(onceki, veri);
    },
    BOS_FORM,
  );
  // Kayıt sürerken düğmeler pasifleşmez: öğretmen arka arkaya basabilmeli,
  // basışlar sırayla işlenir.
  const kapali = dersId === null;

  return (
    <form className="davranis" action={gonder}>
      <input type="hidden" name="ogrenciId" value={ogrenciId} />
      <input type="hidden" name="sinifId" value={sinifId} />
      <input type="hidden" name="dersId" value={dersId ?? ""} />
      {DUGMELER[sablon].map((dugme) => (
        // Kilitliyken `disabled` KULLANILMAZ: tarayıcı disabled düğmede
        // tıklama olayı üretmez, basış hiçbir şey yapmazdı. Düğme görünür
        // ve basılabilir kalır, yalnızca gönderim yerine PIN sorar.
        <button
          key={dugme.deger}
          type={kilitli ? "button" : "submit"}
          name="tur"
          value={dugme.deger}
          className={`${dugme.sinif}${kilitli ? " kilitli" : ""}`}
          disabled={!kilitli && kapali}
          data-kilit-ac={kilitli ? "" : undefined}
          aria-label={kilitli ? `${dugme.etiket} (kilitli)` : dugme.etiket}
          title={kilitli ? `${dugme.etiket} — tahta kilitli` : dugme.etiket}
        >
          {dugme.yazi}
        </button>
      ))}
      {durum.hata && <span className="hata">{durum.hata}</span>}
    </form>
  );
}
