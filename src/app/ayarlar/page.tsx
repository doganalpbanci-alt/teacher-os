import Link from "next/link";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { SablonFormu } from "@/components/SablonFormu";

export const dynamic = "force-dynamic";

export default async function AyarlarSayfasi() {
  const ogretmen = await getCurrentTeacher();

  return (
    <>
      <Link className="geri" href="/">
        ← Sınıflarım
      </Link>

      <main className="kart">
        <h1>Ayarlar</h1>
        <h2>Davranış sistemi</h2>
        <p className="soluk">
          Ders içinde hangi düğmeleri kullanacağınızı ve performans notunun
          nasıl belirleneceğini seçer. Bütün sınıflarınızda geçerli olur.
          Geçmiş kayıtlar sistem değiştirdiğinizde silinmez.
        </p>
        <SablonFormu secili={ogretmen.behaviorTemplate} />
      </main>
    </>
  );
}
