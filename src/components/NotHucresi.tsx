"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { notGir } from "@/app/sinav-actions";
import { BOS_FORM } from "@/lib/form-state";
import { bilesenPuani, netHesapla, yuvarla, type Bilesen } from "@/lib/exam-rules";

// Not tablosundaki tek hücre: bir öğrencinin bir bileşendeki notu.
//
// Kayıt alandan çıkınca (blur) gider, her tuşta değil: öğretmen sınıfın
// notlarını arka arkaya yazar, her rakam için sunucuya gitmek hem yavaş hem
// gereksiz olurdu. Değer değişmediyse gönderim de yapılmaz.
//
// Hesaplanan net ve puan öğretmen yazarken görünür; ekran sunucuyla AYNI
// fonksiyonu (`exam-rules`) kullanır, kural iki yere kopyalanmaz.

type Degerler = { score: string; correct: string; wrong: string; blank: string };

function sayiya(ham: string): number | null {
  const kirpik = ham.trim();
  if (!kirpik) return null;
  const deger = Number(kirpik.replace(",", "."));
  return Number.isFinite(deger) ? deger : null;
}

export function NotHucresi({
  sonucId,
  sinavId,
  bilesen,
  baslangic,
  devreDisi,
}: {
  sonucId: string;
  sinavId: string;
  bilesen: Bilesen;
  baslangic: Degerler;
  /** Öğrenci sınava girmedi işaretliyse giriş kapanır. */
  devreDisi: boolean;
}) {
  const [sonuc, gonder, bekliyor] = useActionState(notGir, BOS_FORM);
  const formRef = useRef<HTMLFormElement>(null);
  const [degerler, setDegerler] = useState<Degerler>(baslangic);
  // En son sunucuya gideni tutar; alandan çıkışta değişiklik var mı buradan
  // anlaşılır. Aksi hâlde her odak kaybı bir yazma isteği açardı.
  const gonderilen = useRef<Degerler>(baslangic);

  // Sunucudan gelen yeni değer (başka bir yerden düzeltilmiş olabilir)
  // yazılmakta olan hücreyi ezmesin diye yalnızca boştayken uygulanır.
  useEffect(() => {
    if (!bekliyor) gonderilen.current = degerler;
    // Yalnızca gönderim bittiğinde çalışsın; degerler bilerek bağımlılık değil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sonuc.deneme]);

  function alandanCikildi() {
    const oncekiler = gonderilen.current;
    const degisti =
      oncekiler.score !== degerler.score ||
      oncekiler.correct !== degerler.correct ||
      oncekiler.wrong !== degerler.wrong ||
      oncekiler.blank !== degerler.blank;
    if (!degisti) return;
    gonderilen.current = degerler;
    formRef.current?.requestSubmit();
  }

  const girdi = {
    score: sayiya(degerler.score),
    correct: sayiya(degerler.correct),
    wrong: sayiya(degerler.wrong),
    blank: sayiya(degerler.blank),
  };

  const net =
    bilesen.entry === "NET" && girdi.correct !== null && girdi.wrong !== null
      ? yuvarla(netHesapla(girdi.correct, girdi.wrong, bilesen.wrongDivisor))
      : null;
  const puan = bilesenPuani(bilesen, girdi);

  return (
    <form className="not-hucre" action={gonder} ref={formRef}>
      <input type="hidden" name="sonucId" value={sonucId} />
      <input type="hidden" name="bilesenId" value={bilesen.id} />
      <input type="hidden" name="sinavId" value={sinavId} />

      {bilesen.entry === "NET" ? (
        <>
          {/* Doğru ve yanlış ayrı ayrı; boş isteğe bağlı, çoğu öğretmen
              girmiyor ve net hesabına da katılmıyor. */}
          <span className="net-girisler">
            <input
              name="correct"
              value={degerler.correct}
              onChange={(e) => setDegerler({ ...degerler, correct: e.target.value })}
              onBlur={alandanCikildi}
              inputMode="numeric"
              placeholder="D"
              aria-label={`${bilesen.name} doğru sayısı`}
              disabled={devreDisi || bekliyor}
            />
            <input
              name="wrong"
              value={degerler.wrong}
              onChange={(e) => setDegerler({ ...degerler, wrong: e.target.value })}
              onBlur={alandanCikildi}
              inputMode="numeric"
              placeholder="Y"
              aria-label={`${bilesen.name} yanlış sayısı`}
              disabled={devreDisi || bekliyor}
            />
            <input
              name="blank"
              value={degerler.blank}
              onChange={(e) => setDegerler({ ...degerler, blank: e.target.value })}
              onBlur={alandanCikildi}
              inputMode="numeric"
              placeholder="B"
              aria-label={`${bilesen.name} boş sayısı`}
              disabled={devreDisi || bekliyor}
            />
          </span>
          <input type="hidden" name="score" value="" />
          {net !== null && (
            <span className="hucre-turev">
              {net} net · {puan ?? "—"} puan
            </span>
          )}
        </>
      ) : (
        <>
          <input
            name="score"
            value={degerler.score}
            onChange={(e) => setDegerler({ ...degerler, score: e.target.value })}
            onBlur={alandanCikildi}
            inputMode="decimal"
            placeholder="—"
            aria-label={`${bilesen.name} puanı`}
            disabled={devreDisi || bekliyor}
          />
          <input type="hidden" name="correct" value="" />
          <input type="hidden" name="wrong" value="" />
          <input type="hidden" name="blank" value="" />
          {bilesen.maxScore !== 100 && (
            <span className="hucre-turev">/ {bilesen.maxScore}</span>
          )}
        </>
      )}

      {/* JavaScript kapalıysa da kaydedilebilsin. */}
      <noscript>
        <button type="submit">Kaydet</button>
      </noscript>

      {sonuc.hata && <span className="hata hucre-hata">{sonuc.hata}</span>}
    </form>
  );
}
