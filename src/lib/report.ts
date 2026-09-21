import type { BehaviorTemplate, BehaviorType, SubmissionStatus } from "@prisma/client";
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
import { ogrenciGelisimi, sinifGelisimi, type GelisimSonucu } from "@/lib/progress";
import { turkceSirala } from "@/lib/siralama";

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

// ---------- Sınıf raporu ----------

export type SinifRaporSatiri = {
  ogrenciId: string;
  ad: string;
  arti: number;
  /** Basit şablonda eksi; kart şablonunda kullanılmaz (kartlar ayrı sütun). */
  eksi: number;
  sariKart: number;
  kirmiziKart: number;
  performansNotu: number;
  karneOrtalamasi: number | null;
  odevOrani: number | null;
};

export type SinifRaporu = {
  sinifAdi: string;
  ogretmenAdi: string;
  kartSistemi: boolean;

  secilenDonem: Donem;
  donemler: Donem[];

  ogrenciSayisi: number;
  dersSayisi: number;
  toplam: { arti: number; eksi: number; sariKart: number; kirmiziKart: number };
  /** Sınıfın karne ortalaması: öğrenci ortalamalarının ortalaması. */
  karneOrtalamasi: number | null;
  odevOrani: number | null;

  /** Türkçe alfabeye göre sıralı. Resmî bir belgede beklenen sıra budur. */
  satirlar: SinifRaporSatiri[];
  gelisim: GelisimSonucu;
  uretimTarihi: Date;
};

/**
 * Bir sınıfın dönemlik raporu: her öğrenci bir satır.
 *
 * Sıralama alfabetiktir, başarıya göre DEĞİL. Sınıf sayfalarındaki "en düşük
 * üstte" mantığı ekranda öğretmene "kime bakmalı" der; kâğıda dökülüp
 * paylaşılan bir belgede aynı sıra bir başarı sıralamasına dönüşürdü.
 *
 * "Dikkat gereken öğrenciler" listesi bilerek YOK: rapor bir döküm, bir
 * değerlendirme değil. O etiket kâğıda dökülüp başkasının eline geçince
 * öğrenciyi damgalar; sayılar zaten tabloda, liste panelde duruyor.
 *
 * Arşivlenmiş öğrenciler dışarıda — sınıf sayfalarındaki istatistiklerle
 * aynı kural.
 */
export async function sinifRaporu(
  sinifId: string,
  ogretmenId: string,
  sablon: BehaviorTemplate,
  istenenDonem: Donem | null,
): Promise<SinifRaporu | null> {
  const sinif = await prisma.classroom.findFirst({
    where: { id: sinifId, teacherId: ogretmenId },
    select: {
      name: true,
      students: {
        where: { isActive: true },
        select: { id: true, firstName: true, lastName: true, performanceScore: true },
      },
    },
  });
  if (!sinif) return null;

  const ogrenciIdleri = sinif.students.map((o) => o.id);

  const [ogretmen, kayitlar, dersler, sonuclar, teslimler] = await Promise.all([
    prisma.teacher.findUnique({ where: { id: ogretmenId }, select: { name: true } }),
    prisma.behaviorLog.findMany({
      where: { classroomId: sinifId, teacherId: ogretmenId },
      select: { studentId: true, type: true, createdAt: true },
    }),
    prisma.lesson.findMany({
      where: { classroomId: sinifId, classroom: { teacherId: ogretmenId } },
      select: { date: true },
    }),
    ogrenciIdleri.length === 0
      ? Promise.resolve([])
      : prisma.examResult.findMany({
          where: {
            studentId: { in: ogrenciIdleri },
            isAbsent: false,
            score: { not: null },
            exam: { teacherId: ogretmenId, scope: "OFFICIAL" },
          },
          select: {
            studentId: true,
            score: true,
            exam: { select: { examDate: true, maxScore: true } },
          },
        }),
    ogrenciIdleri.length === 0
      ? Promise.resolve([])
      : prisma.submission.findMany({
          where: {
            studentId: { in: ogrenciIdleri },
            assignment: { teacherId: ogretmenId },
          },
          select: {
            studentId: true,
            status: true,
            assignment: { select: { dueDate: true } },
          },
        }),
  ]);

  // Seçiciye konacak dönemler: sınıfta kayıt bulunan her dönem.
  const anahtarlar = new Map<string, Donem>();
  const ekle = (d: Donem) => {
    if (!anahtarlar.has(donemAnahtari(d))) anahtarlar.set(donemAnahtari(d), d);
  };
  for (const k of kayitlar) ekle(donemBul(k.createdAt));
  for (const s of sonuclar) ekle(donemBul(s.exam.examDate));
  for (const t of teslimler) {
    if (t.assignment.dueDate) ekle(donemBul(t.assignment.dueDate));
  }

  const donemler = [...anahtarlar.values()].sort(
    (a, b) => b.yil - a.yil || b.sira - a.sira,
  );
  if (donemler.length === 0) return null;

  const secilenDonem =
    (istenenDonem && donemler.find((d) => ayniDonem(d, istenenDonem))) ?? donemler[0];
  const donemdeMi = (tarih: Date) => ayniDonem(donemBul(tarih), secilenDonem);

  // Öğrenci başına kovalar.
  const sayimlar = new Map<string, Record<BehaviorType, number>>();
  const yuzdeler = new Map<string, number[]>();
  const durumlar = new Map<string, SubmissionStatus[]>();
  for (const id of ogrenciIdleri) {
    sayimlar.set(id, { PLUS: 0, MINUS: 0, YELLOW_CARD: 0, RED_CARD: 0 });
    yuzdeler.set(id, []);
    durumlar.set(id, []);
  }

  for (const kayit of kayitlar) {
    if (!donemdeMi(kayit.createdAt)) continue;
    const kova = sayimlar.get(kayit.studentId);
    if (kova) kova[kayit.type] += 1;
  }
  for (const sonuc of sonuclar) {
    if (sonuc.score === null || sonuc.exam.maxScore <= 0) continue;
    if (!donemdeMi(sonuc.exam.examDate)) continue;
    yuzdeler.get(sonuc.studentId)?.push((sonuc.score / sonuc.exam.maxScore) * 100);
  }
  for (const teslim of teslimler) {
    // Tarihsiz ödev hiçbir döneme düşmez (öğrenci raporundaki aynı kural).
    if (!teslim.assignment.dueDate || !donemdeMi(teslim.assignment.dueDate)) continue;
    durumlar.get(teslim.studentId)?.push(teslim.status);
  }

  const satirlar: SinifRaporSatiri[] = sinif.students.map((o) => {
    const s = sayimlar.get(o.id) ?? { PLUS: 0, MINUS: 0, YELLOW_CARD: 0, RED_CARD: 0 };
    const teslimDurumlari = durumlar.get(o.id) ?? [];
    return {
      ogrenciId: o.id,
      ad: `${o.firstName} ${o.lastName}`,
      arti: s.PLUS,
      // Kart şablonunda her kırmızı kart bir MINUS de yazar; iki kez sayılmaz.
      eksi: Math.max(s.MINUS - s.RED_CARD, 0),
      sariKart: s.YELLOW_CARD,
      kirmiziKart: s.RED_CARD,
      performansNotu: o.performanceScore,
      karneOrtalamasi: ortalama(yuzdeler.get(o.id) ?? []),
      odevOrani:
        teslimDurumlari.length === 0 ? null : sayimlariHesapla(teslimDurumlari).oran,
    };
  });

  const topla = (secici: (s: SinifRaporSatiri) => number) =>
    satirlar.reduce((t, s) => t + secici(s), 0);

  // Sınıfın ödev oranı tek tek öğrenci oranlarının ortalaması DEĞİL, bütün
  // teslimlerin oranı: az ödevi olan bir öğrencinin %100'ü sınıf oranını
  // olduğundan iyi göstermesin.
  const tumTeslimler = satirlar.flatMap((s) => durumlar.get(s.ogrenciId) ?? []);

  return {
    sinifAdi: sinif.name,
    ogretmenAdi: ogretmen?.name ?? "",
    kartSistemi: sablon === "CARD",

    secilenDonem,
    donemler,

    ogrenciSayisi: satirlar.length,
    dersSayisi: dersler.filter((d) => donemdeMi(d.date)).length,
    toplam: {
      arti: topla((s) => s.arti),
      eksi: topla((s) => s.eksi),
      sariKart: topla((s) => s.sariKart),
      kirmiziKart: topla((s) => s.kirmiziKart),
    },
    karneOrtalamasi: ortalama(
      satirlar.map((s) => s.karneOrtalamasi).filter((d): d is number => d !== null),
    ),
    odevOrani: tumTeslimler.length === 0 ? null : sayimlariHesapla(tumTeslimler).oran,

    satirlar: turkceSirala(satirlar, (s) => s.ad),
    // Rapor SEÇİLEN dönemi anlatır; gelişim de o dönemle bir öncekini
    // karşılaştırır (öğrenci raporundaki aynı kural).
    gelisim: await sinifGelisimi(sinifId, ogretmenId, sablon, secilenDonem),
    uretimTarihi: new Date(),
  };
}
