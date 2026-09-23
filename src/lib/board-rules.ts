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
