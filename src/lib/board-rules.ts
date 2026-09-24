import type { BehaviorTemplate, BehaviorType } from "@prisma/client";
import { OLAY_GORUNUMU } from "./behavior-rules";

// Tahta bildiriminin veritabanına da tarayıcıya da dokunmayan kısmı: metin
// ve ekranda kalma süresi. Tarayıcıya dokunan katman `board-notification.ts`.
// `behavior-rules` / `behavior` ile aynı ayrım -- karar burada, ikisi ayrı
// test edilir.

export type BildirimMetni = { baslik: string; govde: string };

/**
 * Bildirimin metni. Şablona bağlıdır: aynı kayıt basit sistemde "eksi aldı",
 * kart sisteminde "kırmızı kart aldı" diye okunur (`OLAY_GORUNUMU`).
 * Şablonda karşılığı olmayan tür (ör. basit sistemde sarı kart) bildirim
 * üretmez -- uydurulmuş bir etiket göstermektense hiç göstermemek doğru.
 */
export function bildirimMetni(
  tur: BehaviorType,
  ogrenciAdi: string,
  sablon: BehaviorTemplate,
): BildirimMetni | null {
  const gorunum = OLAY_GORUNUMU[sablon][tur];
  if (!gorunum) return null;
  // Simge başlıkta: bildirim listesinde metin kısalsa bile renk/şekil kalır.
  return { baslik: `${gorunum.yazi} ${ogrenciAdi}`, govde: gorunum.etiket };
}

/**
 * Bildirimin ekranda kalma süresi, OLAY TÜRÜNE GÖRE.
 *
 * Hepsi aynı sürede kaybolmamalı: yıldız sık verilir ve olumludur, çabuk
 * geçsin; kart ise sınıfın GÖRMESİ için verilir. Öğretmenin kızmak yerine
 * "kart işlettiği" an bu -- kart yazısı 2.5 saniyede kaybolursa o an
 * kaçırılır, sesi duyup başını kaldıran öğrenci boş ekran görür.
 *
 * Kırmızı en uzun durur: en ağır sonuç (teneffüs cezası) ona bağlı.
 */
export const BILDIRIM_SURESI_MS: Record<BehaviorType, number> = {
  PLUS: 2500,
  MINUS: 5000,
  YELLOW_CARD: 8000,
  RED_CARD: 10000,
};

/**
 * Sırada bu kadar olay beklerken uzun süre gösterilmez. Tek tek 10 saniye
 * beklenirse tahta gerçeğin gerisinde kalır: öğretmen üç kart üst üste
 * verdiğinde sonuncusu yarım dakika sonra görünürdü. Sıra birikince en kısa
 * süreye düşülür, ekran gerçeğe yetişir.
 */
export const SIRA_BASKISI_ESIGI = 2;

export function bildirimSuresi(tur: BehaviorType, siradaBekleyen: number): number {
  const sure = BILDIRIM_SURESI_MS[tur];
  if (siradaBekleyen >= SIRA_BASKISI_ESIGI) return Math.min(sure, BILDIRIM_SURESI_MS.PLUS);
  return sure;
}

/**
 * Chrome, `requireInteraction` verilmemiş bir bildirimi ~8 saniye sonra
 * kendiliğinden bildirim merkezine indirir. Bundan uzun göstermek istediğimiz
 * türlerde bayrak açılır; kapatma kararı yine bizde kalır. Açılmasaydı kart
 * bildirimi istediğimizden erken kaybolurdu.
 */
export const CHROME_KENDILIGINDEN_KAPATMA_MS = 8000;

export function ekranaSabitlenmeli(sureMs: number): boolean {
  return sureMs > CHROME_KENDILIGINDEN_KAPATMA_MS;
}

/**
 * Bildirim büyük mü gösterilir.
 *
 * Süre kuralının aynısı, boyut tarafı: yıldız rutindir ve sık verilir, ekranı
 * kaplamasın; olumsuz olay (eksi, sarı, kırmızı) ise SINIFIN GÖRMESİ için
 * verilir -- arka sıranın okuyamadığı bir kutu caydırıcı olmaz.
 */
export function buyukGosterilir(tur: BehaviorType): boolean {
  return tur !== "PLUS";
}

/**
 * Tahta penceresinin (PiP) renkleri. Sayfa içi kutu hep koyu; orada renk
 * satırın kendisinden ve simgeden okunuyor. PiP penceresi ise küçük ve
 * tek başına duruyor -- uzaktan bakan biri yazıyı okuyamadan RENKTEN
 * anlamalı. Bu yüzden ayrı bir eşleme.
 *
 * Renkler burada elle yazılı, CSS değişkeni değil: PiP ayrı bir doküman,
 * sayfanın `:root` değişkenleri oraya geçmiyor.
 *
 * RENK TEK BAŞINA ANLAM TAŞIMAZ: pencerede her zaman "kırmızı kart aldı"
 * gibi bir etiket de yazıyor. Renk onu pekiştirir, yerine geçmez -- renk
 * körü bir öğretmen ya da solmuş bir projeksiyon için bu şart.
 *
 * Yeşil bilerek #16a34a; daha koyu bir yeşil (#15803d) kırmızıyla NEREDEYSE
 * AYNI parlaklıkta çıkıyor (1.04:1) ve ikisi gri tonda ayırt edilemiyordu.
 * Kural testi her rengin yazısıyla kontrastını ölçüyor; koyultmak istersen
 * oradan geçmesi gerekir.
 */
export type PipRengi = { zemin: string; yazi: string };

export const PIP_RENGI: Record<BehaviorType, PipRengi> = {
  PLUS: { zemin: "#16a34a", yazi: "#ffffff" },
  MINUS: { zemin: "#b45309", yazi: "#ffffff" },
  YELLOW_CARD: { zemin: "#facc15", yazi: "#1c1917" },
  RED_CARD: { zemin: "#dc2626", yazi: "#ffffff" },
};

/** Olay yokken pencerenin sakin hali. */
export const PIP_BOS_RENGI: PipRengi = { zemin: "#1c1917", yazi: "#fafaf9" };
