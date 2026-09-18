// Giriş sonrası dönülecek adres.
//
// QR akışı olmadan da gerekiyordu ama onunla zorunlu hâle geldi: öğretmen
// QR'ı okuttuğunda telefonunun oturumu kapanmışsa giriş sayfasına düşer ve
// orada kalırdı — onay sayfasına bir daha dönemez, akış sessizce çıkmaza
// girerdi.
//
// AÇIK YÖNLENDİRME (open redirect) KORUMASI: `devam` adres çubuğundan gelen,
// yani saldırganın yazabildiği bir değerdir. Yalnızca bu sitenin içindeki bir
// yola izin verilir; başka her şey ana sayfaya düşer. Aksi hâlde giriş
// sayfası, kullanıcıyı başka bir siteye taşıyan bir sıçrama tahtası olurdu.
//
// Bu dosya Edge'de de çalışır (middleware onu oradan okur): prisma ve bcrypt
// buraya girmez.

export const VARSAYILAN_YOL = "/";

export function guvenliDevamYolu(devam: string | null | undefined): string {
  if (!devam) return VARSAYILAN_YOL;

  // Tek eğik çizgiyle başlamayan her şey dışarıyı gösterebilir:
  // "https://baska.site", "//baska.site" (protokole göre değişen adres) ve
  // "javascript:..." bunların hepsi elenir.
  if (!devam.startsWith("/")) return VARSAYILAN_YOL;
  if (devam.startsWith("//")) return VARSAYILAN_YOL;

  // Ters eğik çizgiyi bazı tarayıcılar eğik çizgi gibi okur; "/\baska.site"
  // protokole göre değişen adrese dönüşebilir.
  if (devam.startsWith("/\\")) return VARSAYILAN_YOL;

  // Satır sonu ve denetim karakterleri başlık enjeksiyonu için kullanılabilir.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(devam)) return VARSAYILAN_YOL;

  // Giriş sayfasının kendisine dönmek döngü demek.
  if (devam === "/giris" || devam.startsWith("/giris/")) return VARSAYILAN_YOL;

  return devam;
}
