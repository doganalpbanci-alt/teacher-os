import Link from "next/link";
import { UstMenu } from "@/components/UstMenu";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { tumVeliMesajlari } from "@/lib/parent-message";
import { dersTarihiYazisi } from "@/lib/lesson";
import { VeliTaslakIslemleri } from "@/components/VeliTaslakIslemleri";

export const dynamic = "force-dynamic";

// Mesaj metni burada tam gösterilmez; uzun bir mesaj listeyi bozar. Tamamı
// öğrenci sayfasındaki geçmişte ya da bağlantıya tıklanınca görülür.
const ONIZLEME_SINIRI = 80;

function onizleme(metin: string): string {
  return metin.length > ONIZLEME_SINIRI ? `${metin.slice(0, ONIZLEME_SINIRI)}…` : metin;
}

export default async function VeliSayfasi() {
  const ogretmen = await getCurrentTeacher();
  const mesajlar = await tumVeliMesajlari(ogretmen.id);

  return (
    <>
      <UstMenu aktif="veli" />

      <main className="kart">
        <div className="sayfa-basi">
          <h1>Veli</h1>
          <Link className="baglanti" href="/veli/yeni">
            + Yeni mesaj
          </Link>
        </div>

        {mesajlar.length === 0 ? (
          <p className="soluk">
            Henüz mesaj yok. Yukarıdaki bağlantıdan bir öğrenci seçip ilk mesajınızı
            yazın.
          </p>
        ) : (
          <ul className="liste">
            {mesajlar.map((mesaj) => (
              <li key={mesaj.id}>
                <div className="satir satir-durgun">
                  <Link className="satir-ad" href={`/ogrenci/${mesaj.ogrenciId}`}>
                    {mesaj.ogrenciAdi}
                    <span className="soluk odev-tarih">
                      {onizleme(mesaj.body)}
                    </span>
                  </Link>
                  <span className="satir-sag">
                    <span className="rozet">{dersTarihiYazisi(mesaj.createdAt)}</span>
                    {mesaj.status === "SENT" ? (
                      <span className="teslim-rozet t-done">Gönderildi</span>
                    ) : (
                      <>
                        <span className="teslim-rozet t-pending">Taslak</span>
                        <VeliTaslakIslemleri
                          mesajId={mesaj.id}
                          mesaj={mesaj.body}
                          parentPhone={mesaj.parentPhone}
                        />
                      </>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
