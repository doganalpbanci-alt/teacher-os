// Veli mesajının veritabanına dokunmayan kısmı: telefon numarasını WhatsApp'ın
// beklediği biçime çevirme, bağlantı kurma, uzunluk kuralı ve şablon
// metinleri. Kayıt katmanı (`parent-message.ts`) bunu kullanır; bileşenler de
// (bağlantıyı kurmak, önizlemek için) doğrudan buradan okur — behavior-rules
// ve exam-rules ile aynı ayrım.

export const EN_UZUN_MESAJ = 1000;

export function mesajGecerliMi(mesaj: string): boolean {
  const kirpilmis = mesaj.trim();
  return kirpilmis.length > 0 && mesaj.length <= EN_UZUN_MESAJ;
}

/**
 * Serbest yazılmış bir telefon numarasını WhatsApp'ın istediğe ülke koduyla
 * başlayan, yalnızca rakamlardan oluşan biçime çevirir. Çözemezse null
 * döner — o zaman WhatsApp bağlantısı kurulmaz, yalnızca kopyalama kalır.
 *
 * Yalnızca Türkiye numaralarını bilir: "0555 123 45 67", "555 123 45 67",
 * "+90 555 123 45 67" gibi yaygın yazımların hepsi aynı sonuca gider.
 */
export function telefonuUluslararasiyaCevir(ham: string): string | null {
  const rakamlar = ham.replace(/[^\d]/g, "");

  if (rakamlar.startsWith("90") && rakamlar.length === 12) return rakamlar;
  if (rakamlar.startsWith("0") && rakamlar.length === 11) return `90${rakamlar.slice(1)}`;
  if (rakamlar.length === 10) return `90${rakamlar}`;
  return null;
}

/** `wa.me` bağlantısı. Telefon çözülemezse (ya da yoksa) null döner. */
export function whatsappBaglantisi(
  parentPhone: string | null,
  mesaj: string,
): string | null {
  if (!parentPhone) return null;
  const uluslararasi = telefonuUluslararasiyaCevir(parentPhone);
  if (!uluslararasi) return null;
  return `https://wa.me/${uluslararasi}?text=${encodeURIComponent(mesaj)}`;
}

export type SablonGirdisi = {
  ogrenciAdi: string;
  veliAdi: string | null;
  kartSistemi: boolean;
  ozet: { arti: number; eksi: number; sariKart: number; kirmiziKart: number };
  odevOzeti: { toplam: number; oran: number; done: number; late: number };
  sonSinav: { baslik: string; puan: number; maxScore: number; yuzde: number } | null;
};

export type MesajSablonu = { anahtar: string; ad: string; metin: string };

function selamlama(veliAdi: string | null): string {
  return veliAdi ? `Merhaba ${veliAdi},` : "Merhaba,";
}

/**
 * Hazır şablonlar, öğrencinin gerçek verisiyle doldurulmuş. Veri yoksa
 * (henüz ödev/sınav yoksa) o şablon hiç önerilmez — boş bir istatistik
 * yanıltıcı olurdu.
 */
export function mesajSablonlari(girdi: SablonGirdisi): MesajSablonu[] {
  const sablonlar: MesajSablonu[] = [
    {
      anahtar: "davranis",
      ad: "Davranış özeti",
      metin: girdi.kartSistemi
        ? `${selamlama(girdi.veliAdi)} ${girdi.ogrenciAdi} şu ana kadar ${girdi.ozet.arti} yıldız, ${girdi.ozet.sariKart} sarı kart ve ${girdi.ozet.kirmiziKart} kırmızı kart aldı.`
        : `${selamlama(girdi.veliAdi)} ${girdi.ogrenciAdi} şu ana kadar ${girdi.ozet.arti} artı ve ${girdi.ozet.eksi} eksi aldı.`,
    },
  ];

  if (girdi.odevOzeti.toplam > 0) {
    sablonlar.push({
      anahtar: "odev",
      ad: "Ödev durumu",
      metin: `${selamlama(girdi.veliAdi)} ${girdi.ogrenciAdi}'in ödev tamamlama oranı %${girdi.odevOzeti.oran} (${girdi.odevOzeti.done + girdi.odevOzeti.late}/${girdi.odevOzeti.toplam}).`,
    });
  }

  if (girdi.sonSinav) {
    sablonlar.push({
      anahtar: "sinav",
      ad: "Son sınav",
      metin: `${selamlama(girdi.veliAdi)} ${girdi.ogrenciAdi}'in "${girdi.sonSinav.baslik}" sınavı: ${girdi.sonSinav.puan}/${girdi.sonSinav.maxScore} (%${girdi.sonSinav.yuzde}).`,
    });
  }

  sablonlar.push({ anahtar: "serbest", ad: "Serbest", metin: "" });

  return sablonlar;
}
