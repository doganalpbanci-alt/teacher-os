import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { aktifDersiGetir, dersKisaYazisi } from "@/lib/lesson";
import {
  dersKartDurumlari,
  derstekiKayitliOgrenciler,
  ogrenciSayimlari,
  type KartDurumu,
} from "@/lib/behavior";
import { OgrenciFormu } from "@/components/OgrenciFormu";
import { DersKontrolu } from "@/components/DersKontrolu";
import { OgrenciSatiri, type CezaOzeti } from "@/components/OgrenciSatiri";
import { bekleyenCezalar } from "@/lib/penalty";
import { kilitDurumu } from "@/lib/lock";
import { TahtaKilidi } from "@/components/TahtaKilidi";
import { SinifCanliBildirimleri } from "@/components/SinifCanliBildirimleri";
import { SinifYonetimi } from "@/components/SinifYonetimi";
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
        isActive: true,
        // Aktif/arşivli ayrımı aşağıda JS'te yapılır: arşivlenmiş
        // öğrencileri de listeleyebilmek için hepsi tek sorguda gelir.
        // Sıralama Türkçe alfabeye göre aşağıda yapılır; veritabanı
        // sıralaması Ç, Ğ, İ gibi harfleri listenin sonuna atıyor.
        students: {
          select: { id: true, firstName: true, lastName: true, isActive: true },
        },
        _count: { select: { lessons: true } },
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
    sinif.students
      .filter((o) => o.isActive)
      .map((o) => ({ id: o.id, ad: `${o.firstName} ${o.lastName}` })),
    (o) => o.ad,
  );
  const arsivliOgrenciler = turkceSirala(
    sinif.students
      .filter((o) => !o.isActive)
      .map((o) => ({ id: o.id, ad: `${o.firstName} ${o.lastName}` })),
    (o) => o.ad,
  );
  // Sınıf yalnızca hiç öğrenci (arşivli dahil) ve hiç ders yoksa silinebilir.
  const sinifSilinebilir = sinif.students.length === 0 && sinif._count.lessons === 0;
  const ogrenciIdleri = ogrenciler.map((o) => o.id);

  // Kart durumu yalnızca aktif derse aittir; ders değişince sıfırdan başlar.
  // Basit sistemde not elle girildiği için artı/eksi sayıları öne çıkar,
  // teneffüs cezası ise yalnızca kart sisteminde oluşur.
  // Geri alma düğmesi yalnızca SÜREN derste kaydı olan öğrencilerde görünür:
  // basılacak bir şeyin olmadığı satırda düğme durmasın (kural: `sonKaydiGeriAl`).
  const [kartlar, sayimlar, cezalar, geriAlinabilirler] = await Promise.all<
    [
      Promise<Map<string, KartDurumu>>,
      Promise<Map<string, Sayimlar>>,
      Promise<Map<string, CezaOzeti>>,
      Promise<Set<string>>,
    ]
  >([
    kartSistemi && aktifDers
      ? dersKartDurumlari(aktifDers.id)
      : Promise.resolve(new Map()),
    kartSistemi ? Promise.resolve(new Map()) : ogrenciSayimlari(ogrenciIdleri),
    kartSistemi ? bekleyenCezalar(ogrenciIdleri) : Promise.resolve(new Map()),
    aktifDers ? derstekiKayitliOgrenciler(aktifDers.id) : Promise.resolve(new Set()),
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
            <h1>
              {sinif.name}
              {!sinif.isActive && " · arşivde"}
            </h1>
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
                    geriAlinabilir={geriAlinabilirler.has(ogrenci.id)}
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

      {/* Arşivlenmiş öğrenciyi geri açma yolu burası: kendi listesinden
          kalkınca bir daha görünmez, ama tamamen kaybolmaz. Arşivden çıkarma
          düğmesi öğrencinin kendi sayfasında (OgrenciYonetimi). */}
      {!kilitli && arsivliOgrenciler.length > 0 && (
        <details className="kart katlanir">
          <summary>Arşivlenmiş öğrenciler ({arsivliOgrenciler.length})</summary>
          <ul className="liste">
            {arsivliOgrenciler.map((o) => (
              <li key={o.id}>
                <Link className="satir" href={`/ogrenci/${o.id}`}>
                  <span className="satir-ad">{o.ad}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}

      {!kilitli && (
        <details className="kart katlanir">
          <summary>Sınıfı yönet</summary>
          <SinifYonetimi
            sinifId={sinif.id}
            arsivde={!sinif.isActive}
            silinebilir={sinifSilinebilir}
          />
        </details>
      )}

      {/* Ayrı bir "tahta sayfası" yok: bu bileşen ekran zaten tahta
          sayılacak kadar genişse (globals.css'teki aynı 1280px eşiği)
          kendini etkinleştirir. Telefon bunu hiç görmez. */}
      <SinifCanliBildirimleri
        dersId={aktifDers?.id ?? null}
        sablon={ogretmen.behaviorTemplate}
        baslangicZamani={new Date().toISOString()}
        kilitli={kilitli}
      />
    </>
  );
}
