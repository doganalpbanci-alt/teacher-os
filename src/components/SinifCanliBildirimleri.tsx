"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BehaviorTemplate, BehaviorType } from "@prisma/client";
import { OLAY_GORUNUMU } from "@/lib/behavior-rules";
import { sesCal } from "@/lib/board-sound";

// Telefondan verilen bir kart/yıldızın tahtada anında görünmesi ve dikkat
// çekici bir ses çalması.
//
// AYRI BİR SAYFA YOK: bu bileşen mevcut sınıf ekranına eklenir ve yalnızca
// ekran zaten "tahta" sayılacak kadar genişse (globals.css'teki 1280px eşiği
// ile aynı) kendini etkinleştirir — telefon bunu hiç görmez, hiç yoklama
// yapmaz. Bu eşik kesin bir "bu cihaz tahta" bilgisi değil, genişlik
// tahminidir; geniş bir dizüstünde de açılır, zararsızdır (ses yine
// dokunmadan çalmaz).
//
// Websocket ya da Supabase Realtime KULLANILMAZ: tarayıcıdan doğrudan
// veritabanına erişim, sahiplik kuralını (her sorgu öğretmen id'siyle
// süzülür) atlamak anlamına gelirdi. Bunun yerine 2 saniyede bir kendi
// oturumuyla, kendi sunucu uç noktasını yoklar.

const TAHTA_ESIGI = "(min-width: 1280px)";
const YOKLAMA_ARALIGI_MS = 2000;
const BILDIRIM_SURESI_MS = 2500;

// Yalnızca tarayıcı testlerinin gözlemlemesi için: sesin çalındığını ve
// yoklamanın çalıştığını doğrudan doğrulamanın başka yolu yok (Playwright
// sesi duyamaz, aralıklı zamanlayıcıyı da göremez).
declare global {
  interface Window {
    __tahtaSesSayaci?: number;
    __tahtaYoklamaSayaci?: number;
  }
}

type Olay = { id: string; tur: BehaviorType; ogrenciAdi: string };

export function SinifCanliBildirimleri({
  dersId,
  sablon,
  baslangicZamani,
}: {
  dersId: string | null;
  sablon: BehaviorTemplate;
  /** Sunucuda üretilmiş ISO zaman damgası. İstemcinin kendi saati asla
   *  kullanılmaz — akıllı tahtanın sistem saati güvenilir olmayabilir. */
  baslangicZamani: string;
}) {
  const router = useRouter();
  const [etkin, setEtkin] = useState(false);
  const [sesAcik, setSesAcik] = useState(false);
  const [gosterilen, setGosterilen] = useState<Olay | null>(null);

  const sesAcikRef = useRef(sesAcik);
  const sesBaglami = useRef<AudioContext | null>(null);
  const sonKontrol = useRef(baslangicZamani);
  const kuyruk = useRef<Olay[]>([]);
  const gosteriliyor = useRef(false);

  useEffect(() => {
    sesAcikRef.current = sesAcik;
  }, [sesAcik]);

  // Genişlik eşiği: aynı css breakpoint'i JS tarafında da izler. Bir
  // pencerenin bu eşiği ders sırasında geçmesi beklenmez ama dinleyici
  // ucuz olduğu için eklendi.
  useEffect(() => {
    const sorgu = window.matchMedia(TAHTA_ESIGI);
    setEtkin(sorgu.matches);
    const dinle = (olay: MediaQueryListEvent) => setEtkin(olay.matches);
    sorgu.addEventListener("change", dinle);
    return () => sorgu.removeEventListener("change", dinle);
  }, []);

  // Sıradaki bildirimi gösterir; yalnızca ref'lere dokunduğu için bileşen
  // yeniden render olsa bile davranışı değişmez (bayat closure sorunu yok).
  function siradakiniGoster() {
    if (gosteriliyor.current) return;
    const olay = kuyruk.current.shift();
    if (!olay) return;

    gosteriliyor.current = true;
    setGosterilen(olay);

    if (sesAcikRef.current && sesBaglami.current) {
      sesCal(sesBaglami.current, olay.tur);
      if (typeof window !== "undefined") {
        window.__tahtaSesSayaci = (window.__tahtaSesSayaci ?? 0) + 1;
      }
    }

    setTimeout(() => {
      gosteriliyor.current = false;
      setGosterilen(null);
      siradakiniGoster();
    }, BILDIRIM_SURESI_MS);
  }

  // İmleç yalnızca DERS değişince sıfırlanır, her yeni `baslangicZamani`
  // değerinde değil: aşağıdaki `router.refresh()` sunucudan taze bir zaman
  // damgası getirir ve bu effect ona da bağlı olsaydı imleç ileri atlar,
  // tazeleme ile bir sonraki yoklama arasına düşen olaylar hiç görünmezdi.
  // İlk değer zaten `useRef(baslangicZamani)` ile mount'ta alınıyor.
  useEffect(() => {
    sonKontrol.current = baslangicZamani;
    kuyruk.current = [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dersId]);

  useEffect(() => {
    if (!etkin || !dersId) return;

    async function yokla() {
      // Sekme arka plandayken durur: pil ve ağ boşuna tüketilmesin.
      if (document.visibilityState !== "visible") return;
      if (typeof window !== "undefined") {
        window.__tahtaYoklamaSayaci = (window.__tahtaYoklamaSayaci ?? 0) + 1;
      }
      try {
        const yanit = await fetch(
          `/api/ders/${dersId}/olaylar?sonrasi=${encodeURIComponent(sonKontrol.current)}`,
        );
        if (!yanit.ok) return;
        const veri: { olaylar: Olay[]; sonKontrol: string | null } = await yanit.json();
        if (veri.sonKontrol) sonKontrol.current = veri.sonKontrol;
        if (veri.olaylar.length > 0) {
          kuyruk.current.push(...veri.olaylar);
          siradakiniGoster();
          // Bildirim geçicidir; altındaki liste (kimde kaç yıldız, kartı ne
          // renkte) sayfa yüklendiği andaki hâlinde donuk kalırdı. Tahta bir
          // ilan panosu gibi açık dururken sınıfın oradan okuduğu şey bu
          // liste, o yüzden olay geldikçe tazelenir. Yalnızca gerçekten yeni
          // olay varken çağrılır: boş yoklamada sunucuya iş çıkarmaz.
          router.refresh();
        }
      } catch {
        // Ağ hatası: bir sonraki yoklamada tekrar denenir, sessizce geçilir.
      }
    }

    const zamanlayici = setInterval(yokla, YOKLAMA_ARALIGI_MS);
    return () => clearInterval(zamanlayici);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etkin, dersId]);

  if (!etkin || !dersId) return null;

  async function sesiAc() {
    if (!sesBaglami.current) sesBaglami.current = new AudioContext();
    await sesBaglami.current.resume();
    setSesAcik(true);
  }

  const gorunum = gosterilen ? OLAY_GORUNUMU[sablon][gosterilen.tur] : undefined;

  return (
    <div className="canli-yayin">
      <button type="button" className="canli-ses-dugmesi" onClick={sesiAc} disabled={sesAcik}>
        {sesAcik ? "🔊 Ses açık" : "🔈 Sesi aç"}
      </button>

      {gosterilen && gorunum && (
        <div className="canli-bildirim" role="status" aria-live="polite">
          <span className="canli-bildirim-simge" aria-hidden="true">
            {gorunum.yazi}
          </span>
          <span className="canli-bildirim-metin">
            {gosterilen.ogrenciAdi} {gorunum.etiket}
          </span>
        </div>
      )}
    </div>
  );
}
