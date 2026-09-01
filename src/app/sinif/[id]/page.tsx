import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { aktifDersiGetir, dersKisaYazisi } from "@/lib/lesson";
import { dersKartDurumlari, ogrenciSayimlari, type KartDurumu } from "@/lib/behavior";
import { OgrenciFormu } from "@/components/OgrenciFormu";
import { DersKontrolu } from "@/components/DersKontrolu";
import { OgrenciSatiri, type CezaOzeti } from "@/components/OgrenciSatiri";
import { bekleyenCezalar } from "@/lib/penalty";
import { kilitDurumu } from "@/lib/lock";
import { TahtaKilidi } from "@/components/TahtaKilidi";
import { SinifCanliBildirimleri } from "@/components/SinifCanliBildirimleri";
import { turkceSirala } from "@/lib/siralama";
import type { Sayimlar } from "@/lib/behavior";

export const dynamic = "force-dynamic";

export default async function SinifSayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ogretmen = await getCurrentTeacher();

  // Sahiplik her iki sorgunun da parcasi: baskasinin sinifi 404 doner, dersi
  // bos doner. Ikisi birbirini beklemedigi icin ayni anda calisirlar.
  const [sinif, aktifDers] = await Promise.all([
    prisma.classroom.findFirst({
      where: { id, teacherId: ogretmen.id },
      select: {
        id: true,
        name: true,
        // Sıralama Türkçe alfabeye göre aşağıda yapılır; veritabanı
        // sıralaması Ç, Ğ, İ gibi harfleri listenin sonuna atıyor.
        students: {
          where: { isActive: true },
          select: { id: true, firstName: true, lastName: true },
        },
      },
    }),
    aktifDersiGetir(id, ogretmen.id),
  ]);

  if (!sinif) notFound();

  // Tahta kilidi cihaza aittir, sınıfa değil: aynı sınıf telefonda açık,
  // tahtada kilitli olabilir. Kilit başka bir sınıfa aitse middleware zaten
  // buraya bırakmaz; yine de eşleşme aranır, kilit yanlış sınıfı kilitlemesin.
  const kilit = await kilitDurumu();
  const kilitli = kilit.kapali && kilit.sinifId === sinif.id;

  const kartSistemi = ogretmen.behaviorTemplate === "CARD";
  const ogrenciler = turkceSirala(
    sinif.students.map((o) => ({ id: o.id, ad: `${o.firstName} ${o.lastName}` })),
    (o) => o.ad,
  );
  const ogrenciIdleri = ogrenciler.map((o) => o.id);

  // Kart durumu yalnızca aktif derse aittir; ders değişince sıfırdan başlar.
  // Basit sistemde not elle girildiği için artı/eksi sayıları öne çıkar,
  // teneffüs cezası ise yalnızca kart sisteminde oluşur.
  const [kartlar, sayimlar, cezalar] = await Promise.all<
    [Promise<Map<string, KartDurumu>>, Promise<Map<string, Sayimlar>>, Promise<Map<string, CezaOzeti>>]
  >([
    kartSistemi && aktifDers
      ? dersKartDurumlari(aktifDers.id)
      : Promise.resolve(new Map()),
    kartSistemi ? Promise.resolve(new Map()) : ogrenciSayimlari(ogrenciIdleri),
    kartSistemi ? bekleyenCezalar(ogrenciIdleri) : Promise.resolve(new Map()),
  ]);

  return (
    <>
      {/* Kilitliyken sayfadan çıkış yolu gösterilmez; middleware zaten
          engelliyor, ama görünen bir bağlantı öğrenciyi denemeye çağırır. */}
      {!kilitli && (
        <Link className="geri" href="/">
          ← Sınıflarım
        </Link>
      )}

      <TahtaKilidi
        sinifId={sinif.id}
        pinVar={ogretmen.boardPin !== null}
        kilitli={kilit.kilitli}
        kapali={kilitli}
        kalanSaniye={kilit.kalanSaniye}
        bekleSaniye={kilit.bekleSaniye}
      />

      <main className="kart ders-ekrani">
        {/* Ders sırasında bakılan tek satır: hangi ders açık ve nasıl
            bitirilir. Sınıf adı ve mevcut da buraya sığar. */}
        <div className="ders-basi">
          <div className="ders-basi-sol">
            <h1>{sinif.name}</h1>
            <span className="soluk">
              {aktifDers
                ? `${aktifDers.gunlukSira}. ders · ${dersKisaYazisi(aktifDers.tarih)}`
                : "Aktif ders yok"}
            </span>
          </div>
          {!kilitli && (
            <div className="ders-basi-sag">
              <Link className="baglanti" href={`/sinif/${sinif.id}/odevler`}>
                Ödevler →
              </Link>
              <Link className="baglanti" href={`/sinif/${sinif.id}/sinavlar`}>
                Sınavlar →
              </Link>
              <Link className="baglanti" href={`/sinif/${sinif.id}/dersler`}>
                Ders geçmişi →
              </Link>
              <DersKontrolu sinifId={sinif.id} aktifDersId={aktifDers?.id ?? null} />
            </div>
          )}
        </div>

        {ogrenciler.length === 0 ? (
          <p className="soluk">
            Bu sınıfta henüz öğrenci yok. Aşağıdaki formdan ekleyebilirsiniz.
          </p>
        ) : (
          <ul className="liste ogrenci-liste">
            {ogrenciler.map((ogrenci) => {
              const sayim = sayimlar.get(ogrenci.id) ?? { arti: 0, eksi: 0 };
              return (
                <li key={ogrenci.id}>
                  <OgrenciSatiri
                    ogrenciId={ogrenci.id}
                    ad={ogrenci.ad}
                    sinifId={sinif.id}
                    dersId={aktifDers?.id ?? null}
                    sablon={ogretmen.behaviorTemplate}
                    kart={kartlar.get(ogrenci.id)}
                    arti={sayim.arti}
                    eksi={sayim.eksi}
                    ceza={cezalar.get(ogrenci.id)}
                    kilitli={kilitli}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {/* Ders sırasında öğrenci eklenmez; form kapalı durur, istenince açılır. */}
      {!kilitli && (
        <details className="kart katlanir">
          <summary>Yeni öğrenci</summary>
          <OgrenciFormu sinifId={sinif.id} />
        </details>
      )}

      {/* Ayrı bir "tahta sayfası" yok: bu bileşen ekran zaten tahta
          sayılacak kadar genişse (globals.css'teki aynı 1280px eşiği)
          kendini etkinleştirir. Telefon bunu hiç görmez. */}
      <SinifCanliBildirimleri
        dersId={aktifDers?.id ?? null}
        sablon={ogretmen.behaviorTemplate}
        baslangicZamani={new Date().toISOString()}
      />
    </>
  );
}
