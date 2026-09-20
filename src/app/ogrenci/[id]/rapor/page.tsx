import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { donemCozumle } from "@/lib/exam-rules";
import { ogrenciRaporu } from "@/lib/report";
import { sinavTarihiYazisi } from "@/lib/exam";
import { odevTarihiYazisi } from "@/lib/assignment";
import { RaporDonemSecici } from "@/components/RaporDonemSecici";
import { YazdirDugmesi } from "@/components/YazdirDugmesi";
import { Gelisim } from "@/components/Gelisim";

export const dynamic = "force-dynamic";

// Öğrenci raporu: veli toplantısında masaya konacak ya da veliye verilecek
// tek belge. Ayrı bir PDF üretici YOK — sayfa yazdırmaya hazır kurulur,
// tarayıcının kendi "yazdır"ı kağıda ya da PDF'e döker. Tablette de çalışır.
//
// Yazdırmada gizlenecek her şey `yazdirma-gizle` sınıfını taşır (menü, geri
// bağlantısı, dönem seçici, yazdır düğmesi); kuralı globals.css'teki
// `@media print` bloğu uygular.

const DURUM_YAZISI: Record<string, string> = {
  DONE: "Yapıldı",
  LATE: "Geç yapıldı",
  MISSING: "Yapılmadı",
  PENDING: "Bekliyor",
};

export default async function RaporSayfasi({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ donem?: string }>;
}) {
  const { id } = await params;
  const { donem } = await searchParams;
  const ogretmen = await getCurrentTeacher();

  const rapor = await ogrenciRaporu(
    id,
    ogretmen.id,
    ogretmen.behaviorTemplate,
    donemCozumle(donem),
  );
  // Öğrenci başkasınınsa ya da hiç kaydı yoksa rapor yok. İkisi de "bulunamadı"
  // sayılır: başkasının öğrencisinin varlığı sızdırılmaz.
  if (!rapor) notFound();

  const d = rapor.davranis;

  return (
    <>
      <div className="yazdirma-gizle rapor-araclar">
        <Link className="geri" href={`/ogrenci/${id}`}>
          ← Öğrenci sayfası
        </Link>
        <div className="rapor-araclar-sag">
          <RaporDonemSecici
            temelAdres={`/ogrenci/${id}/rapor`}
            donemler={rapor.donemler}
            secilen={rapor.secilenDonem}
          />
          <YazdirDugmesi />
        </div>
      </div>

      <main className="kart rapor">
        <header className="rapor-basi">
          <h1>{rapor.ogrenciAdi}</h1>
          <p className="soluk">
            {rapor.sinifAdi ? `${rapor.sinifAdi} · ` : ""}
            {rapor.secilenDonem.etiket}
          </p>
        </header>

        <section className="rapor-bolum">
          <h2>Davranış</h2>
          <div className="olcum-satiri">
            {rapor.kartSistemi ? (
              <>
                <div className="olcum">
                  <span className="olcum-deger">{d.arti}</span>
                  <span className="olcum-etiket">yıldız</span>
                </div>
                <div className="olcum">
                  <span className="olcum-deger">{d.sariKart}</span>
                  <span className="olcum-etiket">sarı kart</span>
                </div>
                <div className="olcum">
                  <span className="olcum-deger">{d.kirmiziKart}</span>
                  <span className="olcum-etiket">kırmızı kart</span>
                </div>
                <div className="olcum">
                  <span className="olcum-deger">{rapor.performansNotu}</span>
                  <span className="olcum-etiket">performans notu</span>
                </div>
              </>
            ) : (
              <>
                <div className="olcum">
                  <span className="olcum-deger">{d.arti}</span>
                  <span className="olcum-etiket">artı</span>
                </div>
                <div className="olcum">
                  <span className="olcum-deger">{d.eksi}</span>
                  <span className="olcum-etiket">eksi</span>
                </div>
                <div className="olcum">
                  <span className="olcum-deger">{rapor.performansNotu}</span>
                  <span className="olcum-etiket">performans notu</span>
                </div>
              </>
            )}
            <div className="olcum">
              <span className="olcum-deger">{d.dersSayisi}</span>
              <span className="olcum-etiket">ders</span>
            </div>
          </div>
          {/* Performans notu DÖNEME değil bugüne aittir: kayıtlardan
              türetilen güncel değerdir, geçmişe dönük hesaplanmaz. */}
          <p className="soluk rapor-not">
            Performans notu güncel değerdir; diğer sayılar seçilen döneme aittir.
          </p>
        </section>

        <section className="rapor-bolum">
          <h2>Sınavlar</h2>
          {rapor.sinavlar.length === 0 ? (
            <p className="soluk">Bu dönemde sınav kaydı yok.</p>
          ) : (
            <>
              <div className="olcum-satiri">
                <div className="olcum">
                  <span className="olcum-deger">
                    {rapor.karneOrtalamasi === null ? "—" : `%${rapor.karneOrtalamasi}`}
                  </span>
                  <span className="olcum-etiket">karne ortalaması</span>
                </div>
                {rapor.denemeOrtalamasi !== null && (
                  <div className="olcum">
                    <span className="olcum-deger">%{rapor.denemeOrtalamasi}</span>
                    <span className="olcum-etiket">deneme ortalaması</span>
                  </div>
                )}
              </div>
              <table className="rapor-tablo">
                <thead>
                  <tr>
                    <th scope="col">Sınav</th>
                    <th scope="col">Tarih</th>
                    <th scope="col">Puan</th>
                    <th scope="col">Sınıf ort.</th>
                  </tr>
                </thead>
                <tbody>
                  {rapor.sinavlar.map((sinav) => (
                    <tr key={sinav.sinavId}>
                      <th scope="row">
                        {sinav.baslik}
                        {sinav.scope === "PRACTICE" && (
                          <span className="soluk"> · deneme</span>
                        )}
                      </th>
                      <td>{sinavTarihiYazisi(sinav.examDate)}</td>
                      <td>
                        {sinav.isAbsent
                          ? "girmedi"
                          : sinav.puan === null
                            ? "—"
                            : `${sinav.puan}/${sinav.maxScore} (%${sinav.yuzde})`}
                      </td>
                      <td>
                        {sinav.sinifOrtalamasiYuzde === null
                          ? "—"
                          : `%${sinav.sinifOrtalamasiYuzde}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>

        <section className="rapor-bolum">
          <h2>Ödevler</h2>
          {rapor.odevler.length === 0 ? (
            <p className="soluk">Bu dönemde ödev kaydı yok.</p>
          ) : (
            <>
              <div className="olcum-satiri">
                <div className="olcum">
                  <span className="olcum-deger">%{rapor.odevSayimlari.oran}</span>
                  <span className="olcum-etiket">tamamlanma</span>
                </div>
                <div className="olcum">
                  <span className="olcum-deger">{rapor.odevSayimlari.toplam}</span>
                  <span className="olcum-etiket">ödev</span>
                </div>
                <div className="olcum">
                  <span className="olcum-deger">{rapor.odevSayimlari.missing}</span>
                  <span className="olcum-etiket">yapılmadı</span>
                </div>
              </div>
              <table className="rapor-tablo">
                <thead>
                  <tr>
                    <th scope="col">Ödev</th>
                    <th scope="col">Son teslim</th>
                    <th scope="col">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {rapor.odevler.map((odev) => (
                    <tr key={odev.odevId}>
                      <th scope="row">{odev.baslik}</th>
                      <td>{odev.dueDate ? odevTarihiYazisi(odev.dueDate) : "—"}</td>
                      <td>{DURUM_YAZISI[odev.status] ?? odev.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>

        {/* Gelişim bloğu öğrenci sayfasındakiyle AYNI bileşen: kural tek
            yerde dursun, rapor ayrı bir "gelişim" tanımı üretmesin. */}
        <div className="rapor-bolum">
          <Gelisim sonuc={rapor.gelisim} sablon={ogretmen.behaviorTemplate} />
        </div>

        <footer className="rapor-alti soluk">
          {rapor.ogretmenAdi} ·{" "}
          {rapor.uretimTarihi.toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </footer>
      </main>
    </>
  );
}
