"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BehaviorTemplate, BehaviorType } from "@prisma/client";
import { OLAY_GORUNUMU } from "@/lib/behavior-rules";
import { sesCal } from "@/lib/board-sound";
import { bildirimGoster, bildirimIzniIste } from "@/lib/board-notification";
import {
  bildirimMetni,
  bildirimSuresi,
  buyukGosterilir,
  pipBoyutuCozumle,
  PIP_BOYUTLARI,
  type PipBoyutAnahtari,
} from "@/lib/board-rules";
import { pipAc, pipAcilabilir, pipBoyutlandir } from "@/lib/board-pip";
import { TahtaPenceresi, type PipOlayi } from "./TahtaPenceresi";

// Telefondan verilen bir kart/yıldızın tahtada anında görünmesi ve dikkat
// çekici bir ses çalması.
//
// İKİ AYRI GÖSTERİM YOLU, sekmenin görünür olup olmamasına göre:
//   görünür → sayfa içindeki `.canli-bildirim` kutusu + ses
//   arka planda → işletim sistemi bildirimi (`board-notification.ts`) + ses
// Tahtada sunum ya da başka bir uygulama öndeyken sayfa içi kutuyu kimse
// göremez; öğrenciyi uyarmanın işe yaraması için bildirimin önde ne varsa
// onun üstünde çıkması gerekir.
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
// Bildirimin ekranda kalma süresi artık olay türüne göre değişiyor;
// kural ve gerekçesi `board-notification.ts`te (`bildirimSuresi`).
const SECIM_ANAHTARI = "teacher_os_tahta_modu";
// Pencere boyutu cihazda kalır, tıpkı tahta modu seçimi gibi: tahtanın
// ekranıyla telefonun ekranı aynı ölçüyü istemez.
const PIP_BOYUT_ANAHTARI = "teacher_os_pip_boyutu";

// Yalnızca tarayıcı testlerinin gözlemlemesi için: sesin çalındığını ve
// yoklamanın çalıştığını doğrudan doğrulamanın başka yolu yok (Playwright
// sesi duyamaz, aralıklı zamanlayıcıyı da göremez).
declare global {
  interface Window {
    __tahtaSesSayaci?: number;
    __tahtaYoklamaSayaci?: number;
    __tahtaBildirimSayaci?: number;
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
  sinifId,
  dersId,
  sablon,
  baslangicZamani,
  kilitli,
  sinifAdi,
  dersYazisi,
}: {
  sinifId: string;
  /** Sayfa sunucuda render edilirken aktif olan ders; yalnızca başlangıç
   *  değeri. Gerçek ders id'si her yoklamada sunucudan gelir. */
  dersId: string | null;
  sablon: BehaviorTemplate;
  /** Sunucuda üretilmiş ISO zaman damgası. İstemcinin kendi saati asla
   *  kullanılmaz — akıllı tahtanın sistem saati güvenilir olmayabilir. */
  baslangicZamani: string;
  /** Kilitli tahtada mod düğmesi gizlenir: öğrenci canlı yayını kapatamasın. */
  kilitli: boolean;
  /** Tahta penceresi olay yokken bunları gösterir. */
  sinifAdi: string;
  dersYazisi: string;
}) {
  const router = useRouter();
  const [genis, setGenis] = useState(false);
  const [secim, setSecim] = useState<Secim>(null);
  const [sesAcik, setSesAcik] = useState(false);
  const [gosterilen, setGosterilen] = useState<Olay | null>(null);
  // Tahta penceresi (PiP). Açılabilirliği tarayıcıya bağlı, bu yüzden
  // düğme de ancak istemcide karar verildikten sonra görünür.
  const [pipVar, setPipVar] = useState(false);
  const [pipPenceresi, setPipPenceresi] = useState<Window | null>(null);
  const [pipOlayi, setPipOlayi] = useState<PipOlayi | null>(null);
  const [pipBoyutu, setPipBoyutu] = useState<PipBoyutAnahtari>(() => "ORTA");

  const sesAcikRef = useRef(sesAcik);
  const sesBaglami = useRef<AudioContext | null>(null);
  const sonKontrol = useRef(baslangicZamani);
  const kuyruk = useRef<Olay[]>([]);
  const gosteriliyor = useRef(false);
  // Tahtanın o an hangi dersi izlediği. Sunucudan gelen ders id'si bundan
  // farklıysa ders değişmiştir (başladı, bitti ya da yenisi açıldı).
  const izlenenDers = useRef(dersId);
  // Pencerenin kendi zamanlayıcısıyla kurulur, onunla temizlenir.
  const pipZamanlayici = useRef<number | null>(null);

  // Kilitli cihaz TANIM GEREĞİ tahtadır: öğretmen onu bilerek kilitledi,
  // sınıfın önünde duran ekran o. Genişlik yalnızca bir tahmindi ve gerçek
  // tahtada yanıldı (1280px'in altında kalan bir tahtada canlı katman hiç
  // açılmıyordu; üstelik kilitliyken mod düğmesi de gizli olduğu için açmanın
  // yolu kalmıyordu). Bu yüzden kilit, genişliğin de seçimin de önüne geçer.
  // Aksi halde ders boyunca hiçbir bildirim gelmez, kilit açılınca hepsi
  // birden düşer.
  const etkin = kilitli || (secim ?? genis);
  const pipAcik = pipPenceresi !== null;

  useEffect(() => {
    sesAcikRef.current = sesAcik;
  }, [sesAcik]);

  useEffect(() => {
    setSecim(secimiOku());
    setPipVar(pipAcilabilir());
    try {
      setPipBoyutu(pipBoyutuCozumle(window.localStorage.getItem(PIP_BOYUT_ANAHTARI)));
    } catch {
      // Depolama kapalıysa varsayılan boyut kullanılır.
    }
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

  // Ses hem sayfa içi kutuyla hem arka plan bildirimiyle çalar, bu yüzden
  // ikisinin de çağırdığı tek yerde durur.
  const sesiCal = useCallback((tur: BehaviorType) => {
    if (!sesAcikRef.current || !sesBaglami.current) return;
    sesCal(sesBaglami.current, tur);
    window.__tahtaSesSayaci = (window.__tahtaSesSayaci ?? 0) + 1;
  }, []);

  // Sıradaki bildirimi gösterir; yalnızca ref'lere dokunduğu için bileşen
  // yeniden render olsa bile davranışı değişmez (bayat closure sorunu yok).
  const siradakiniGoster = useCallback(
    function goster() {
      if (gosteriliyor.current) return;
      const olay = kuyruk.current.shift();
      if (!olay) return;

      gosteriliyor.current = true;
      setGosterilen(olay);
      sesiCal(olay.tur);

      // Süre olay türünden gelir: kart, yıldızdan uzun durur. Sıra uzunluğu
      // KUYRUKTAN OKUNUR, çünkü bu olay zaten `shift` ile çıkarıldı --
      // kalanlar gerçekten bekleyenlerdir.
      setTimeout(() => {
        gosteriliyor.current = false;
        setGosterilen(null);
        goster();
      }, bildirimSuresi(olay.tur, kuyruk.current.length));
    },
    [sesiCal],
  );

  // Sekme arka plandayken: sayfa içi kutu görünmez olduğundan kuyruğa hiç
  // girilmez. Girseydi iki sorun çıkardı -- kutuyu sıraya sokan `setTimeout`
  // gizli sekmede dakikada bire kısıtlanır, ve öğretmen sekmeye döndüğünde
  // ders boyunca birikmiş bildirimler arka arkaya patlardı.
  const arkaPlandaDuyur = useCallback(
    (olay: Olay) => {
      sesiCal(olay.tur);
      const metin = bildirimMetni(olay.tur, olay.ogrenciAdi, sablon);
      // Sesimiz çalabiliyorsa işletim sistemi sesi susturulur; çalamıyorsa
      // tek uyarı işletim sisteminin sesidir, açık bırakılır.
      // Arka planda kuyruk kullanılmıyor, sıra baskısı da yok: her olay
      // kendi tam süresini alır.
      const sure = bildirimSuresi(olay.tur, 0);
      // Tahta penceresi açıksa işletim sistemi bildirimi GÖNDERİLMEZ: ikisi de
      // arka plan kanalı, ikisi birden çıkarsa aynı olay iki kez duyurulur.
      // Pencere zaten daha büyük ve her zaman üstte.
      if (pipAcik) return;
      if (metin && bildirimGoster(metin, sesAcikRef.current, sure)) {
        window.__tahtaBildirimSayaci = (window.__tahtaBildirimSayaci ?? 0) + 1;
      }
    },
    [sablon, sesiCal, pipAcik],
  );

  // Tahta penceresine olayı basar ve süresi dolunca temizler.
  // Zamanlayıcı PENCERENİN KENDİSİNDEN kurulur: pencere her zaman görünür
  // olduğu için oradaki `setTimeout` arka plan kısıtlamasına uğramaz.
  const pipGoster = useCallback(
    (olay: Olay) => {
      if (!pipPenceresi) return;
      if (pipZamanlayici.current !== null) {
        pipPenceresi.clearTimeout(pipZamanlayici.current);
      }
      setPipOlayi({ tur: olay.tur, ogrenciAdi: olay.ogrenciAdi });
      pipZamanlayici.current = pipPenceresi.setTimeout(() => {
        setPipOlayi(null);
        pipZamanlayici.current = null;
      }, bildirimSuresi(olay.tur, 0));
    },
    [pipPenceresi],
  );

  // Pencereyi öğretmen kapatınca (ya da tarayıcı kapatınca) durum geri alınır:
  // aksi halde yoklama kapalı bir pencerenin zamanlayıcısına bağlı kalırdı.
  useEffect(() => {
    if (!pipPenceresi) return;
    const kapandi = () => {
      setPipPenceresi(null);
      setPipOlayi(null);
      pipZamanlayici.current = null;
    };
    pipPenceresi.addEventListener("pagehide", kapandi);
    return () => pipPenceresi.removeEventListener("pagehide", kapandi);
  }, [pipPenceresi]);

  // Tahta modu kapatılırsa pencere de kapanır: yoklama durduğu için pencere
  // açık kalsa ders boyunca donmuş bir ekran gösterirdi.
  useEffect(() => {
    if (!etkin && pipPenceresi) pipPenceresi.close();
  }, [etkin, pipPenceresi]);

  // İmleç HİÇBİR ZAMAN geri ya da ileri atlatılmaz; yalnızca sunucunun
  // döndürdüğü değerle ilerler. Ders değişiminde sıfırlayan bir effect
  // vardı; kaldırıldı çünkü `router.refresh()` sunucudan taze bir
  // `baslangicZamani` getiriyor ve imleç ona çekilseydi, tazeleme ile bir
  // sonraki yoklama arasına düşen olaylar hiç görünmezdi. Ders kimliğini
  // imleç değil `izlenenDers` takip eder.

  useEffect(() => {
    // `dersId` KOŞUL DEĞİL: tahta ders başlamadan açılıp kilitlenir, dersin
    // başladığını ancak yoklayarak öğrenebilir. Burada ders şartı arandığı
    // sürece ders yokken açılan tahta hiç yoklamıyor, dolayısıyla dersin
    // başladığını hiç öğrenemiyordu.
    if (!etkin) return;

    async function yokla() {
      // ARKA PLANDA DA YOKLAR. Burada `visibilityState !== "visible"` ise
      // duran bir kontrol vardı; gerekçesi pil ve ağ tasarrufuydu ve telefon
      // için doğruydu. Ama bu döngü zaten YALNIZCA tahta modunda çalışıyor
      // (yukarıdaki `if (!etkin) return`): tahta prize takılı, ve öğretmen
      // tahtada başka bir uygulamaya geçtiği anda -- yani tam kartın
      // görünmesi gereken anda -- bildirimler tamamen kesiliyordu.
      //
      // Chrome, 5 dakikadan uzun süre gizli kalan sekmede `setInterval`i
      // dakikada bire indirir. Bu yüzden ses önemli: son 30 saniyede ses
      // çalmış sekme bu kısıtlamadan muaf tutulur.
      if (typeof window !== "undefined") {
        window.__tahtaYoklamaSayaci = (window.__tahtaYoklamaSayaci ?? 0) + 1;
      }
      try {
        const yanit = await fetch(
          `/api/sinif/${sinifId}/canli?sonrasi=${encodeURIComponent(sonKontrol.current)}`,
        );
        if (!yanit.ok) return;
        const veri: { dersId: string | null; olaylar: Olay[]; sonKontrol: string | null } =
          await yanit.json();

        // Ders başladı, bitti ya da yenisi açıldı. Olaylar ATILMAZ: yeni
        // dersin imleçten sonraki kayıtları zaten gösterilmesi gerekenler.
        const dersDegisti = veri.dersId !== izlenenDers.current;
        if (dersDegisti) izlenenDers.current = veri.dersId;

        if (veri.sonKontrol) sonKontrol.current = veri.sonKontrol;
        if (veri.olaylar.length > 0) {
          // Tahta penceresi görünürlükten BAĞIMSIZ: her zaman üstte durduğu
          // için sekme önde de olsa arkada da aynı şekilde güncellenir.
          for (const olay of veri.olaylar) pipGoster(olay);

          if (document.visibilityState === "visible") {
            kuyruk.current.push(...veri.olaylar);
            siradakiniGoster();
          } else {
            for (const olay of veri.olaylar) arkaPlandaDuyur(olay);
          }
        }

        // Bildirim geçicidir; altındaki liste (kimde kaç yıldız, kartı ne
        // renkte) sayfa yüklendiği andaki hâlinde donuk kalırdı. Tahta bir
        // ilan panosu gibi açık dururken sınıfın oradan okuduğu şey bu
        // liste, o yüzden olay geldikçe tazelenir. Ders değişiminde de
        // tazelenir: ekranın "Aktif ders yok"tan derse geçmesi buna bağlı.
        // Boş yoklamada çağrılmaz, sunucuya boşuna iş çıkmasın.
        if (dersDegisti || veri.olaylar.length > 0) router.refresh();
      } catch {
        // Ağ hatası: bir sonraki yoklamada tekrar denenir, sessizce geçilir.
      }
    }

    // ZAMANLAYICIYI KİM KURUYOR ÖNEMLİ. Tahta penceresi açıksa onun
    // üzerinden kurulur: o pencere her zaman görünür olduğu için Chrome'un
    // "5 dakikadır gizli sekmede dakikada bir uyandır" kısıtlaması ona
    // işlemez. Pencere yoksa eskisi gibi sayfanın kendi zamanlayıcısı.
    const sahip: Window = pipPenceresi ?? window;
    const zamanlayici = sahip.setInterval(yokla, YOKLAMA_ARALIGI_MS);
    return () => sahip.clearInterval(zamanlayici);
  }, [etkin, sinifId, router, siradakiniGoster, arkaPlandaDuyur, pipGoster, pipPenceresi]);

  // Tek dokunuş iki izni birden açar: ses bağlamı ancak kullanıcı
  // dokunuşuyla açılabilir, bildirim izni de öyle. Tahtada ders başında
  // iki ayrı düğmeye basmaktansa tek düğme doğru.
  async function sesVeBildirimiAc() {
    if (!sesBaglami.current) sesBaglami.current = new AudioContext();
    await sesBaglami.current.resume();
    setSesAcik(true);
    // İzin reddedilse bile ses açılmış olur; bu yüzden sonucu beklemek
    // düğmenin durumunu değiştirmez.
    await bildirimIzniIste();
  }

  async function tahtaPenceresiniAc() {
    const olcu = PIP_BOYUTLARI[pipBoyutu];
    const pencere = await pipAc(olcu.genislik, olcu.yukseklik);
    if (pencere) setPipPenceresi(pencere);
  }

  // Düğmeye basmak KULLANICI DOKUNUŞUDUR; `resizeTo` bunu şart koşuyor.
  // Pencere açık değilse yalnızca tercih kaydedilir, bir sonraki açılışta
  // kullanılır.
  function pipBoyutunuSec(anahtar: PipBoyutAnahtari) {
    setPipBoyutu(anahtar);
    try {
      window.localStorage.setItem(PIP_BOYUT_ANAHTARI, anahtar);
    } catch {
      // Yazılamazsa seçim yalnızca bu oturum için geçerli olur.
    }
    const olcu = PIP_BOYUTLARI[anahtar];
    if (pipPenceresi) pipBoyutlandir(pipPenceresi, olcu.genislik, olcu.yukseklik);
  }

  function moduDegistir() {
    const yeni = !etkin;
    setSecim(yeni);
    secimiYaz(yeni);
  }

  const gorunum = gosterilen ? OLAY_GORUNUMU[sablon][gosterilen.tur] : undefined;

  return (
    <>
      {/* Bildirim düğme yığınının İÇİNDE DEĞİL: düğmeler sağ altta öğretmenin
          işidir, bildirim ise sınıfın görmesi için ekranın üstünde durur. */}
      {etkin && gosterilen && gorunum && (
        <div
          className={
            buyukGosterilir(gosterilen.tur)
              ? "canli-bildirim canli-bildirim-vurgulu"
              : "canli-bildirim"
          }
          role="status"
          aria-live="polite"
        >
          <span className="canli-bildirim-simge" aria-hidden="true">
            {gorunum.yazi}
          </span>
          <span className="canli-bildirim-metin">
            {gosterilen.ogrenciAdi} {gorunum.etiket}
          </span>
        </div>
      )}

      <div className="canli-yayin">
        {!kilitli && (
          <button type="button" className="canli-mod-dugmesi" onClick={moduDegistir}>
            {etkin ? "🖥 Tahta modu açık" : "🖥 Tahta modu"}
          </button>
        )}

        {etkin && (
          <button
            type="button"
            className="canli-ses-dugmesi"
            onClick={sesVeBildirimiAc}
            disabled={sesAcik}
          >
            {sesAcik ? "🔔 Ses ve bildirim açık" : "🔈 Ses ve bildirimi aç"}
          </button>
        )}

        {/* Yalnızca destekleyen tarayıcıda (Chrome/Edge masaüstü) görünür;
            Firefox ve Safari'de düğme hiç çıkmaz, boşuna umut vermesin. */}
        {etkin && pipVar && !pipAcik && (
          <button type="button" className="canli-pip-dugmesi" onClick={tahtaPenceresiniAc}>
            📺 Tahta penceresini aç
          </button>
        )}

        {/* Boyut düğmeleri yalnızca pencere açıkken. Kenardan sürükleyerek de
            boyutlandırılabiliyor ama akıllı tahtada parmakla kenar yakalamak
            zor; bu tek dokunuş. Chrome boyutu hatırladığı için bir kez
            seçmek yetiyor. */}
        {etkin && pipAcik && (
          <div className="canli-pip-boyut">
            <span className="soluk">Pencere:</span>
            {(Object.keys(PIP_BOYUTLARI) as PipBoyutAnahtari[]).map((anahtar) => (
              <button
                key={anahtar}
                type="button"
                className={
                  anahtar === pipBoyutu
                    ? "canli-pip-olcu canli-pip-olcu-secili"
                    : "canli-pip-olcu"
                }
                aria-pressed={anahtar === pipBoyutu}
                onClick={() => pipBoyutunuSec(anahtar)}
              >
                {PIP_BOYUTLARI[anahtar].ad}
              </button>
            ))}
          </div>
        )}
      </div>

      {pipPenceresi && (
        <TahtaPenceresi
          pencere={pipPenceresi}
          olay={pipOlayi}
          sablon={sablon}
          sinifAdi={sinifAdi}
          dersYazisi={dersYazisi}
        />
      )}
    </>
  );
}
