"use client";

import { useActionState, useState } from "react";
import { odevKaydet, odevDuzenlemesiKaydet } from "@/app/odev-actions";
import { BOS_FORM } from "@/lib/form-state";
import type { HedefSinif } from "@/lib/assignment";
import { HedefSecici } from "@/components/HedefSecici";

// Oluşturma ve düzenleme aynı formu kullanır: alanlar birebir aynı, değişen
// yalnızca hangi action'a gittiği ve düzenlemede kaç kaydın kaybolacağı.

export type OdevBaslangici = {
  title: string;
  description: string;
  startDate: string;
  dueDate: string;
};

export function OdevFormu({
  siniflar,
  baslangic,
  odevId,
  seciliIdler,
  isaretliIdler,
}: {
  siniflar: HedefSinif[];
  baslangic: OdevBaslangici;
  /** Doluysa düzenleme, boşsa yeni ödev. */
  odevId?: string;
  seciliIdler: string[];
  isaretliIdler: string[];
}) {
  const duzenleme = odevId !== undefined;
  const [durum, gonder, bekliyor] = useActionState(
    duzenleme ? odevDuzenlemesiKaydet : odevKaydet,
    BOS_FORM,
  );
  const [secili, setSecili] = useState<Set<string>>(() => new Set(seciliIdler));

  const isaretliKume = new Set(isaretliIdler);
  const kaybolacak = isaretliIdler.filter((id) => !secili.has(id)).length;

  return (
    <form className="form odev-formu" action={gonder}>
      {duzenleme && <input type="hidden" name="odevId" value={odevId} />}

      <label className="alan">
        <span className="alan-etiket">Ödev başlığı</span>
        <input
          name="title"
          defaultValue={durum.degerler.title ?? baslangic.title}
          placeholder="örn. Unit 4 workbook"
          maxLength={120}
          autoComplete="off"
        />
      </label>

      <label className="alan">
        <span className="alan-etiket">Ödev içeriği ve açıklama</span>
        <textarea
          name="description"
          defaultValue={durum.degerler.description ?? baslangic.description}
          placeholder="Yapılacaklar, sayfa numaraları, öğrenciye not…"
          maxLength={2000}
          rows={5}
        />
      </label>

      {/* Geçmiş tarih serbest: geriye dönük ödev girilebilmeli. */}
      <div className="ikili">
        <label className="alan">
          <span className="alan-etiket">Başlangıç tarihi</span>
          <input
            type="date"
            name="startDate"
            defaultValue={durum.degerler.startDate ?? baslangic.startDate}
          />
        </label>
        <label className="alan">
          <span className="alan-etiket">Son teslim tarihi</span>
          <input
            type="date"
            name="dueDate"
            defaultValue={durum.degerler.dueDate ?? baslangic.dueDate}
          />
        </label>
      </div>

      <div className="alan">
        <span className="alan-etiket">
          Kimlere verilecek <span className="rozet">{secili.size} öğrenci</span>
        </span>
        <HedefSecici
          siniflar={siniflar}
          secili={secili}
          onDegis={setSecili}
          isaretliIdler={isaretliKume}
        />
      </div>

      {kaybolacak > 0 && (
        <p className="uyari">
          {kaybolacak} öğrenci işaretlenmiş olduğu hâlde seçimden çıkarıldı.
          Kaydedilirse teslim kayıtları silinecek.
        </p>
      )}

      <button type="submit" disabled={bekliyor || secili.size === 0}>
        {bekliyor ? "Kaydediliyor…" : duzenleme ? "Değişiklikleri kaydet" : "Ödevi ver"}
      </button>
      {durum.hata && <p className="hata">{durum.hata}</p>}
    </form>
  );
}
