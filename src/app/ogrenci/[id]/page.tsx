import Link from "next/link";
import { notFound } from "next/navigation";
import type { BehaviorType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentTeacher } from "@/lib/current-teacher";
import { dersTarihiYazisi, saatYazisi } from "@/lib/lesson";
import { ogrenciGecmisi, ogrenciOzeti } from "@/lib/student-history";
import { ogrenciCezalari } from "@/lib/penalty";
import {
  ogrenciOdevleri,
  ogrenciOdevIstatistigi,
  odevTarihiYazisi,
} from "@/lib/assignment";
import { NotFormu } from "@/components/NotFormu";
import type { SubmissionStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

// Kayıt türlerinin ekrandaki karşılığı. Basit sistemde kart kaydı oluşmaz,
// ama şablon değiştirilmişse geçmişte durabilir; bu yüzden hepsi tanımlı.
const TUR_YAZISI: Record<BehaviorType, { yazi: string; sinif: string }> = {
  PLUS: { yazi: "Artı", sinif: "g-arti" },
  MINUS: { yazi: "Eksi", sinif: "g-eksi" },
  YELLOW_CARD: { yazi: "Sarı kart", sinif: "g-sari" },
  RED_CARD: { yazi: "Kırmızı kart", sinif: "g-kirmizi" },
};

const TESLIM_YAZISI: Record<SubmissionStatus, string> = {
  PENDING: "Bekliyor",
  DONE: "Yapıldı",
  MISSING: "Eksik",
  LATE: "Geç",
};

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
  // Dördü de aynı öğrenciye bakar, birbirini beklemez.
  // Teneffüs cezaları yalnızca kart sisteminde oluşur; basit sisteme geçilse
  // bile geçmişte kalanlar gösterilir.
  const [ozet, gecmis, cezalar, odevler, odevOzeti] = await Promise.all([
    ogrenciOzeti(ogrenci.id),
    ogrenciGecmisi(ogrenci.id),
    ogrenciCezalari(ogrenci.id),
    ogrenciOdevleri(ogrenci.id, ogretmen.id),
    ogrenciOdevIstatistigi(ogrenci.id, ogretmen.id),
  ]);

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
          {/* Ödev verilmemiş öğrencide %0 yanıltıcı olurdu; ölçüm ancak
              en az bir ödev varsa görünür. */}
          {odevOzeti.toplam > 0 && (
            <div className="olcum">
              <span className="olcum-deger">%{odevOzeti.oran}</span>
              <span className="olcum-etiket">ödev</span>
            </div>
          )}
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

      {odevler.length > 0 && (
        <section className="kart">
          <div className="sayfa-basi">
            <h2>Ödevler</h2>
            <span className="rozet">
              {odevOzeti.done + odevOzeti.late}/{odevOzeti.toplam} · %{odevOzeti.oran}
            </span>
          </div>
          <ul className="liste">
            {odevler.map((odev) => (
              <li key={odev.odevId}>
                <Link className="satir" href={`/odevler/${odev.odevId}`}>
                  <span className="satir-ad">
                    {odev.baslik}
                    {odev.dueDate && (
                      <span className="soluk odev-tarih">
                        son teslim {odevTarihiYazisi(odev.dueDate)}
                      </span>
                    )}
                  </span>
                  <span className="satir-sag">
                    {odev.gecikti && <span className="rozet gecikti">Süresi geçti</span>}
                    <span className={`teslim-rozet t-${odev.status.toLowerCase()}`}>
                      {TESLIM_YAZISI[odev.status]}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

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
