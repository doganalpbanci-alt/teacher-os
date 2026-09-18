import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode-svg";
import { oturumdakiOgretmenId } from "@/lib/auth";
import { eslesmeyiGetir } from "@/lib/pairing";
import { cereziCoz, ESLESME_CEREZI, GECERLILIK_SANIYE } from "@/lib/pairing-rules";
import { qrOlustur } from "@/app/eslestirme-actions";
import { QrEkrani } from "@/components/QrEkrani";

export const dynamic = "force-dynamic";

// Akıllı tahtada parolasız giriş ekranı.
//
// Neden QR sayfada değil EYLEMDE üretiliyor: eşleşmenin gizi tahtanın
// çerezine yazılmalı, sunucu bileşenleri ise çerez yazamaz. Bu yüzden sayfa
// yalnızca çerezdeki eşleşmeyi gösterir; yoksa "QR oluştur" düğmesi çıkar.

/** QR'ın içine gömülecek tam adres. Tahta ile telefon aynı siteyi açmalı. */
async function temelAdres(): Promise<string> {
  const basliklar = await headers();
  const host = basliklar.get("x-forwarded-host") ?? basliklar.get("host") ?? "";
  const protokol = basliklar.get("x-forwarded-proto") ?? "http";
  return `${protokol}://${host}`;
}

function qrSvg(adres: string): string {
  return new QRCode({
    content: adres,
    padding: 1,
    width: 320,
    height: 320,
    color: "#1a1d21",
    background: "#ffffff",
    // Tahtada uzaktan okunacak; yüksek düzeltme seviyesi kirli/parlayan
    // ekranda okumayı kolaylaştırır.
    ecl: "M",
  }).svg();
}

function YenileFormu({ yazi }: { yazi: string }) {
  return (
    <form action={qrOlustur}>
      <button type="submit">{yazi}</button>
    </form>
  );
}

export default async function QrGirisSayfasi() {
  // Zaten giriş yapılmışsa burada işimiz yok.
  if (await oturumdakiOgretmenId()) redirect("/");

  const cerezler = await cookies();
  const cerez = cereziCoz(cerezler.get(ESLESME_CEREZI)?.value);
  const eslesme = cerez ? await eslesmeyiGetir(cerez.id) : null;
  const kullanilabilir =
    eslesme !== null && (eslesme.durum === "BEKLIYOR" || eslesme.durum === "ONAYLANDI");

  return (
    <main className="kart qr-sayfasi">
      <h1>Tahtada giriş</h1>

      {!kullanilabilir ? (
        <>
          <p className="soluk">
            Telefonunuzla okutabileceğiniz bir QR oluşturun. Parolanız ekranda
            hiçbir zaman görünmez.
          </p>
          <YenileFormu yazi="QR oluştur" />
        </>
      ) : (
        <>
          <ol className="qr-adimlar">
            <li>Telefonunuzun kamerasıyla aşağıdaki kodu okutun.</li>
            <li>Telefonda çıkan kodun buradakiyle aynı olduğunu doğrulayın.</li>
            <li>Onaylayın; bu ekran kendiliğinden girer.</li>
          </ol>

          <div
            className="qr-kutu"
            aria-label="Giriş için QR kodu"
            dangerouslySetInnerHTML={{ __html: qrSvg(`${await temelAdres()}/eslestir/${eslesme.id}`) }}
          />

          <p className="qr-kod-etiket">Doğrulama kodu</p>
          <p className="qr-kod">{eslesme.code}</p>

          <QrEkrani eslesmeId={eslesme.id} />

          <p className="soluk qr-not">
            QR {Math.round(GECERLILIK_SANIYE / 60)} dakika geçerlidir.
          </p>
          <YenileFormu yazi="Yeni QR oluştur" />
        </>
      )}

      <Link className="baglanti" href="/giris">
        ← Parolayla giriş
      </Link>
    </main>
  );
}
