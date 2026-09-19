import type { BehaviorTemplate, BehaviorType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ayniDonem,
  donemAnahtari,
  donemBul,
  type Donem,
} from "@/lib/exam-rules";
import { ogrenciSinavlari, type OgrenciSinavSatiri } from "@/lib/exam";
import {
  ogrenciOdevleri,
  sayimlariHesapla,
  type OdevSayimlari,
  type OgrenciOdevSatiri,
} from "@/lib/assignment";
import { ogrenciGelisimi, type GelisimSonucu } from "@/lib/progress";

// Öğrenci raporunun veri katmanı: veli toplantısında masaya konacak ya da
// veliye verilecek tek sayfalık döküm.
//
// Yeni veri modeli yok; hepsi mevcut kayıtlardan. Sınav ve ödev satırları
// zaten var olan sorgulardan gelir (`ogrenciSinavlari`, `ogrenciOdevleri`)
// ve burada yalnızca seçilen döneme süzülür — aynı sorgu iki yerde
// yazılmasın.
//
// Sahiplik sorgunun parçası: başkasının öğrencisi için null döner.

export type Rapor = {
  ogrenciAdi: string;
  sinifAdi: string | null;
  ogretmenAdi: string;
  performansNotu: number;
  kartSistemi: boolean;

  secilenDonem: Donem;
  /** Seçiciye konacak dönemler, en yeniden eskiye. */
  donemler: Donem[];

  davranis: {
    arti: number;
    eksi: number;
    sariKart: number;
    kirmiziKart: number;
    dersSayisi: number;
  };

  sinavlar: OgrenciSinavSatiri[];
  karneOrtalamasi: number | null;
  denemeOrtalamasi: number | null;

  odevler: OgrenciOdevSatiri[];
  odevSayimlari: OdevSayimlari;

  gelisim: GelisimSonucu;
  uretimTarihi: Date;
};

function ortalama(degerler: number[]): number | null {
  if (degerler.length === 0) return null;
  return Math.round((degerler.reduce((t, d) => t + d, 0) / degerler.length) * 10) / 10;
}

/**
 * Öğrencinin bir dönemlik raporu.
 *
 * `istenenDonem` verilmezse ya da tanınmazsa **verisi olan en yeni dönem**
 * seçilir; bugünün tarihi kullanılmaz. Dönem başında, henüz hiç kaydı
 * olmayan bir dönemin bomboş raporunu açmak öğretmene bir şey söylemezdi.
 */
export async function ogrenciRaporu(
  ogrenciId: string,
  ogretmenId: string,
  sablon: BehaviorTemplate,
  istenenDonem: Donem | null,
): Promise<Rapor | null> {
  const ogrenci = await prisma.student.findFirst({
    where: { id: ogrenciId, classroom: { teacherId: ogretmenId } },
    select: {
      firstName: true,
      lastName: true,
      performanceScore: true,
      classroomId: true,
      classroom: { select: { name: true } },
    },
  });
  if (!ogrenci) return null;

  const [ogretmen, kayitlar, dersler, sinavlar, odevler] = await Promise.all([
    prisma.teacher.findUnique({ where: { id: ogretmenId }, select: { name: true } }),
    prisma.behaviorLog.findMany({
      where: { studentId: ogrenciId, teacherId: ogretmenId },
      select: { type: true, createdAt: true },
    }),
    ogrenci.classroomId
      ? prisma.lesson.findMany({
          where: {
            classroomId: ogrenci.classroomId,
            classroom: { teacherId: ogretmenId },
          },
          select: { date: true },
        })
      : Promise.resolve([] as { date: Date }[]),
    ogrenciSinavlari(ogrenciId, ogretmenId),
    ogrenciOdevleri(ogrenciId, ogretmenId),
  ]);

  // Seçiciye konacak dönemler: kayıt bulunan her dönem. Ders kaydı tek
  // başına yeterli değil — o dönem hakkında anlatacak bir şey olmalı.
  const anahtarlar = new Map<string, Donem>();
  const ekle = (d: Donem) => {
    if (!anahtarlar.has(donemAnahtari(d))) anahtarlar.set(donemAnahtari(d), d);
  };
  for (const k of kayitlar) ekle(donemBul(k.createdAt));
  for (const s of sinavlar) ekle(s.donem);
  for (const o of odevler) {
    if (o.dueDate) ekle(donemBul(o.dueDate));
  }

  const donemler = [...anahtarlar.values()].sort(
    (a, b) => b.yil - a.yil || b.sira - a.sira,
  );
  if (donemler.length === 0) return null;

  // İstenen dönem tanınmıyorsa (adres çubuğundan uydurulmuş olabilir) en
  // yeni döneme düşülür; hata verilmez, rapor yine de anlamlı çıkar.
  const secilenDonem =
    (istenenDonem && donemler.find((d) => ayniDonem(d, istenenDonem))) ?? donemler[0];

  const donemdeMi = (tarih: Date) => ayniDonem(donemBul(tarih), secilenDonem);

  const sayimlar: Record<BehaviorType, number> = {
    PLUS: 0,
    MINUS: 0,
    YELLOW_CARD: 0,
    RED_CARD: 0,
  };
  for (const kayit of kayitlar) {
    if (donemdeMi(kayit.createdAt)) sayimlar[kayit.type] += 1;
  }

  const donemSinavlari = sinavlar.filter((s) => ayniDonem(s.donem, secilenDonem));
  const yuzdeler = (scope: "OFFICIAL" | "PRACTICE") =>
    donemSinavlari
      .filter((s) => s.scope === scope && !s.isAbsent && s.yuzde !== null)
      .map((s) => s.yuzde as number);

  // Tarihsiz ödev hiçbir döneme düşmez: hangi döneme ait olduğu bilinmiyor,
  // rapora katmak onu keyfî bir döneme yazmak olurdu.
  const donemOdevleri = odevler.filter((o) => o.dueDate !== null && donemdeMi(o.dueDate));

  return {
    ogrenciAdi: `${ogrenci.firstName} ${ogrenci.lastName}`,
    sinifAdi: ogrenci.classroom?.name ?? null,
    ogretmenAdi: ogretmen?.name ?? "",
    performansNotu: ogrenci.performanceScore,
    kartSistemi: sablon === "CARD",

    secilenDonem,
    donemler,

    davranis: {
      arti: sayimlar.PLUS,
      // Kart şablonunda her kırmızı kart bir MINUS de yazar; iki kez sayılmaz.
      eksi: Math.max(sayimlar.MINUS - sayimlar.RED_CARD, 0),
      sariKart: sayimlar.YELLOW_CARD,
      kirmiziKart: sayimlar.RED_CARD,
      dersSayisi: dersler.filter((d) => donemdeMi(d.date)).length,
    },

    sinavlar: donemSinavlari,
    karneOrtalamasi: ortalama(yuzdeler("OFFICIAL")),
    denemeOrtalamasi: ortalama(yuzdeler("PRACTICE")),

    odevler: donemOdevleri,
    odevSayimlari: sayimlariHesapla(donemOdevleri.map((o) => o.status)),

    // Rapor SEÇİLEN dönemi anlatır: gelişim de o dönem ile bir öncekini
    // karşılaştırır, "son iki dönemi" değil.
    gelisim: await ogrenciGelisimi(ogrenciId, ogretmenId, sablon, secilenDonem),
    uretimTarihi: new Date(),
  };
}
