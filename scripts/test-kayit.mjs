// Kayıt bekleme.
//
// Ders ekranında kart şablonunda satırın görünür metni değişmez: puan
// kaldırıldı, kart durumu renkle gösteriliyor. Bu yüzden testler "satır
// metni değişti" yerine kaydın veritabanına düştüğünü bekler; bu hem kart
// hem basit şablonda çalışır.
export function kayitBekleyici(sql, sayfa) {
  const sayim = () => Number(sql(`SELECT count(*) FROM "BehaviorLog";`));

  return async function kayitBekle(tiklama) {
    const once = sayim();
    await tiklama();
    for (let i = 0; i < 60; i++) {
      if (sayim() > once) break;
      await sayfa.waitForTimeout(200);
    }
    // Kayıt düştü; sayfanın tazelenmesi için kısa bir pay.
    await sayfa.waitForTimeout(400);
  };
}
