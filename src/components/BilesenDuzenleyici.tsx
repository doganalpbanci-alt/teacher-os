"use client";

import type { ComponentEntry } from "@prisma/client";
import {
  AGIRLIK_TOPLAMI,
  agirlikToplami,
  bosBilesen,
  type BilesenSatiri,
} from "@/lib/exam-rules";

// Sınavın parçalarını düzenleten liste. MEB sınavı üç satırdır (Yazılı %50,
// Listening %25, Speaking %25); tek puanlı bir sınav tek satır.
//
// Ağırlık toplamı ekranda canlı görünür ve 100 değilse kaydetme kapanır.
// Aynı kural sunucuda da çalışır (`bilesenleriDogrula`): düğme gizlemek
// doğrulama değildir, ikisi de aynı fonksiyona bakar.
//
// Satır tipi ve yardımcıları `exam-rules` içinde durur, burada değil: bu dosya
// "use client" ve sunucu bileşeni buradan bir fonksiyon çağıramaz. Sınav
// oluşturma sayfası sunucuda çalışıp formu ön dolduruyor.

export function BilesenDuzenleyici({
  bilesenler,
  onDegis,
}: {
  bilesenler: BilesenSatiri[];
  onDegis: (yeni: BilesenSatiri[]) => void;
}) {
  const toplam = agirlikToplami(bilesenler);
  const toplamDogru = toplam === AGIRLIK_TOPLAMI;

  function degistir(sira: number, yama: Partial<BilesenSatiri>) {
    onDegis(bilesenler.map((b, i) => (i === sira ? { ...b, ...yama } : b)));
  }

  function sil(sira: number) {
    onDegis(bilesenler.filter((_, i) => i !== sira));
  }

  return (
    <div className="bilesenler">
      {bilesenler.map((bilesen, sira) => (
        <fieldset className="bilesen" key={bilesen.id ?? `yeni-${sira}`}>
          <legend className="gorunmez">{bilesen.name || `Bileşen ${sira + 1}`}</legend>

          {/* Var olan bileşenin id'si taşınır; kaydederken hangi satırın
              korunacağı buradan bilinir. Yeni satırda boş gider. */}
          <input type="hidden" name="bilesenId" value={bilesen.id ?? ""} />

          <div className="bilesen-satir">
            <label className="alan bilesen-ad">
              <span className="alan-etiket">Bileşen adı</span>
              <input
                name="bilesenAdi"
                value={bilesen.name}
                onChange={(e) => degistir(sira, { name: e.target.value })}
                placeholder="örn. Yazılı"
                maxLength={40}
                autoComplete="off"
              />
            </label>

            <label className="alan bilesen-dar">
              <span className="alan-etiket">Ağırlık %</span>
              <input
                name="bilesenAgirlik"
                value={bilesen.weight}
                onChange={(e) => degistir(sira, { weight: e.target.value })}
                inputMode="decimal"
                placeholder="50"
              />
            </label>

            <label className="alan bilesen-dar">
              <span className="alan-etiket">Tam puan</span>
              <input
                name="bilesenTamPuan"
                value={bilesen.maxScore}
                onChange={(e) => degistir(sira, { maxScore: e.target.value })}
                inputMode="decimal"
                placeholder="100"
              />
            </label>

            <label className="alan bilesen-dar">
              <span className="alan-etiket">Giriş</span>
              <select
                name="bilesenGiris"
                value={bilesen.entry}
                onChange={(e) =>
                  degistir(sira, { entry: e.target.value as ComponentEntry })
                }
              >
                <option value="SCORE">Puan</option>
                <option value="NET">Doğru / yanlış</option>
              </select>
            </label>

            {bilesenler.length > 1 && (
              <button
                type="button"
                className="bilesen-sil"
                onClick={() => sil(sira)}
                aria-label={`${bilesen.name || `Bileşen ${sira + 1}`} bileşenini kaldır`}
              >
                Kaldır
              </button>
            )}
          </div>

          {/* Net alanları HER satırda gönderilir; sunucu alanları sıraya göre
              eşleştiriyor, bir satırın atlanması sonrakileri kaydırırdı.
              SCORE modunda boş gizli alan gider, sunucu da onu yok sayar. */}
          {bilesen.entry === "NET" ? (
            <div className="bilesen-satir bilesen-net">
              <label className="alan bilesen-dar">
                <span className="alan-etiket">Soru sayısı</span>
                <input
                  name="bilesenSoruSayisi"
                  value={bilesen.questionCount}
                  onChange={(e) => degistir(sira, { questionCount: e.target.value })}
                  inputMode="numeric"
                  placeholder="20"
                />
              </label>
              <label className="alan bilesen-dar">
                <span className="alan-etiket">Kaç yanlış 1 doğru götürür</span>
                <input
                  name="bilesenYanlisBoleni"
                  value={bilesen.wrongDivisor}
                  onChange={(e) => degistir(sira, { wrongDivisor: e.target.value })}
                  inputMode="numeric"
                  placeholder="3"
                />
              </label>
              <p className="soluk bilesen-not">
                Boş bırakılırsa yanlışlar puanı etkilemez, yalnızca kayda geçer.
              </p>
            </div>
          ) : (
            <>
              <input type="hidden" name="bilesenSoruSayisi" value="" />
              <input type="hidden" name="bilesenYanlisBoleni" value="" />
            </>
          )}

          {bilesen.girdiSayisi > 0 && (
            <p className="soluk bilesen-not">
              Bu bileşende {bilesen.girdiSayisi} öğrencinin notu var. Kaldırılırsa
              o notlar silinir.
            </p>
          )}
        </fieldset>
      ))}

      <div className="bilesen-alt">
        <button
          type="button"
          className="ikincil"
          onClick={() => onDegis([...bilesenler, bosBilesen()])}
        >
          Bileşen ekle
        </button>
        <span className={`rozet${toplamDogru ? "" : " rozet-uyari"}`}>
          Ağırlık toplamı: {toplam} / {AGIRLIK_TOPLAMI}
        </span>
      </div>

      {!toplamDogru && (
        <p className="uyari">
          Bileşen ağırlıkları toplam {AGIRLIK_TOPLAMI} etmeli. Şu an {toplam}.
        </p>
      )}
    </div>
  );
}
