import Link from "next/link";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { PipOlcumu } from "@/components/PipOlcumu";

export const dynamic = "force-dynamic";

// GEÇİCİ TANI SAYFASI. Ürünün parçası değil, menüde de yok.
//
// Cevaplaması gereken tek soru: akıllı tahtada üstüne PowerPoint açıldığında
// tarayıcı zamanlayıcıyı kısıyor mu? Cevap "kısmıyor" ise canlı bildirimleri
// her zaman üstte duran bir PiP penceresine taşıyabiliriz; "kısıyor" ise o
// yol kapalı demektir ve bir oturumluk emek boşa gitmeden anlaşılmış olur.
//
// Ölçüm bittiğinde bu sayfa ve PipOlcumu bileşeni silinir.
export default async function TahtaTestiSayfasi() {
  await getCurrentTeacher();

  return (
    <>
      <Link className="geri" href="/">
        ← Sınıflarım
      </Link>

      <main className="kart">
        <h1>Tahta ölçümü (geçici)</h1>
        <p className="soluk">
          Bu sayfa bir deneme aracı, uygulamanın parçası değil. Amacı tek bir
          şeyi ölçmek: tahtada üstüne başka bir uygulama açıldığında tarayıcı
          arka plandaki sayaçları durduruyor mu?
        </p>

        <h2>Nasıl yapılır</h2>
        <ol className="soluk">
          <li>Bu sayfayı akıllı tahtanın kendi tarayıcısında aç.</li>
          <li>Aşağıdaki düğmeye bas — küçük, hep üstte duran bir pencere açılır.</li>
          <li>Üstüne PowerPoint (ya da ne kullanacaksan) aç ve <b>5 dakika</b> ders anlatır gibi bırak.</li>
          <li>Küçük pencereye bak: üç sayı birbirine yakın mı?</li>
        </ol>

        <PipOlcumu />

        <h2>Sonucu nasıl okurum</h2>
        <p className="soluk">
          5 dakika ≈ <b>150 tik</b> demek. Küçük penceredeki üç sayıyı karşılaştır:
        </p>
        <ul className="soluk">
          <li>
            <b>PiP tik ≈ Beklenen</b> → yol açık. Canlı bildirimleri bu pencereye
            taşıyabiliriz, PowerPoint önde iken bile çalışır.
          </li>
          <li>
            <b>PiP tik çok geride</b> (örneğin 150 yerine 5) → tarayıcı kısıyor.
            O zaman bu yol kapalı, bölünmüş ekranda kalırız.
          </li>
          <li>
            <b>Ana sekme tik</b> kıyas noktası: onun geride kalması normal, asıl
            önemli olan PiP sayacı.
          </li>
        </ul>
        <p className="soluk">
          Bip sesleri 20 saniyede bir gelir; sayılara bakmadan da kulakla takip
          edebilirsin. Sonucu bana söylersen devamını ona göre kurarım.
        </p>
      </main>
    </>
  );
}
