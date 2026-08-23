import { redirect } from "next/navigation";
import { kurulumTamamlandiMi } from "@/lib/auth";
import { KurulumFormu } from "@/components/KurulumFormu";

export const dynamic = "force-dynamic";

export default async function KurulumSayfasi() {
  // Kurulum bir kez yapılır. Tamamlandıysa bu sayfa kapanır, aksi halde
  // herkes kendine hesap açabilirdi.
  if (await kurulumTamamlandiMi()) redirect("/giris");

  return (
    <main className="kart">
      <h1>İlk hesabı oluşturun</h1>
      <p className="soluk">
        Bu adım bir kez yapılır. Girdiğiniz e-posta yalnızca giriş için
        kullanılır, hiçbir yere gönderilmez. Mevcut sınıflarınız ve tüm
        geçmişiniz bu hesaba bağlanır.
      </p>
      <KurulumFormu />
    </main>
  );
}
