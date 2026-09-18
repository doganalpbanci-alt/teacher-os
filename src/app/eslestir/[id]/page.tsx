import Link from "next/link";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { eslesmeyiGetir } from "@/lib/pairing";
import { EslesmeOnayi } from "@/components/EslesmeOnayi";

export const dynamic = "force-dynamic";

// Telefonun QR'ı okuttuktan sonra açtığı sayfa.
//
// Oturum ZORUNLU (`getCurrentTeacher` yoksa girişe yönlendirir) ve koruma
// asıl buradan geliyor: QR'ı fotoğraflayan bir öğrenci bu adresi açabilir ama
// giriş yapamadığı için onaylayamaz. Onaylasa bile oturumu alamazdı --
// tahtanın gizli çerezi onda yok.

export default async function EslestirSayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ogretmen = await getCurrentTeacher();
  const eslesme = await eslesmeyiGetir(id);

  const gecersizMesaji =
    eslesme === null
      ? "Bu eşleşme bulunamadı."
      : eslesme.durum === "SURESI_DOLDU"
        ? "Bu QR'ın süresi doldu."
        : eslesme.durum === "KULLANILDI"
          ? "Bu QR zaten kullanıldı."
          : eslesme.durum === "ONAYLANDI"
            ? "Bu QR zaten onaylandı."
            : null;

  return (
    <main className="kart qr-sayfasi">
      <h1>Tahtada oturum aç</h1>
      <p className="soluk">
        {ogretmen.name} hesabıyla, QR'ı gösteren cihazda oturum açılacak.
      </p>

      {gecersizMesaji ? (
        <>
          <p className="uyari">{gecersizMesaji}</p>
          <p className="soluk">Tahtada yeni bir QR oluşturup tekrar okutun.</p>
          <Link className="baglanti" href="/">
            Ana sayfaya dön
          </Link>
        </>
      ) : (
        <EslesmeOnayi eslesmeId={eslesme!.id} kod={eslesme!.code} />
      )}
    </main>
  );
}
