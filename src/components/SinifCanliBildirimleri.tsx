"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BehaviorTemplate, BehaviorType } from "@prisma/client";
import { OLAY_GORUNUMU } from "@/lib/behavior-rules";
import { sesCal } from "@/lib/board-sound";

// Telefondan verilen bir kart/yıldızın tahtada anında görünmesi ve dikkat
// çekici bir ses çalması.
//
// AYRI BİR SAYFA YOK: bu bileşen mevcut sınıf ekranına eklenir.
//
// NE ZAMAN ETKİN: varsayılan olarak ekran genişliği globals.css'teki 1280px
// eşiğini geçtiğinde (yani ekran zaten "tahta" sayılacak kadar genişse) —
// telefon bunu kendiliğinden hiç açmaz. Ama bu yalnızca bir TAHMİN: tahtayı
// bölünmüş ekranda dar bir şeride koyduğunda genişlik düşer ve tahmin yanılır.
// Bu yüzden öğretmen açık bir düğmeyle her iki yöne de karar verebilir; seçim
// cihazda (localStorage) kalır, sunucuya gitmez — cihaza özel bir tercihtir,
// tıpkı kilidin cihaza ait olması gibi.
//
// Düğme yalnızca GÖRÜNÜMÜ değil, canlı katmanı açar: iki sütunlu büyük düzen
// hâlâ CSS'teki genişlik eşiğine bağlıdır. Dar bir şeritte bildirim ve ses
// gelir ama düzen kompakt kalır — zaten dar şeritte istenen de budur.
//
// Websocket ya da Supabase Realtime KULLANILMAZ: tarayıcıdan doğrudan
// veritabanına erişim, sahiplik kuralını (her sorgu öğretmen id'siyle
// süzülür) atlamak anlamına gelirdi. Bunun yerine 2 saniyede bir kendi
// oturumuyla, kendi sunucu uç noktasını yoklar.

const TAHTA_ESIGI = "(min-width: 1280px)";
const YOKLAMA_ARALIGI_MS = 2000;
const BILDIRIM_SURESI_MS = 2500;
const SECIM_ANAHTARI = "teacher_os_tahta_modu";

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

/** null = karar verilmemiş, genişliğe bakılır. */
type Secim = boolean | null;

function secimiOku(): Secim {
  try {
    const deger = window.localStorage.getItem(SECIM_ANAHTARI);
    if (deger === "acik") return true;
    if (deger === "kapali") return false;
  } catch {
    // Gizli sekme ya da depolama kapalı: karar verilmemiş sayılır.
  }
  return null;
}

function secimiYaz(secim: Secim): void {
  try {
    if (secim === null) window.localStorage.removeItem(SECIM_ANAHTARI);
    else window.localStorage.setItem(SECIM_ANAHTARI, secim ? "acik" : "kapali");
  } catch {
    // Yazılamazsa seçim yalnızca bu oturum için geçerli olur.
  }
}

export function SinifCanliBildirimleri({
  dersId,
  sablon,
  baslangicZamani,
  kilitli,
}: {
  dersId: string | null;
  sablon: BehaviorTemplate;
  /** Sunucuda üretilmiş ISO zaman damgası. İstemcinin kendi saati asla
   *  kullanılmaz — akıllı tahtanın sistem saati güvenilir olmayabilir. */
  baslangicZamani: string;
  /** Kilitli tahtada mod düğmesi gizlenir: öğrenci canlı yayını kapatamasın. */
  kilitli: boolean;
}) {
  const router = useRouter();
  const [genis, setGenis] = useState(false);
  const [secim, setSecim] = useState<Secim>(null);
  const [sesAcik, setSesAcik] = useState(false);
  const [gosterilen, setGosterilen] = useState<Olay | null>(null);

  const sesAcikRef = useRef(sesAcik);
  const sesBaglami = useRef<AudioContext | null>(null);
  const sonKontrol = useRef(baslangicZamani);
  const kuyruk = useRef<Olay[]>([]);
  const gosteriliyor = useRef(false);

  // Kilitli cihaz TANIM GEREĞİ tahtadır: öğretmen onu bilerek kilitledi,
  // sınıfın önünde duran ekran o. Genişlik yalnızca bir tahmindi ve gerçek
  // tahtada yanıldı (1280px'in altında kalan bir tahtada canlı katman hiç
  // açılmıyordu; üstelik kilitliyken mod düğmesi de gizli olduğu için açmanın
  // yolu kalmıyordu). Bu yüzden kilit, genişliğin de seçimin de önüne geçer.
  // Aksi halde ders boyunca hiçbir bildirim gelmez, kilit açılınca hepsi
  // birden düşer.
  const etkin = kilitli || (secim ?? genis);

  useEffect(() => {
    sesAcikRef.current = sesAcik;
  }, [sesAcik]);

  useEffect(() => {
    setSecim(secimiOku());
  }, []);

  // Genişlik eşiği: aynı css breakpoint'i JS tarafında da izler. Bölünmüş
  // ekranda pencere bu eşiği geçebildiği için dinleyici gerçekten gerekli.
  useEffect(() => {
    const sorgu = window.matchMedia(TAHTA_ESIGI);
    setGenis(sorgu.matches);
    const dinle = (olay: MediaQueryListEvent) => setGenis(olay.matches);
    sorgu.addEventListener("change", dinle);
    return () => sorgu.removeEventListener("change", dinle);
  }, []);

  // Sıradaki bildirimi gösterir; yalnızca ref'lere dokunduğu için bileşen
  // yeniden render olsa bile davranışı değişmez (bayat closure sorunu yok).
  const siradakiniGoster = useCallback(function goster() {
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
      goster();
    }, BILDIRIM_SURESI_MS);
  }, []);

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
  }, [etkin, dersId, router, siradakiniGoster]);

  async function sesiAc() {
    if (!sesBaglami.current) sesBaglami.current = new AudioContext();
    await sesBaglami.current.resume();
    setSesAcik(true);
  }

  function moduDegistir() {
    const yeni = !etkin;
    setSecim(yeni);
    secimiYaz(yeni);
  }

  const gorunum = gosterilen ? OLAY_GORUNUMU[sablon][gosterilen.tur] : undefined;

  return (
    <div className="canli-yayin">
      {!kilitli && (
        <button type="button" className="canli-mod-dugmesi" onClick={moduDegistir}>
          {etkin ? "🖥 Tahta modu açık" : "🖥 Tahta modu"}
        </button>
      )}

      {etkin && (
        <button type="button" className="canli-ses-dugmesi" onClick={sesiAc} disabled={sesAcik}>
          {sesAcik ? "🔊 Ses açık" : "🔈 Sesi aç"}
        </button>
      )}

      {etkin && gosterilen && gorunum && (
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
