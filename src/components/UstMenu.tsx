import Link from "next/link";
import { CikisDugmesi } from "@/components/CikisDugmesi";

// Uygulamanın üst sekmeleri. Ödevler artık sınıfın altında değil kendi
// başına bir bölüm: öğretmen ödevi sınıftan bağımsız verir ve birden fazla
// sınıfa aynı anda atayabilir.

export function UstMenu({ aktif }: { aktif: "siniflar" | "odevler" | "ayarlar" }) {
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
