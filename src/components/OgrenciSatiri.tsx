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

// Kart, satırın solundaki renkli şeritle gösterilir. Düğmeler de renkli
// olduğu için "sahip olunan kart" ile "verilecek kart" birbirine benzemesin
// diye ikisi ayrı biçimde durur. Yazı ekran okuyucular ve testler için.
const KART_ETIKETI: Record<KartDurumu, string> = {
  SARI: "Sarı kart",
  KIRMIZI: "Kırmızı kart",
};

export type CezaOzeti = { id: string; kalanSaniye: number; calisiyor: boolean };

/**
 * Bir öğrencinin ders ekranındaki satırı.
 *
 * Kayıt sunucuda yazılır ve sayfa tazelenir; bu bir gidiş dönüş sürer.
 * Öğretmen o sırada ekranda hiçbir değişiklik görmezse aynı düğmeye tekrar
 * basar. Bu yüzden sonuç, kural modülünden hesaplanıp basılır basılmaz
 * gösterilir; sunucudan gerçek değerler gelince onların üzerine yazılır.
 *
 * Performans puanı burada yoktur; öğrenci sayfasında görülür. Teneffüs
 * cezası da iyimser gösterilmez: süresi öğrencinin geçmiş derslerine
 * bağlıdır, ekran onu bilemez.
 */
export function OgrenciSatiri({
  ogrenciId,
  ad,
  sinifId,
  dersId,
  sablon,
  kart,
  arti,
  eksi,
  ceza,
  kilitli = false,
}: {
  ogrenciId: string;
  ad: string;
  sinifId: string;
  dersId: string | null;
  sablon: BehaviorTemplate;
  kart?: KartDurumu;
  arti: number;
  eksi: number;
  ceza?: CezaOzeti;
  /** Tahta kilitli: satırdaki hiçbir düğme kayıt yazmaz. */
  kilitli?: boolean;
}) {
  const sunucudan: SatirDurumu = { kart, arti, eksi };
  const [gorunen, iyimserUygula] = useOptimistic(
    sunucudan,
    (durum: SatirDurumu, eylem: Eylem) => eylemiUygula(durum, eylem, sablon),
  );

  const kartSistemi = sablon === "CARD";

  return (
    <div
      className={`ogrenci${gorunen.kart ? ` kart-${gorunen.kart === "SARI" ? "sari" : "kirmizi"}` : ""}`}
    >
      {/* Ceza rozeti adın altında durur: dar ekranda yan yana konsaydı ada
          yer kalmaz ve isim kısalırdı. */}
      <span className="ogrenci-sol">
        <Link className="ogrenci-ad" href={`/ogrenci/${ogrenciId}`}>
          {ad}
          {gorunen.kart && (
            <span className="gorunmez"> {KART_ETIKETI[gorunen.kart]}</span>
          )}
        </Link>
        {ceza && (
          <CezaKontrolu
            cezaId={ceza.id}
            sinifId={sinifId}
            kalanSaniye={ceza.kalanSaniye}
            calisiyor={ceza.calisiyor}
            kilitli={kilitli}
          />
        )}
      </span>

      <span className="ogrenci-sag">
        {!kartSistemi && (
          <span className="rozet">
            {gorunen.arti} artı · {gorunen.eksi} eksi
          </span>
        )}
        <DavranisDugmeleri
          ogrenciId={ogrenciId}
          sinifId={sinifId}
          dersId={dersId}
          sablon={sablon}
          kilitli={kilitli}
          onIyimser={kilitli ? undefined : iyimserUygula}
        />
      </span>
    </div>
  );
}
