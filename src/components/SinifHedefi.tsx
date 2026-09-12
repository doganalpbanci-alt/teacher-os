"use client";

import { useActionState } from "react";
import { sinifHedefiOlustur, sinifHedefiKapat } from "@/app/actions";
import { BOS_FORM } from "@/lib/form-state";
import { EN_BUYUK_HEDEF, EN_KUCUK_HEDEF, EN_UZUN_ODUL } from "@/lib/class-goal-rules";
import type { GecmisHedef, HedefDurumu } from "@/lib/class-goal";

/**
 * Sınıf hedefi: toplu bir eşiğe ulaşınca verilecek ödül. İlerleme ekranda
 * yalnızca gösterilir, hesabı sunucudadır (`class-goal.ts`) — gerçek kaynak
 * BehaviorLog, bu bileşen ona dokunmaz.
 */
export function SinifHedefi({
  sinifId,
  acikHedef,
  gecmis,
}: {
  sinifId: string;
  acikHedef: HedefDurumu | null;
  gecmis: GecmisHedef[];
}) {
  return (
    <div className="hedef-blogu">
      {acikHedef ? (
        <AcikHedef sinifId={sinifId} hedef={acikHedef} />
      ) : (
        <YeniHedefFormu sinifId={sinifId} />
      )}

      {gecmis.length > 0 && (
        <details className="katlanir">
          <summary>Geçmiş hedefler ({gecmis.length})</summary>
          <ul className="liste">
            {gecmis.map((h) => (
              <li key={h.id} className="satir">
                <span className="satir-ad">{h.reward}</span>
                <span className="soluk">
                  {h.sayim}/{h.target}
                  {h.tamamlandi ? " · tamamlandı" : " · kapatıldı"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function AcikHedef({ sinifId, hedef }: { sinifId: string; hedef: HedefDurumu }) {
  const [durum, gonder, bekliyor] = useActionState(sinifHedefiKapat, BOS_FORM);

  return (
    <div className="hedef-kart">
      <div className="hedef-basligi">
        <strong>{hedef.reward}</strong>
        <span className="soluk">
          {hedef.sayim}/{hedef.target}
        </span>
      </div>
      <div className="hedef-cubugu">
        <div
          className="hedef-cubugu-dolu"
          style={{ width: `${hedef.yuzde}%` }}
        />
      </div>
      {hedef.tamamlandi && <p className="basari">Hedefe ulaşıldı! 🎉</p>}

      <form action={gonder}>
        <input type="hidden" name="hedefId" value={hedef.id} />
        <input type="hidden" name="sinifId" value={sinifId} />
        <button type="submit" className="ders-dugme" disabled={bekliyor}>
          {hedef.tamamlandi ? "Ödülü verdim, hedefi kapat" : "Hedefi kapat"}
        </button>
      </form>
      {durum.hata && <p className="hata">{durum.hata}</p>}
    </div>
  );
}

function YeniHedefFormu({ sinifId }: { sinifId: string }) {
  const [durum, gonder, bekliyor] = useActionState(sinifHedefiOlustur, BOS_FORM);

  return (
    <form className="form" action={gonder}>
      <input type="hidden" name="sinifId" value={sinifId} />

      <div className="ikili">
        <label className="alan">
          <span className="alan-etiket">Hedef (yıldız/artı sayısı)</span>
          <input
            name="target"
            type="number"
            inputMode="numeric"
            min={EN_KUCUK_HEDEF}
            max={EN_BUYUK_HEDEF}
            step={1}
            defaultValue={durum.degerler.target ?? ""}
          />
        </label>

        <label className="alan">
          <span className="alan-etiket">Ödül</span>
          <input
            name="reward"
            type="text"
            maxLength={EN_UZUN_ODUL}
            placeholder="Örn. Film günü"
            defaultValue={durum.degerler.reward ?? ""}
          />
        </label>
      </div>

      <button type="submit" disabled={bekliyor}>
        {bekliyor ? "Kaydediliyor…" : "Hedef belirle"}
      </button>
      {durum.hata && <p className="hata">{durum.hata}</p>}
    </form>
  );
}
