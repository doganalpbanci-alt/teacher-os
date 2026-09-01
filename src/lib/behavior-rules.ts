import type { BehaviorTemplate, BehaviorType } from "@prisma/client";

// Şablon kurallarının veritabanına dokunmayan kısmı. Ekran, düğmeye basıldığı
// anda sonucu göstermek için aynı kuralı kullanır; kural iki yere kopyalanmaz.
// Kaydı yazan taraf `behavior.ts`, gösteren taraf `OgrenciSatiri`.

// Kart şablonunun puan sabitleri. Basit şablonda kayıtlar performans notunu
// değiştirmez; not öğretmen tarafından elle girilir.
export const BASLANGIC_PUANI = 90;
export const PLUS_PUAN = 1;
export const MINUS_PUAN = -5;
// Kartların kendisi puan taşımaz; ceza ayrı MINUS kaydıyla verilir.
export const KART_PUAN = 0;
// Basit şablonda her kayıt nötrdür.
export const NOTR_PUAN = 0;

// Basit şablonda artı/eksi; kart şablonunda yıldız ve doğrudan kartlar.
export type Eylem = "PLUS" | "MINUS" | "SARI_KART" | "KIRMIZI_KART";
export type KartDurumu = "SARI" | "KIRMIZI";

export const SABLON_EYLEMLERI: Record<BehaviorTemplate, readonly Eylem[]> = {
  SIMPLE: ["PLUS", "MINUS"],
  CARD: ["PLUS", "SARI_KART", "KIRMIZI_KART"],
};

export function eylemGecerliMi(sablon: BehaviorTemplate, eylem: string): eylem is Eylem {
  return (SABLON_EYLEMLERI[sablon] as readonly string[]).includes(eylem);
}

/**
 * Bir öğrencinin ders ekranındaki satırında görünen durum. Performans puanı
 * burada yoktur: ders sırasında karar kartlara ve sayılara göre verilir,
 * puan öğrenci sayfasında okunur.
 */
export type SatirDurumu = {
  kart?: KartDurumu;
  arti: number;
  eksi: number;
};

/**
 * Bir eylemin satırda görünen sonucu. Sunucudaki kayıt da aynı kuralı izler:
 * sarı üstüne sarı kırmızıdır.
 *
 * Teneffüs cezası burada hesaplanmaz: süresi öğrencinin geçmiş derslerine
 * bağlıdır, ekran onu bilemez. Ceza rozeti sunucudan gelir.
 */
export function eylemiUygula(
  durum: SatirDurumu,
  eylem: Eylem,
  sablon: BehaviorTemplate,
): SatirDurumu {
  if (sablon === "SIMPLE") {
    // Basit şablonda not elle girilir; sayılar artar, puan durur.
    return eylem === "PLUS"
      ? { ...durum, arti: durum.arti + 1 }
      : { ...durum, eksi: durum.eksi + 1 };
  }

  if (eylem === "PLUS") return { ...durum, arti: durum.arti + 1 };

  // Sarı üstüne sarı kırmızı demektir: derste zaten kart varsa yükselir.
  const kirmizi = eylem === "KIRMIZI_KART" || durum.kart !== undefined;
  if (!kirmizi) return { ...durum, kart: "SARI" };

  return { ...durum, kart: "KIRMIZI", eksi: durum.eksi + 1 };
}

/**
 * Tahtanın canlı bildiriminde bir kaydın nasıl görüneceği: simge ve etiket.
 * Ders ekranındaki düğme simgeleriyle aynı fikri taşır ama ayrı bir amaca
 * hizmet eder (buton değil, bildirim), o yüzden ayrı tutulur.
 */
export const OLAY_GORUNUMU: Record<
  BehaviorTemplate,
  Partial<Record<BehaviorType, { yazi: string; etiket: string }>>
> = {
  SIMPLE: {
    PLUS: { yazi: "+", etiket: "artı aldı" },
    MINUS: { yazi: "−", etiket: "eksi aldı" },
  },
  CARD: {
    PLUS: { yazi: "★", etiket: "yıldız aldı" },
    YELLOW_CARD: { yazi: "🟨", etiket: "sarı kart aldı" },
    RED_CARD: { yazi: "🟥", etiket: "kırmızı kart aldı" },
  },
};
