// EXP kurallarının veritabanına dokunmayan kısmı: kazanma miktarları ve
// seviye formülü. Kayıt katmanı (`exp.ts`) bunu kullanır; ekran da
// önizleme için doğrudan buradan okur — behavior-rules ile aynı ayrım.
//
// EXP performans notundan tamamen bağımsızdır: yalnızca artar, kırmızı kart
// gibi olumsuz bir olay EXP'yi hiç etkilemez.

export const YILDIZ_EXP = 10;
export const ODEV_TAMAMLANDI_EXP = 20;
export const ODEV_GEC_TAMAMLANDI_EXP = 10;

export type SeviyeDurumu = {
  seviye: number;
  buSeviyedeKazanilan: number;
  sonrakiSeviyeIcinGereken: number;
  yuzde: number;
};

/**
 * Artan eşikli seviye formülü: N. seviyeden N+1'e geçmek için gereken EXP
 * her seferinde 20 artar (1→2: 20, 2→3: 40, 3→4: 60...). Yani L. seviyeye
 * ulaşmak için toplam gereken EXP = 10 × L × (L-1). Seviye 1'de herkes 0
 * EXP ile başlar.
 */
export function seviyeHesapla(expTotal: number): SeviyeDurumu {
  let seviye = 1;
  let esikBu = 0;

  for (;;) {
    const sonrakiIcinGereken = 20 * seviye;
    const esikSonraki = esikBu + sonrakiIcinGereken;
    if (expTotal < esikSonraki) {
      const buSeviyedeKazanilan = expTotal - esikBu;
      return {
        seviye,
        buSeviyedeKazanilan,
        sonrakiSeviyeIcinGereken: sonrakiIcinGereken,
        yuzde: Math.min(100, Math.round((buSeviyedeKazanilan / sonrakiIcinGereken) * 100)),
      };
    }
    esikBu = esikSonraki;
    seviye++;
  }
}
