import Link from "next/link";

export default function NotFound() {
  return (
    <main className="kart">
      <h1>Sayfa bulunamadı</h1>
      <p className="soluk">Aradığınız kayıt silinmiş ya da adres hatalı olabilir.</p>
      <Link className="geri" href="/">
        ← Sınıf listesine dön
      </Link>
    </main>
  );
}
