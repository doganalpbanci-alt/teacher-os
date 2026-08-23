import Link from "next/link";
import { notFound } from "next/navigation";
import type { BehaviorType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { dersTarihiYazisi } from "@/lib/current-lesson";
import { ogrenciGecmisi, ogrenciOzeti } from "@/lib/student-history";
import { ogrenciCezalari } from "@/lib/penalty";
import { NotFormu } from "@/components/NotFormu";

export const dynamic = "force-dynamic";

// Kayıt türlerinin ekrandaki karşılığı. Basit sistemde kart kaydı oluşmaz,
// ama şablon değiştirilmişse geçmişte durabilir; bu yüzden hepsi tanımlı.
const TUR_YAZISI: Record<BehaviorType, { yazi: string; sinif: string }> = {
  PLUS: { yazi: "Artı", sinif: "g-arti" },
  MINUS: { yazi: "Eksi", sinif: "g-eksi" },
  YELLOW_CARD: { yazi: "Sarı kart", sinif: "g-sari" },
  RED_CARD: { yazi: "Kırmızı kart", sinif: "g-kirmizi" },
};

function saatYazisi(zaman: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
  }).format(zaman);
}

export default async function OgrenciSayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ogretmen = await getCurrentTeacher();

  // Ogrenci, ogretmenin bir sinifina bagli degilse 404 doner.
  const ogrenci = await prisma.student.findFirst({
    where: { id, classroom: { teacherId: ogretmen.id } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      parentName: true,
      parentPhone: true,
      performanceScore: true,
      classroom: { select: { id: true, name: true } },
    },
  });

  if (!ogrenci) notFound();

  const kartSistemi = ogretmen.behaviorTemplate === "CARD";
  const ozet = await ogrenciOzeti(ogrenci.id);
  const gecmis = await ogrenciGecmisi(ogrenci.id);
  // Teneffüs cezaları yalnızca kart sisteminde oluşur; basit sisteme geçilse
  // bile geçmişte kalanlar gösterilir.
  const cezalar = await ogrenciCezalari(ogrenci.id);

  // Basit sistemde kartlar gündemde değil; kart sisteminde yıldız/kart öne çıkar.
  const olcumler = kartSistemi
    ? [
        { deger: ozet.arti, etiket: "yıldız" },
        { deger: ozet.sariKart, etiket: "sarı kart" },
        { deger: ozet.kirmiziKart, etiket: "kırmızı kart" },
      ]
    : [
        { deger: ozet.arti, etiket: "artı" },
        { deger: ozet.eksi, etiket: "eksi" },
      ];

  return (
    <>
      <Link
        className="geri"
        href={ogrenci.classroom ? `/sinif/${ogrenci.classroom.id}` : "/"}
      >
        ← {ogrenci.classroom ? ogrenci.classroom.name : "Sınıflarım"}
      </Link>

      <main className="kart">
        <h1>
          {ogrenci.firstName} {ogrenci.lastName}
        </h1>
        <p className="soluk">
          {ogrenci.classroom ? ogrenci.classroom.name : "Sınıfa atanmamış"}
          {ogrenci.parentName ? ` · Veli: ${ogrenci.parentName}` : ""}
          {ogrenci.parentPhone ? ` · ${ogrenci.parentPhone}` : ""}
        </p>

        <div className="olcum-satiri">
          {olcumler.map((olcum) => (
            <div className="olcum" key={olcum.etiket}>
              <span className="olcum-deger">{olcum.deger}</span>
              <span className="olcum-etiket">{olcum.etiket}</span>
            </div>
          ))}
          <div className="olcum">
            <span className="olcum-deger">{ogrenci.performanceScore}</span>
            <span className="olcum-etiket">performans notu</span>
          </div>
        </div>
      </main>

      <section className="kart">
        <h2>Performans notu</h2>
        {kartSistemi ? (
          <p className="soluk">
            Kart sisteminde not kayıtlardan otomatik hesaplanır, elle
            değiştirilmez. Elle girmek için <Link href="/ayarlar">ayarlardan</Link>{" "}
            basit sisteme geçin.
          </p>
        ) : (
          <>
            <p className="soluk">
              Aşağıdaki geçmişe bakarak notu kendiniz belirlersiniz. Uygulama bu
              değeri kendiliğinden değiştirmez.
            </p>
            <NotFormu ogrenciId={ogrenci.id} mevcutNot={ogrenci.performanceScore} />
          </>
        )}
      </section>

      {cezalar.length > 0 && (
        <section className="kart">
          <h2>Teneffüs cezaları</h2>
          <ul className="liste">
            {cezalar.map((ceza) => (
              <li key={ceza.id}>
                <div className="satir">
                  <span className="satir-ad">{ceza.dakika} dakika</span>
                  <span className="satir-sag">
                    <span className={`ceza-durum ceza-${ceza.durum.toLowerCase()}`}>
                      {ceza.durum === "TAMAMLANDI"
                        ? "Uygulandı"
                        : ceza.durum === "SURUYOR"
                          ? "Sürüyor"
                          : "Bekliyor"}
                    </span>
                    <span className="rozet">
                      {dersTarihiYazisi(ceza.tamamlandi ?? ceza.olusturuldu)}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="kart">
        <h2>Geçmiş</h2>
        {gecmis.length === 0 ? (
          <p className="soluk">Bu öğrenci için henüz kayıt yok.</p>
        ) : (
          <div className="gecmis">
            {gecmis.map((grup) => (
              <div className="gecmis-ders" key={grup.dersId}>
                <h3 className="gecmis-baslik">{dersTarihiYazisi(grup.dersTarihi)}</h3>
                <ul className="liste">
                  {grup.kayitlar.map((kayit) => (
                    <li key={kayit.id}>
                      <div className="satir">
                        <span className={`gecmis-tur ${TUR_YAZISI[kayit.tur].sinif}`}>
                          {TUR_YAZISI[kayit.tur].yazi}
                        </span>
                        <span className="satir-sag">
                          {kayit.puan !== 0 && (
                            <span className="gecmis-puan">
                              {kayit.puan > 0 ? `+${kayit.puan}` : kayit.puan}
                            </span>
                          )}
                          <span className="rozet">{saatYazisi(kayit.zaman)}</span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
