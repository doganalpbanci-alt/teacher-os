import type { BehaviorType } from "@prisma/client";

// Tahtanın dikkat çekici sesi. Dosya indirilmez: her olay türü kare dalga
// (8-bit tınının kaynağı) ile üretilen kendi kısa nota dizisine sahiptir.
// Yıldız/artı yükselir (olumlu), kartlar düşer (uyarı) — kulakla ayrılsın diye.

const NOTALAR: Partial<Record<BehaviorType, number[]>> = {
  PLUS: [523.25, 659.25, 783.99], // yükselen üçlü (C5-E5-G5)
  MINUS: [293.66], // tek kısa, alçak bip
  YELLOW_CARD: [440, 440], // iki orta bip
  RED_CARD: [392, 293.66, 220], // alçalan uğultu
};

const NOTA_SURESI = 0.09;
const NOTA_ARASI = 0.02;
const KAZANC = 0.2;

/** Bir olayın sesini `ctx` üzerinde çalar. `ctx` kullanıcı dokunuşuyla açılmış olmalı. */
export function sesCal(ctx: AudioContext, tur: BehaviorType): void {
  const notalar = NOTALAR[tur];
  if (!notalar) return;

  notalar.forEach((frekans, i) => {
    const baslangic = ctx.currentTime + i * (NOTA_SURESI + NOTA_ARASI);
    const osilator = ctx.createOscillator();
    const kazanc = ctx.createGain();

    osilator.type = "square";
    osilator.frequency.setValueAtTime(frekans, baslangic);

    // Ani başlayıp ani biten ses "tık" sesi çıkarır; kısa bir zarf bunu önler.
    kazanc.gain.setValueAtTime(0, baslangic);
    kazanc.gain.linearRampToValueAtTime(KAZANC, baslangic + 0.01);
    kazanc.gain.linearRampToValueAtTime(0, baslangic + NOTA_SURESI);

    osilator.connect(kazanc).connect(ctx.destination);
    osilator.start(baslangic);
    osilator.stop(baslangic + NOTA_SURESI);
  });
}
