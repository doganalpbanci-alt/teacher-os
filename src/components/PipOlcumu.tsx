"use client";

import { useEffect, useRef, useState } from "react";

// GEÇİCİ ÖLÇÜM ARACI. Ürünün parçası değil.
//
// Tek bir soruyu cevaplamak için var: akıllı tahtada üstüne PowerPoint
// açıldığında, tarayıcı zamanlayıcıyı kısıyor mu? Chrome arka plandaki
// sekmelerin zamanlayıcısını dakikada bire kadar kısar; Document
// Picture-in-Picture penceresi ekranda GÖRÜNÜR kaldığı için onun kendi
// zamanlayıcısının kısılmaması beklenir — ama bu beklentiyi ölçmeden
// canlı yayını oraya taşımak, bir oturumluk emeği kumara yatırmak olur.
//
// İki sayaç birlikte işler:
//   - ANA SEKME'nin setInterval'i (arka plana düşünce kısılması beklenen)
//   - PiP PENCERESİ'nin kendi setInterval'i (kısılmaması umulan)
// Beklenen tik sayısı geçen süreden hesaplanır, böylece karşılaştırma için
// kafadan hesap yapmak gerekmez.
//
// Soru cevaplandıktan sonra bu dosya ve /tahta-testi rotası silinir.

const ARALIK_MS = 2000;
const BIP_ARALIGI = 10;

type Sayim = { ana: number; pip: number };

export function PipOlcumu() {
  const [destekleniyor, setDestekleniyor] = useState<boolean | null>(null);
  const [acik, setAcik] = useState(false);
  const [sayim, setSayim] = useState<Sayim>({ ana: 0, pip: 0 });
  const [baslangic, setBaslangic] = useState<number | null>(null);
  const [simdi, setSimdi] = useState(Date.now());
  const [hata, setHata] = useState<string | null>(null);

  const sesBaglami = useRef<AudioContext | null>(null);
  const pipPenceresi = useRef<Window | null>(null);
  const zamanlayicilar = useRef<number[]>([]);

  useEffect(() => {
    setDestekleniyor("documentPictureInPicture" in window);
  }, []);

  // Geçen süreyi ekranda tutmak için; bu sayaç da ana sekmede çalışır ama
  // ölçümün kendisi Date farkına baktığı için kısılması sonucu bozmaz.
  useEffect(() => {
    const t = window.setInterval(() => setSimdi(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);

  function bip(frekans: number) {
    const ctx = sesBaglami.current;
    if (!ctx) return;
    const osilator = ctx.createOscillator();
    const kazanc = ctx.createGain();
    osilator.type = "square";
    osilator.frequency.setValueAtTime(frekans, ctx.currentTime);
    kazanc.gain.setValueAtTime(0, ctx.currentTime);
    kazanc.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    kazanc.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
    osilator.connect(kazanc).connect(ctx.destination);
    osilator.start();
    osilator.stop(ctx.currentTime + 0.12);
  }

  async function baslat() {
    setHata(null);
    try {
      // Ses, ölçüm sırasında kulakla da takip edilebilsin diye tıklamanın
      // içinde açılır (tarayıcı izni bunu şart koşar).
      if (!sesBaglami.current) sesBaglami.current = new AudioContext();
      await sesBaglami.current.resume();

      const istek = (
        window as unknown as {
          documentPictureInPicture: {
            requestWindow: (o: { width: number; height: number }) => Promise<Window>;
          };
        }
      ).documentPictureInPicture;
      const pencere = await istek.requestWindow({ width: 380, height: 260 });
      pipPenceresi.current = pencere;

      const govde = pencere.document.body;
      govde.style.cssText =
        "margin:0;padding:16px;font:14px system-ui,sans-serif;background:#14161a;color:#fff";
      govde.innerHTML = `
        <div style="font-weight:700;font-size:16px;margin-bottom:12px">Tahta ölçümü</div>
        <div style="line-height:1.9">
          <div>PiP tik: <b id="pip" style="font-size:20px">0</b></div>
          <div>Ana sekme tik: <b id="ana" style="font-size:20px">0</b></div>
          <div>Beklenen: <b id="beklenen" style="font-size:20px">0</b></div>
        </div>
        <div id="not" style="margin-top:12px;color:#9aa4b2;font-size:12px">
          Üstüne PowerPoint aç, 5 dakika bekle, sonra bu pencereye bak.
        </div>`;

      const t0 = Date.now();
      setBaslangic(t0);
      setSayim({ ana: 0, pip: 0 });

      let pipSayaci = 0;
      let anaSayaci = 0;

      const yaz = () => {
        const beklenen = Math.floor((Date.now() - t0) / ARALIK_MS);
        pencere.document.getElementById("pip")!.textContent = String(pipSayaci);
        pencere.document.getElementById("ana")!.textContent = String(anaSayaci);
        pencere.document.getElementById("beklenen")!.textContent = String(beklenen);
      };

      // PiP penceresinin KENDİ zamanlayıcısı: ölçmek istediğimiz asıl şey.
      const pipTimer = pencere.setInterval(() => {
        pipSayaci += 1;
        if (pipSayaci % BIP_ARALIGI === 0) bip(880);
        yaz();
        setSayim((o) => ({ ...o, pip: pipSayaci }));
      }, ARALIK_MS);

      // Ana sekmenin zamanlayıcısı: kıyas noktası.
      const anaTimer = window.setInterval(() => {
        anaSayaci += 1;
        yaz();
        setSayim((o) => ({ ...o, ana: anaSayaci }));
      }, ARALIK_MS);

      zamanlayicilar.current = [anaTimer];
      pencere.addEventListener("pagehide", () => {
        pencere.clearInterval(pipTimer);
        window.clearInterval(anaTimer);
        setAcik(false);
      });

      setAcik(true);
    } catch (e) {
      setHata(e instanceof Error ? e.message : "PiP penceresi açılamadı.");
    }
  }

  function durdur() {
    pipPenceresi.current?.close();
    for (const t of zamanlayicilar.current) window.clearInterval(t);
    setAcik(false);
  }

  const gecenSaniye = baslangic ? Math.floor((simdi - baslangic) / 1000) : 0;
  const beklenen = baslangic ? Math.floor((simdi - baslangic) / ARALIK_MS) : 0;

  if (destekleniyor === null) return null;

  if (!destekleniyor) {
    return (
      <p className="hata">
        Bu tarayıcı Document Picture-in-Picture desteklemiyor. Masaüstü Chrome
        ya da Edge 116+ gerekiyor — tahtada hangi tarayıcının açık olduğunu
        kontrol edin.
      </p>
    );
  }

  return (
    <>
      <div className="veli-gonder-satiri">
        <button type="button" onClick={baslat} disabled={acik}>
          {acik ? "Ölçüm sürüyor…" : "PiP penceresini aç ve ölçümü başlat"}
        </button>
        {acik && (
          <button type="button" className="veli-taslak-dugmesi" onClick={durdur}>
            Durdur
          </button>
        )}
      </div>

      {hata && <p className="hata">{hata}</p>}

      {baslangic && (
        <div className="olcum-satiri">
          <div className="olcum">
            <span className="olcum-deger">{gecenSaniye}</span>
            <span className="olcum-etiket">saniye geçti</span>
          </div>
          <div className="olcum">
            <span className="olcum-deger">{beklenen}</span>
            <span className="olcum-etiket">beklenen tik</span>
          </div>
          <div className="olcum">
            <span className="olcum-deger">{sayim.pip}</span>
            <span className="olcum-etiket">PiP tik</span>
          </div>
          <div className="olcum">
            <span className="olcum-deger">{sayim.ana}</span>
            <span className="olcum-etiket">ana sekme tik</span>
          </div>
        </div>
      )}
    </>
  );
}
