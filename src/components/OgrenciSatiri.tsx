"use client";

import Link from "next/link";
import { useOptimistic } from "react";
import type { BehaviorTemplate } from "@prisma/client";
import { DavranisDugmeleri } from "@/components/DavranisDugmeleri";
import { CezaKontrolu } from "@/components/CezaKontrolu";
import {
  eylemiUygula,
  type Eylem,
  type KartDurumu,
  type SatirDurumu,
} from "@/lib/behavior-rules";

// Kart isim yanında sembolle gösterilir. Yazı yalnızca ekran okuyucular ve
// testler için, görünmez biçimde durur.
const KART_ETIKETI: Record<KartDurumu, { yazi: string; sinif: string }> = {
  SARI: { yazi: "Sarı kart", sinif: "kart-sari" },
  KIRMIZI: { yazi: "Kırmızı kart", sinif: "kart-kirmizi" },
};

export type CezaOzeti = { id: string; kalanSaniye: number; calisiyor: boolean };

/**
 * Bir öğrencinin sınıf listesindeki satırı.
 *
 * Kayıt sunucuda yazılır ve sayfa tazelenir; bu bir gidiş dönüş sürer.
 * Öğretmen o sırada ekranda hiçbir değişiklik görmezse aynı düğmeye tekrar
 * basar. Bu yüzden sonuç, kural modülünden hesaplanıp basılır basılmaz
 * gösterilir; sunucudan gerçek değerler gelince onların üzerine yazılır.
 *
 * Teneffüs cezası rozeti iyimser gösterilmez: süresi öğrencinin geçmiş
 * derslerine bağlıdır, ekran onu bilemez.
 */
export function OgrenciSatiri({
  ogrenciId,
  ad,
  sinifId,
  dersId,
  sablon,
  puan,
  kart,
  arti,
  eksi,
  ceza,
}: {
  ogrenciId: string;
  ad: string;
  sinifId: string;
  dersId: string | null;
  sablon: BehaviorTemplate;
  puan: number;
  kart?: KartDurumu;
  arti: number;
  eksi: number;
  ceza?: CezaOzeti;
}) {
  const sunucudan: SatirDurumu = { kart, puan, arti, eksi };
  const [gorunen, iyimserUygula] = useOptimistic(
    sunucudan,
    (durum: SatirDurumu, eylem: Eylem) => eylemiUygula(durum, eylem, sablon),
  );

  const kartSistemi = sablon === "CARD";

  return (
    <div className="satir">
      <Link className="satir-ad baglanti" href={`/ogrenci/${ogrenciId}`}>
        {ad}
      </Link>
      <span className="satir-sag">
        {gorunen.kart && (
          <span
            className={`kart-sembol ${KART_ETIKETI[gorunen.kart].sinif}`}
            title={KART_ETIKETI[gorunen.kart].yazi}
          >
            <span className="gorunmez">{KART_ETIKETI[gorunen.kart].yazi}</span>
          </span>
        )}
        {!kartSistemi && (
          <span className="rozet">
            {gorunen.arti} artı · {gorunen.eksi} eksi
          </span>
        )}
        {ceza && (
          <CezaKontrolu
            cezaId={ceza.id}
            sinifId={sinifId}
            kalanSaniye={ceza.kalanSaniye}
            calisiyor={ceza.calisiyor}
          />
        )}
        <span className="rozet">{gorunen.puan} puan</span>
        <DavranisDugmeleri
          ogrenciId={ogrenciId}
          sinifId={sinifId}
          dersId={dersId}
          sablon={sablon}
          onIyimser={iyimserUygula}
        />
      </span>
    </div>
  );
}
