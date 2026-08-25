import Link from "next/link";
import { CikisDugmesi } from "@/components/CikisDugmesi";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { gundemSayisi } from "@/lib/assignment";

// Uygulamanın üst sekmeleri. Ödevler artık sınıfın altında değil kendi
// başına bir bölüm: öğretmen ödevi sınıftan bağımsız verir ve birden fazla
// sınıfa aynı anda atayabilir.
//
// Sayacı menü kendi çeker: hangi sayfada olursa olsun aynı sayı görünsün ve
// her sayfaya ayrı ayrı taşınması gerekmesin. Tek bir count sorgusu.

export async function UstMenu({
  aktif,
}: {
  aktif: "siniflar" | "odevler" | "ayarlar";
}) {
  const ogretmen = await getCurrentTeacher();
  const bekleyen = await gundemSayisi(ogretmen.id);

  return (
    <nav className="ust-menu">
      <span className="ust-menu-baglantilar">
        <Link
          className={`ust-sekme${aktif === "siniflar" ? " secili" : ""}`}
          href="/"
          aria-current={aktif === "siniflar" ? "page" : undefined}
        >
          Sınıflarım
        </Link>
        <Link
          className={`ust-sekme${aktif === "odevler" ? " secili" : ""}`}
          href="/odevler"
          aria-current={aktif === "odevler" ? "page" : undefined}
        >
          Ödevler
          {bekleyen > 0 && (
            <span className="sekme-sayac" aria-label={`${bekleyen} ödev kontrol bekliyor`}>
              {bekleyen}
            </span>
          )}
        </Link>
        <Link
          className={`ust-sekme${aktif === "ayarlar" ? " secili" : ""}`}
          href="/ayarlar"
          aria-current={aktif === "ayarlar" ? "page" : undefined}
        >
          Ayarlar
        </Link>
      </span>
      <CikisDugmesi />
    </nav>
  );
}
