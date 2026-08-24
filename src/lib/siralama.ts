// Türkçe alfabe sıralaması.
//
// Veritabanının kendi sıralaması Türkçe harfleri tanımaz: Ç, Ğ, İ, Ö, Ş, Ü
// ile başlayan isimler listenin sonuna düşer ve öğretmen ders sırasında
// öğrenciyi olması gereken yerde bulamaz. Bir sınıf kadar küçük listelerde
// sıralamayı uygulamada yapmak hem doğru hem ucuz.
export function turkceSirala<T>(kayitlar: T[], anahtar: (kayit: T) => string): T[] {
  return [...kayitlar].sort((a, b) => anahtar(a).localeCompare(anahtar(b), "tr"));
}
