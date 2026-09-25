// Tahta penceresi: Chrome'un Document Picture-in-Picture penceresi.
//
// NEDEN: işletim sistemi bildirimi çalışıyor ama görünümünü biz
// belirleyemiyoruz -- Windows onu köşede, kendi boyutunda gösteriyor.
// Sınıfın arkasından okunacak bir uyarı için bu yetmiyor. PiP penceresi
// HER ZAMAN ÜSTTE durur ve içeriğini tamamen biz yazarız; öğretmen tahtada
// sunuma geçse bile pencere görünmeye devam eder.
//
// İKİ KAZANÇ VAR, ikincisi daha az belli:
//  1. Görünüm bizde: büyük punto, olaya göre renk.
//  2. Pencere AYRI BİR DOKÜMAN ve her zaman görünür (`visibilityState`
//     hep "visible"). Yoklama zamanlayıcısını bu pencereden kurunca,
//     arka plandaki sekmeye uygulanan "5 dakika sonra dakikada bir"
//     kısıtlaması yoklamayı yavaşlatmaz.
//
// SINIRLAR, bilerek yazıyorum:
//  - Yalnızca Chrome/Edge masaüstü. Firefox ve Safari'de yok; `pipAcilabilir`
//    false döner ve düğme hiç görünmez.
//  - Kullanıcı dokunuşu şart, kendiliğinden açılamaz. Her ders başında
//    öğretmen bir kez basar.
//  - Sayfa gerçekten başka bir adrese giderse pencere kapanır.
//    `router.refresh()` gezinme sayılmaz, pencere ayakta kalır.

type PipApi = {
  requestWindow: (secenekler: { width: number; height: number }) => Promise<Window>;
};

function pipApi(): PipApi | null {
  if (typeof window === "undefined") return null;
  const api = (window as unknown as { documentPictureInPicture?: PipApi })
    .documentPictureInPicture;
  return api ?? null;
}

export function pipAcilabilir(): boolean {
  return pipApi() !== null;
}

/**
 * PiP penceresinin kendi stil sayfası. Sayfanın CSS'i buraya MİRAS KALMAZ:
 * ayrı bir doküman, `globals.css` orada yok. Bu yüzden gereken her şey
 * burada, kendi başına duracak şekilde yazılı.
 */
const STIL = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    text-align: center;
    overflow: hidden;
    transition: background-color 0.15s ease-out;
  }
  .pip-kutu {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    width: 100%;
    padding: 0.75rem;
  }
  /* Punto pencereyle birlikte büyür: öğretmen pencereyi büyüttüğünde yazı da
     büyümeli. clamp(taban, tercih, tavan) -- tercih hem genişliğe hem
     YÜKSEKLİĞE bakar, yoksa geniş ama alçak bir pencerede yazı taşardı.
     Sade min(9vw, 5rem) yazılsaydı tavan hep kazanır, büyütmek işe
     yaramazdı; taban da olmazdı ve pencere daraldıkça yazı okunmaz olurdu. */
  .pip-ad {
    font-size: clamp(1.75rem, min(9vw, 26vh), 5rem);
    font-weight: 800;
    line-height: 1.1;
  }
  .pip-etiket {
    font-size: clamp(1rem, min(5vw, 14vh), 2.5rem);
    font-weight: 600;
    opacity: 0.92;
  }
  .pip-bos-baslik {
    font-size: clamp(1.5rem, min(8vw, 24vh), 4rem);
    font-weight: 700;
  }
  .pip-bos-alt {
    font-size: clamp(0.875rem, min(4vw, 12vh), 1.75rem);
    opacity: 0.7;
  }
`;

/**
 * Pencereyi açar. KULLANICI DOKUNUŞUNDAN çağrılmalı.
 * Açılamazsa `null` -- çağıran taraf buna takılmaz, diğer kanallar
 * (sayfa içi kutu, işletim sistemi bildirimi) zaten çalışıyor.
 *
 * `preferInitialWindowPlacement` BİLEREK VERİLMİYOR: verilmediğinde Chrome
 * pencereyi öğretmenin bıraktığı boyut ve KONUMDA açar. Konumu site zaten
 * belirleyemiyor; tek yolu bu hafıza. Yani buradaki ölçü ilk açılışta (ya da
 * temiz bir profilde) geçerli.
 */
export async function pipAc(genislik: number, yukseklik: number): Promise<Window | null> {
  const api = pipApi();
  if (!api) return null;
  try {
    const pencere = await api.requestWindow({ width: genislik, height: yukseklik });
    const stil = pencere.document.createElement("style");
    stil.textContent = STIL;
    pencere.document.head.appendChild(stil);
    return pencere;
  } catch {
    // Kullanıcı vazgeçti, tarayıcı reddetti ya da zaten açık bir pencere var.
    return null;
  }
}

/**
 * Açık pencereyi yeniden boyutlandırır.
 *
 * `resizeTo` PiP penceresinde çalışır ama KULLANICI DOKUNUŞU ister; bu yüzden
 * yalnızca düğme tıklamasından çağrılmalı. Chrome çok küçük ya da çok büyük
 * değerleri kendi sınırlarına çeker, bu normaldir.
 */
export function pipBoyutlandir(pencere: Window, genislik: number, yukseklik: number): void {
  try {
    pencere.resizeTo(genislik, yukseklik);
  } catch {
    // Tarayıcı reddederse pencere olduğu gibi kalır; öğretmen kenardan
    // sürükleyerek yine boyutlandırabilir.
  }
}
