"use client";

import { useRouter } from "next/navigation";
import type { Donem } from "@/lib/exam-rules";
import { donemAnahtari } from "@/lib/exam-rules";

// Rapordaki dönem seçici. Seçim adres çubuğunda taşınır (`?donem=2025-1`):
// öğretmen raporu o hâliyle yer imlerine ekleyebilsin ve yazdırdığı şeyin
// adresi aynı raporu geri getirsin.
//
// Yazdırmada gizlenir (`yazdirma-gizle`): kağıda düşen belgede bir açılır
// liste anlamsızdır, üstelik hangi dönemin seçili olduğu başlıkta zaten yazar.

export function RaporDonemSecici({
  ogrenciId,
  donemler,
  secilen,
}: {
  ogrenciId: string;
  donemler: Donem[];
  secilen: Donem;
}) {
  const router = useRouter();

  // Tek dönem varsa seçecek bir şey yok.
  if (donemler.length < 2) return null;

  return (
    <label className="rapor-donem-secici yazdirma-gizle">
      <span className="soluk">Dönem</span>
      <select
        value={donemAnahtari(secilen)}
        onChange={(olay) => {
          router.push(`/ogrenci/${ogrenciId}/rapor?donem=${olay.target.value}`);
        }}
      >
        {donemler.map((donem) => (
          <option key={donemAnahtari(donem)} value={donemAnahtari(donem)}>
            {donem.etiket}
          </option>
        ))}
      </select>
    </label>
  );
}
