import { redirect } from "next/navigation";
import { kurulumTamamlandiMi, oturumdakiOgretmenId } from "@/lib/auth";
import { guvenliDevamYolu } from "@/lib/devam-yolu";
import { GirisFormu } from "@/components/GirisFormu";
import { qrOlustur } from "@/app/eslestirme-actions";

export const dynamic = "force-dynamic";

export default async function GirisSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ devam?: string }>;
}) {
  // Henüz hesap yoksa giriş denemek anlamsız; kuruluma yönlendirilir.
  if (!(await kurulumTamamlandiMi())) redirect("/kurulum");

  const { devam } = await searchParams;
  // Adres çubuğundan gelen değer daha ekrana konmadan süzülür; sunucu
  // eylemi de ayrıca doğrular.
  const guvenliDevam = guvenliDevamYolu(devam);

  if (await oturumdakiOgretmenId()) redirect(guvenliDevam);

  return (
    <main className="kart">
      <h1>Teacher OS</h1>
      <p className="soluk">Devam etmek için giriş yapın.</p>
      <GirisFormu devam={guvenliDevam} />

      {/* Akıllı tahtada parola yazmamak için: QR'ı telefondan okutup
          onaylarsınız, parola ekranda hiç görünmez. */}
      <form className="qr-giris-formu" action={qrOlustur}>
        <button type="submit">QR ile gir (akıllı tahta)</button>
      </form>
    </main>
  );
}
