import type { BehaviorTemplate, BehaviorType, SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { turkceSirala } from "@/lib/siralama";
import { sayimlariHesapla, gundemSayisi } from "@/lib/assignment";
import { taslakSayisi } from "@/lib/parent-message";
import {
  dikkatSebepleri,
  dikkatSirasi,
  pencereBaslangici,
  type DikkatSebebi,
} from "@/lib/dashboard-rules";

// Panelin sorgu katmanı. Yeni bir veri modeli yoktur: her sayı mevcut
// kayıtlardan (BehaviorLog, Submission, ExamResult, Lesson, ParentMessage)
// hesaplanır. Sınıf ve öğrenci sayfalarındaki istatistiklerin öğretmen
// genelinde toplanmış hâlidir.
//
// Sahiplik her sorgunun parçasıdır (`teacherId`), ayrı bir kontrol katmanı
// değil — başkasına ait kayıt zaten sonuca girmez.

/** Listelerin en fazla uzunluğu; panel sınırsız büyümesin. */
const LISTE_SINIRI = 20;

export type BekleyenIsler = {
  gecikmisOdev: number;
  acikCeza: number;
  veliTaslagi: number;
  /** Gamification kapalıysa her zaman 0; blok da gösterilmez. */
  acikHedef: number;
};

export type DikkatSatiri = {
  ogrenciId: string;
  ad: string;
  sinifAdi: string;
  sebepler: DikkatSebebi[];
  kirmiziKart: number;
  gecikmisOdev: number;
  resmiOrtalama: number | null;
};

export type SinifSatiri = {
  id: string;
  ad: string;
  ogrenciSayisi: number;
  dersSayisi: number;
  /** Basit şablonda "artı", kart şablonunda "yıldız" — aynı kayıt tipi. */
  arti: number;
  eksi: number;
  sariKart: number;
  kirmiziKart: number;
  /** Pencerede verilmiş ödev yoksa null — "%0" yanıltıcı olurdu. */
  odevOrani: number | null;
  resmiOrtalama: number | null;
  /** Yalnızca Kart şablonunda dolu; Basit şablonda not elle girilir. */
  ortalamaPuan: number | null;
};

export type PencereOzeti = {
  ders: number;
  arti: number;
  eksi: number;
  sariKart: number;
  kirmiziKart: number;
  tamamlananTeslim: number;
  gonderilenMesaj: number;
};

export type PanelVerisi = {
  bekleyen: BekleyenIsler;
  dikkat: DikkatSatiri[];
  siniflar: SinifSatiri[];
  ozet: PencereOzeti;
};

function yuvarla(sayi: number): number {
  return Math.round(sayi * 10) / 10;
}

function ortalama(degerler: number[]): number | null {
  if (degerler.length === 0) return null;
  return yuvarla(degerler.reduce((t, d) => t + d, 0) / degerler.length);
}

/** Bir sayaç haritasına ekleme yapar; anahtar yoksa sıfırdan başlar. */
function ekle<K>(harita: Map<K, number>, anahtar: K, miktar: number): void {
  harita.set(anahtar, (harita.get(anahtar) ?? 0) + miktar);
}

/**
 * Süresi geçmiş ve hâlâ tamamlanmamış teslimler.
 *
 * Bilerek 30 günlük pencereye BAKMAZ: teslim edilmemiş bir ödev 30 gün
 * geçince önemsizleşmez, tam tersine. Panelin diğer sayıları penceredir,
 * bu biriken iştir.
 */
function gecikmisTeslimKosulu(ogretmenId: string, simdi: Date) {
  return {
    assignment: { teacherId: ogretmenId },
    student: { isActive: true, classroom: { teacherId: ogretmenId, isActive: true } },
    OR: [
      { status: "MISSING" as SubmissionStatus },
      {
        status: "PENDING" as SubmissionStatus,
        assignment: { teacherId: ogretmenId, dueDate: { lt: simdi } },
      },
    ],
  };
}

export async function panelVerisi(
  ogretmenId: string,
  sablon: BehaviorTemplate,
  gamificationAcik: boolean,
): Promise<PanelVerisi> {
  const simdi = new Date();
  const pencere = pencereBaslangici(simdi);

  const [
    siniflar,
    davranisOgrenci,
    davranisSinif,
    dersler,
    gecikmisTeslimler,
    pencereTeslimleri,
    sinavSonuclari,
    bekleyenOdev,
    acikCeza,
    veliTaslagi,
    acikHedef,
    tamamlananTeslim,
    gonderilenMesaj,
  ] = await Promise.all([
    prisma.classroom.findMany({
      where: { teacherId: ogretmenId, isActive: true },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        students: {
          where: { isActive: true },
          select: { id: true, firstName: true, lastName: true, performanceScore: true },
        },
      },
    }),

    // Öğrenci bazlı davranış sayıları (pencere içinde).
    prisma.behaviorLog.groupBy({
      by: ["studentId", "type"],
      where: { teacherId: ogretmenId, createdAt: { gte: pencere } },
      _count: { _all: true },
    }),

    // Sınıf bazlı davranış sayıları. Öğrenci toplamlarından türetilmez:
    // sınıfı değişmiş bir öğrencinin eski kaydı eski sınıfında kalmalı.
    // Arşivlenmiş sınıf dışarıda: hem karşılaştırma tablosu hem alttaki
    // pencere özeti bu sonuçtan beslenir, ikisi aynı kümeyi saymalı.
    prisma.behaviorLog.groupBy({
      by: ["classroomId", "type"],
      where: {
        teacherId: ogretmenId,
        createdAt: { gte: pencere },
        classroom: { isActive: true },
      },
      _count: { _all: true },
    }),

    prisma.lesson.groupBy({
      by: ["classroomId"],
      where: {
        classroom: { teacherId: ogretmenId, isActive: true },
        date: { gte: pencere },
      },
      _count: { _all: true },
    }),

    prisma.submission.findMany({
      where: gecikmisTeslimKosulu(ogretmenId, simdi),
      select: { studentId: true },
    }),

    // Sınıf karşılaştırmasının ödev oranı: pencerede VERİLMİŞ ödevlerin
    // teslimleri. Ödevin kendisi eskiyse sınıfın bugünkü hâlini anlatmaz.
    prisma.submission.findMany({
      where: {
        assignment: { teacherId: ogretmenId, createdAt: { gte: pencere } },
        student: { isActive: true, classroom: { teacherId: ogretmenId } },
      },
      select: {
        status: true,
        studentId: true,
        student: { select: { classroomId: true } },
      },
    }),

    prisma.examResult.findMany({
      where: {
        exam: { teacherId: ogretmenId, scope: "OFFICIAL", examDate: { gte: pencere } },
        isAbsent: false,
        score: { not: null },
        student: { isActive: true, classroom: { teacherId: ogretmenId } },
      },
      select: {
        score: true,
        studentId: true,
        student: { select: { classroomId: true } },
        exam: { select: { maxScore: true } },
      },
    }),

    gundemSayisi(ogretmenId),

    prisma.breakPenalty.count({
      where: {
        completedAt: null,
        student: { isActive: true, classroom: { teacherId: ogretmenId, isActive: true } },
      },
    }),

    taslakSayisi(ogretmenId),

    gamificationAcik
      ? prisma.classGoal.count({
          where: {
            closedAt: null,
            classroom: { teacherId: ogretmenId, isActive: true },
          },
        })
      : Promise.resolve(0),

    prisma.submission.count({
      where: {
        assignment: { teacherId: ogretmenId },
        status: { in: ["DONE", "LATE"] },
        updatedAt: { gte: pencere },
      },
    }),

    prisma.parentMessage.count({
      where: { teacherId: ogretmenId, status: "SENT", sentAt: { gte: pencere } },
    }),
  ]);

  // ---------- Öğrenci bazlı toplama ----------

  const ogrenciDavranis = new Map<string, Map<BehaviorType, number>>();
  for (const satir of davranisOgrenci) {
    let harita = ogrenciDavranis.get(satir.studentId);
    if (!harita) {
      harita = new Map();
      ogrenciDavranis.set(satir.studentId, harita);
    }
    harita.set(satir.type, satir._count._all);
  }

  const ogrenciGecikmis = new Map<string, number>();
  for (const teslim of gecikmisTeslimler) ekle(ogrenciGecikmis, teslim.studentId, 1);

  const ogrenciYuzdeler = new Map<string, number[]>();
  const sinifYuzdeler = new Map<string, number[]>();
  for (const sonuc of sinavSonuclari) {
    if (sonuc.score === null || sonuc.exam.maxScore <= 0) continue;
    const yuzde = (sonuc.score / sonuc.exam.maxScore) * 100;
    const liste = ogrenciYuzdeler.get(sonuc.studentId) ?? [];
    liste.push(yuzde);
    ogrenciYuzdeler.set(sonuc.studentId, liste);
    const sinifId = sonuc.student.classroomId;
    if (sinifId) {
      const sinifListe = sinifYuzdeler.get(sinifId) ?? [];
      sinifListe.push(yuzde);
      sinifYuzdeler.set(sinifId, sinifListe);
    }
  }

  // ---------- Dikkat gereken öğrenciler ----------

  type Aday = DikkatSatiri & { sira: number };
  const adaylar: Aday[] = [];

  for (const sinif of siniflar) {
    for (const ogrenci of sinif.students) {
      const davranis = ogrenciDavranis.get(ogrenci.id);
      const say = (tur: BehaviorType) => davranis?.get(tur) ?? 0;
      const kirmiziKart = say("RED_CARD");
      // Kart şablonunda her kırmızı kart bir MINUS üretir; iki kez sayılmaz.
      const eksi = Math.max(say("MINUS") - kirmiziKart, 0);
      const gecikmisOdev = ogrenciGecikmis.get(ogrenci.id) ?? 0;
      const resmiOrtalama = ortalama(ogrenciYuzdeler.get(ogrenci.id) ?? []);

      const sebepler = dikkatSebepleri({
        kirmiziKart,
        arti: say("PLUS"),
        eksi,
        gecikmisOdev,
        resmiOrtalama,
      });
      if (sebepler.length === 0) continue;

      adaylar.push({
        ogrenciId: ogrenci.id,
        ad: `${ogrenci.firstName} ${ogrenci.lastName}`,
        sinifAdi: sinif.name,
        sebepler,
        kirmiziKart,
        gecikmisOdev,
        resmiOrtalama,
        sira: dikkatSirasi(sebepler),
      });
    }
  }

  // Çok sebebi olan üstte; eşitlikte Türkçe ada göre, liste her açılışta
  // aynı sırada çıksın.
  const dikkat = turkceSirala(adaylar, (a) => a.ad)
    .sort((a, b) => b.sira - a.sira)
    .slice(0, LISTE_SINIRI)
    .map(({ sira: _sira, ...satir }) => satir);

  // ---------- Sınıf karşılaştırması ----------

  const sinifDavranis = new Map<string, Map<BehaviorType, number>>();
  for (const satir of davranisSinif) {
    let harita = sinifDavranis.get(satir.classroomId);
    if (!harita) {
      harita = new Map();
      sinifDavranis.set(satir.classroomId, harita);
    }
    harita.set(satir.type, satir._count._all);
  }

  const dersSayilari = new Map(dersler.map((d) => [d.classroomId, d._count._all]));

  const sinifTeslimleri = new Map<string, SubmissionStatus[]>();
  for (const teslim of pencereTeslimleri) {
    const sinifId = teslim.student.classroomId;
    if (!sinifId) continue;
    const liste = sinifTeslimleri.get(sinifId) ?? [];
    liste.push(teslim.status);
    sinifTeslimleri.set(sinifId, liste);
  }

  const sinifSatirlari: SinifSatiri[] = siniflar.map((sinif) => {
    const davranis = sinifDavranis.get(sinif.id);
    const say = (tur: BehaviorType) => davranis?.get(tur) ?? 0;
    const durumlar = sinifTeslimleri.get(sinif.id) ?? [];
    const kirmiziKart = say("RED_CARD");

    return {
      id: sinif.id,
      ad: sinif.name,
      ogrenciSayisi: sinif.students.length,
      dersSayisi: dersSayilari.get(sinif.id) ?? 0,
      arti: say("PLUS"),
      // Kart şablonunda her kırmızı kart bir MINUS üretir; ayrıca sayılmaz.
      eksi: Math.max(say("MINUS") - kirmiziKart, 0),
      sariKart: say("YELLOW_CARD"),
      kirmiziKart,
      odevOrani: durumlar.length === 0 ? null : sayimlariHesapla(durumlar).oran,
      resmiOrtalama: ortalama(sinifYuzdeler.get(sinif.id) ?? []),
      ortalamaPuan:
        sablon === "CARD"
          ? ortalama(sinif.students.map((o) => o.performanceScore))
          : null,
    };
  });

  // ---------- Pencere özeti ----------

  const toplamDers = [...dersSayilari.values()].reduce((t, d) => t + d, 0);
  const toplamDavranis = new Map<BehaviorType, number>();
  for (const satir of davranisSinif) ekle(toplamDavranis, satir.type, satir._count._all);

  return {
    bekleyen: {
      gecikmisOdev: bekleyenOdev,
      acikCeza,
      veliTaslagi,
      acikHedef,
    },
    dikkat,
    siniflar: sinifSatirlari,
    ozet: {
      ders: toplamDers,
      arti: toplamDavranis.get("PLUS") ?? 0,
      eksi: Math.max(
        (toplamDavranis.get("MINUS") ?? 0) - (toplamDavranis.get("RED_CARD") ?? 0),
        0,
      ),
      sariKart: toplamDavranis.get("YELLOW_CARD") ?? 0,
      kirmiziKart: toplamDavranis.get("RED_CARD") ?? 0,
      tamamlananTeslim,
      gonderilenMesaj,
    },
  };
}
