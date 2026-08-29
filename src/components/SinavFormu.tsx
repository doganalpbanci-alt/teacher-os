"use client";

import { useActionState, useState } from "react";
import type { ExamScope } from "@prisma/client";
import { sinavKaydet, sinavDuzenlemesiKaydet } from "@/app/sinav-actions";
import { BOS_FORM } from "@/lib/form-state";
import {
  AGIRLIK_TOPLAMI,
  SINAV_SABLONLARI,
  agirlikToplami,
  type BilesenSatiri,
} from "@/lib/exam-rules";
// Ödev ve sınav aynı "kime verilecek" seçimini yapar; seçici ve seçenek tipi
// ortaktır, ikinci bir kopya çıkarılmaz.
import type { HedefSinif } from "@/lib/assignment";
import { HedefSecici } from "@/components/HedefSecici";
import { BilesenDuzenleyici } from "@/components/BilesenDuzenleyici";

// Oluşturma ve düzenleme aynı formu kullanır: alanlar birebir aynı, değişen
// yalnızca hangi action'a gittiği ve düzenlemede kaç kaydın kaybolacağı.
//
// Şablon yalnızca formu ÖN DOLDURUR. Kurum adları (Oxford, Cambridge) bilerek
// şablon değildir: kişiye özel kurallar koda gömülmez. Oxford sınavı "Tek
// puan" şablonuyla, kendi tam puanı yazılarak açılır.

export type SinavBaslangici = {
  title: string;
  examDate: string;
  maxScore: string;
  scope: ExamScope;
  bilesenler: BilesenSatiri[];
};

export function SinavFormu({
  siniflar,
  baslangic,
  sinavId,
  seciliIdler,
  islenmisIdler,
}: {
  siniflar: HedefSinif[];
  baslangic: SinavBaslangici;
  /** Doluysa düzenleme, boşsa yeni sınav. */
  sinavId?: string;
  seciliIdler: string[];
  islenmisIdler: string[];
}) {
  const duzenleme = sinavId !== undefined;
  const [durum, gonder, bekliyor] = useActionState(
    duzenleme ? sinavDuzenlemesiKaydet : sinavKaydet,
    BOS_FORM,
  );

  const [secili, setSecili] = useState<Set<string>>(() => new Set(seciliIdler));
  const [bilesenler, setBilesenler] = useState<BilesenSatiri[]>(baslangic.bilesenler);
  const [scope, setScope] = useState<ExamScope>(baslangic.scope);
  const [maxScore, setMaxScore] = useState(baslangic.maxScore);
  // Şablon yalnızca yeni sınavda seçilir: var olan bir sınavın bileşenlerini
  // şablonla ezmek girilmiş notları sessizce silerdi.
  const [sablon, setSablon] = useState("");

  const islenmisKume = new Set(islenmisIdler);
  const kaybolacak = islenmisIdler.filter((id) => !secili.has(id)).length;
  // Kaldırılan bileşenlerdeki notlar da kaybolur; sayısı önceden yazılır.
  const bilesenNotlari = baslangic.bilesenler
    .filter((b) => b.id && !bilesenler.some((y) => y.id === b.id))
    .reduce((toplam, b) => toplam + b.girdiSayisi, 0);

  const agirlikTamam = agirlikToplami(bilesenler) === AGIRLIK_TOPLAMI;

  function sablonUygula(anahtar: string) {
    setSablon(anahtar);
    const secim = SINAV_SABLONLARI.find((s) => s.anahtar === anahtar);
    if (!secim) return;
    setScope(secim.scope);
    setMaxScore(String(secim.maxScore));
    setBilesenler(
      secim.bilesenler.map((b) => ({
        id: null,
        name: b.name,
        weight: String(b.weight),
        maxScore: String(b.maxScore),
        entry: b.entry,
        questionCount: b.questionCount === null ? "" : String(b.questionCount),
        wrongDivisor: b.wrongDivisor === null ? "" : String(b.wrongDivisor),
        girdiSayisi: 0,
      })),
    );
  }

  return (
    <form className="form sinav-formu" action={gonder}>
      {duzenleme && <input type="hidden" name="sinavId" value={sinavId} />}

      {!duzenleme && (
        <label className="alan">
          <span className="alan-etiket">Hazır düzen</span>
          <select value={sablon} onChange={(e) => sablonUygula(e.target.value)}>
            <option value="">Seçin…</option>
            {SINAV_SABLONLARI.map((s) => (
              <option key={s.anahtar} value={s.anahtar}>
                {s.ad}
              </option>
            ))}
          </select>
          <span className="soluk alan-not">
            {SINAV_SABLONLARI.find((s) => s.anahtar === sablon)?.aciklama ??
              "Bileşenleri ön doldurur. Seçtikten sonra hepsi değiştirilebilir."}
          </span>
        </label>
      )}

      <label className="alan">
        <span className="alan-etiket">Sınav adı</span>
        <input
          name="title"
          defaultValue={durum.degerler.title ?? baslangic.title}
          placeholder="örn. 1. Dönem 1. Yazılı"
          maxLength={120}
          autoComplete="off"
        />
      </label>

      <div className="ikili">
        {/* Geçmiş tarih serbest: geriye dönük sınav girilebilmeli. */}
        <label className="alan">
          <span className="alan-etiket">Sınav tarihi</span>
          <input
            type="date"
            name="examDate"
            defaultValue={durum.degerler.examDate ?? baslangic.examDate}
          />
        </label>

        <label className="alan">
          <span className="alan-etiket">Sınavın tam puanı</span>
          <input
            name="maxScore"
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
            inputMode="decimal"
            placeholder="100"
          />
          <span className="soluk alan-not">
            Her sınav 100 üzerinden değildir. Karşılaştırmalar yüzdeye çevrilir.
          </span>
        </label>
      </div>

      <fieldset className="alan">
        <legend className="alan-etiket">Sınav türü</legend>
        <div className="secim-satiri">
          <label className="secim">
            <input
              type="radio"
              name="scope"
              value="OFFICIAL"
              checked={scope === "OFFICIAL"}
              onChange={() => setScope("OFFICIAL")}
            />
            <span>Resmî (karneye girer)</span>
          </label>
          <label className="secim">
            <input
              type="radio"
              name="scope"
              value="PRACTICE"
              checked={scope === "PRACTICE"}
              onChange={() => setScope("PRACTICE")}
            />
            <span>Deneme / tarama</span>
          </label>
        </div>
        <span className="soluk alan-not">
          Deneme sınavları karne ortalamasına karışmaz, ayrı hesaplanır.
        </span>
      </fieldset>

      <div className="alan">
        <span className="alan-etiket">Sınavın bileşenleri</span>
        <BilesenDuzenleyici bilesenler={bilesenler} onDegis={setBilesenler} />
      </div>

      <div className="alan">
        <span className="alan-etiket">
          Kimlere verilecek <span className="rozet">{secili.size} öğrenci</span>
        </span>
        <HedefSecici
          siniflar={siniflar}
          secili={secili}
          onDegis={setSecili}
          isaretliIdler={islenmisKume}
          bosMesaj="Sınav verilebilecek öğrenci yok. Önce bir sınıf ve öğrenci ekleyin."
        />
      </div>

      {kaybolacak > 0 && (
        <p className="uyari">
          {kaybolacak} öğrencinin notu işlenmiş olduğu hâlde seçimden çıkarıldı.
          Kaydedilirse sınav kayıtları silinecek.
        </p>
      )}

      {bilesenNotlari > 0 && (
        <p className="uyari">
          Kaldırılan bileşenlerde {bilesenNotlari} girilmiş not var. Kaydedilirse
          bu notlar silinecek.
        </p>
      )}

      <button
        type="submit"
        disabled={bekliyor || secili.size === 0 || !agirlikTamam}
      >
        {bekliyor
          ? "Kaydediliyor…"
          : duzenleme
            ? "Değişiklikleri kaydet"
            : "Sınavı oluştur"}
      </button>
      {durum.hata && <p className="hata">{durum.hata}</p>}
    </form>
  );
}
