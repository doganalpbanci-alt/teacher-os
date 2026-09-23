import { ekranaSabitlenmeli, type BildirimMetni } from "./board-rules";

// Tahtanın işletim sistemi seviyesindeki bildirimi.
//
// NEDEN SAYFA İÇİ KUTU YETMİYOR: `.canli-bildirim` sayfanın İÇİNDE duruyor.
// Tarayıcı arka plandayken -- tahtada sunum, PDF ya da başka bir uygulama
// öndeyken -- o kutuyu kimse görmez. Öğrenciyi uyarmanın işe yaraması için
// bildirimin önde ne varsa onun ÜSTÜNDE çıkması gerekir; bunu ancak
// işletim sistemi bildirimi yapar.
//
// `board-sound.ts` ile aynı ayrımda: tarayıcıya dokunan ince bir katman,
// metin üretimi saf ve ayrı test edilebilir.
//
// Sekme KAPALIYKEN de gelmesi için Service Worker + Web Push gerekir; bu
// dosya sekme açık ama arka plandayken çalışır. İkisi birbirini dışlamaz,
// push sonraki aşama.

/** Tek bir bildirim yeri: art arda verilen kartlar ekranda birikmez, sonuncusu
 *  öncekinin yerini alır -- sayfa içi kutunun da davranışı bu. */
const ETIKET = "teacher-os-tahta";

export function bildirimDesteklenir(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function bildirimVerildiMi(): boolean {
  return bildirimDesteklenir() && Notification.permission === "granted";
}

/**
 * İzin ister. KULLANICI DOKUNUŞUNDAN çağrılmalı: tarayıcılar kendiliğinden
 * açılan izin kutusunu engelliyor. Reddedilmiş izin tekrar sorulamaz, bu
 * yüzden sessizce `false` döner -- çağıran taraf buna takılmaz, sayfa içi
 * kutu ve ses zaten çalışmaya devam eder.
 */
export async function bildirimIzniIste(): Promise<boolean> {
  if (!bildirimDesteklenir()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

/**
 * Bildirimi gösterir; gösterilebildiyse `true`.
 *
 * `sessiz`: kendi 8-bit sesimiz çalabiliyorsa işletim sisteminin kendi sesi
 * susturulur -- iki ses üst üste binmesin. Sesimiz açılmamışsa işletim
 * sisteminin sesi tek uyarı kalır, o yüzden açık bırakılır.
 */
export function bildirimGoster(
  metin: BildirimMetni,
  sessiz: boolean,
  sureMs: number,
): boolean {
  if (!bildirimVerildiMi()) return false;
  try {
    const bildirim = new Notification(metin.baslik, {
      body: metin.govde,
      tag: ETIKET,
      silent: sessiz,
      requireInteraction: ekranaSabitlenmeli(sureMs),
    });
    setTimeout(() => bildirim.close(), sureMs);
    return true;
  } catch {
    // Bazı tarayıcılar sayfa içinden `new Notification`'a izin vermez
    // (yalnızca Service Worker üzerinden). Sessizce geçilir.
    return false;
  }
}
