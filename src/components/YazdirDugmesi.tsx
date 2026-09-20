"use client";

// Rapordaki "Yazdır / PDF" düğmesi.
//
// Ayrı bir PDF üretici yok: tarayıcının kendi yazdırma penceresi açılır ve
// oradan yazıcıya ya da "PDF olarak kaydet"e gidilir. Tablette de çalışır.
//
// Düğme GEREKLİ, sayfanın yazdırılabilir olması yetmiyor: tarayıcıların
// yazdır seçeneği menülerin içinde gömülü (Android'de Paylaş → Yazdır,
// iOS'ta Paylaş → Yazdır) ve öğretmen raporu açtığında onu aramak zorunda
// kalıyordu. Bu gerçekten oldu.
//
// Kendisi de yazdırmada gizlenir: kağıda düşen belgede düğme olmaz.

export function YazdirDugmesi() {
  return (
    <button
      type="button"
      className="yazdir-dugmesi yazdirma-gizle"
      onClick={() => window.print()}
    >
      🖨 Yazdır / PDF
    </button>
  );
}
