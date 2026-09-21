import type { BehaviorTemplate, BehaviorType, SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { donemAnahtari, donemBul, type Donem } from "@/lib/exam-rules";
import { sayimlariHesapla } from "@/lib/assignment";
import {
  degisimHesapla,
  dersBasina,
  olcuEsigi,
  OLCU_IYI_YON,
  type Degisim,
  type OlcuAnahtari,
} from "@/lib/progress-rules";

// Öğrenci gelişim görünümünün sorgu katmanı.
//
// Yeni bir veri modeli yok: her sayı mevcut kayıtlardan hesaplanır. Dönem de
// ayrı bir tabloda durmaz, `donemBul` ile TARİHTEN türetilir — sınav için
// zaten böyleydi, davranış ve ödev de aynı saf fonksiyona veriliyor.
//
// Sahiplik her sorgunun parçası: başkasının öğrencisi için boş döner.

/** Bir dönemin ham sayıları. Oranlar bunlardan hesaplanır. */
type DonemKovasi = {
  donem: Donem;
  resmiYuzdeler: number[];
  /** Kayıt tipleri ham hâlde; "olumsuz" sayısı şablona göre bunlardan türetilir. */
  sayimlar: Record<BehaviorType, number>;
  dersSayisi: number;
  teslimDurumlari: SubmissionStatus[];
};

/**
 * Dönemdeki "olumsuz" davranış sayısı. Şablona göre DEĞİŞİR ve bu fark
 * atlanırsa ölçü sessizce yanlış olur:
 *
 * - Basit şablonda öğretmen doğrudan eksi verir, karşılığı MINUS'tur.
 * - Kart şablonunda eksi diye bir düğme yoktur; her kırmızı kart yanında
 *   otomatik bir MINUS yazar. Yani MINUS sayısı kırmızı kart sayısına eşittir
 *   ve "MINUS - RED_CARD" her zaman sıfır çıkar. Orada anlamlı olan sayı
 *   verilen kartlardır (sarı + kırmızı).
 */
function olumsuzSayisi(
  sayimlar: Record<BehaviorType, number>,
  sablon: BehaviorTemplate,
): number {
  if (sablon === "CARD") return sayimlar.YELLOW_CARD + sayimlar.RED_CARD;
  return Math.max(sayimlar.MINUS - sayimlar.RED_CARD, 0);
}

export type GelisimOlcusu = {
  anahtar: OlcuAnahtari;
  birim: "YUZDE" | "DERS_BASI";
  degisim: Degisim;
  /** Ham sayı: sınavda sınav adedi, davranışta kayıt adedi, ödevde teslim adedi. */
  oncekiAdet: number;
  simdiAdet: number;
};

export type GelisimSonucu =
  | { durum: "VERI_YOK" }
  | { durum: "TEK_DONEM"; donem: Donem }
  | {
      durum: "KARSILASTIRMA";
      onceki: Donem;
      simdi: Donem;
      oncekiDers: number;
      simdiDers: number;
      /** Yalnızca sınıf gelişiminde dolu: davranış birimi buna da bölünür. */
      ogrenciSayisi?: number;
      olculer: GelisimOlcusu[];
    };

function kova(kovalar: Map<string, DonemKovasi>, tarih: Date): DonemKovasi {
  const donem = donemBul(tarih);
  const anahtar = donemAnahtari(donem);
  let mevcut = kovalar.get(anahtar);
  if (!mevcut) {
    mevcut = {
      donem,
      resmiYuzdeler: [],
      sayimlar: { PLUS: 0, MINUS: 0, YELLOW_CARD: 0, RED_CARD: 0 },
      dersSayisi: 0,
      teslimDurumlari: [],
    };
    kovalar.set(anahtar, mevcut);
  }
  return mevcut;
}

function ortalama(degerler: number[]): number | null {
  if (degerler.length === 0) return null;
  return Math.round((degerler.reduce((t, d) => t + d, 0) / degerler.length) * 10) / 10;
}

/**
 * Öğrencinin son iki dönemi ve aradaki değişim.
 *
 * Karşılaştırılan iki dönem BUGÜNÜN tarihinden değil, veride kayıt bulunan
 * son iki dönemden seçilir. Dönem ortasında bugüne bakmak, henüz verisi
 * olmayan bir dönemi "düştü" gibi gösterirdi.
 *
 * Bir ölçü dönemlerden yalnızca birinde varsa o ölçü için ok çıkmaz
 * (`YETERSIZ`): eksik veriden yön üretilmez.
 *
 * `hedefDonem` verilirse o dönem ile ONDAN ÖNCEKİ dönem karşılaştırılır.
 * Rapor için gerekli: geçmiş bir dönemin raporunu alırken "son iki dönem"
 * değil, o dönemin kendi hikâyesi anlatılmalı.
 */
export async function ogrenciGelisimi(
  ogrenciId: string,
  ogretmenId: string,
  sablon: BehaviorTemplate,
  hedefDonem?: Donem | null,
): Promise<GelisimSonucu> {
  const ogrenci = await prisma.student.findFirst({
    where: { id: ogrenciId, classroom: { teacherId: ogretmenId } },
    select: { id: true, classroomId: true },
  });
  if (!ogrenci) return { durum: "VERI_YOK" };

  const [sinavlar, kayitlar, dersler, teslimler] = await Promise.all([
    prisma.examResult.findMany({
      where: {
        studentId: ogrenciId,
        isAbsent: false,
        score: { not: null },
        exam: { teacherId: ogretmenId, scope: "OFFICIAL" },
      },
      select: { score: true, exam: { select: { examDate: true, maxScore: true } } },
    }),

    prisma.behaviorLog.findMany({
      where: { studentId: ogrenciId, teacher: { id: ogretmenId } },
      select: { type: true, createdAt: true },
    }),

    // Ders başına normalleştirme için: öğrencinin sınıfında o dönem kaç ders
    // işlendi. Sınıfı olmayan (arşivlenmiş) öğrencide ders sayısı 0 kalır ve
    // davranış ölçüleri "veri yok" sayılır — sıfıra bölme yapılmaz.
    ogrenci.classroomId
      ? prisma.lesson.findMany({
          where: {
            classroomId: ogrenci.classroomId,
            classroom: { teacherId: ogretmenId },
          },
          select: { date: true },
        })
      : Promise.resolve([] as { date: Date }[]),

    prisma.submission.findMany({
      where: { studentId: ogrenciId, assignment: { teacherId: ogretmenId } },
      select: {
        status: true,
        assignment: { select: { dueDate: true, createdAt: true } },
      },
    }),
  ]);

  const kovalar = new Map<string, DonemKovasi>();

  for (const sonuc of sinavlar) {
    if (sonuc.score === null || sonuc.exam.maxScore <= 0) continue;
    kova(kovalar, sonuc.exam.examDate).resmiYuzdeler.push(
      (sonuc.score / sonuc.exam.maxScore) * 100,
    );
  }

  for (const kayit of kayitlar) {
    kova(kovalar, kayit.createdAt).sayimlar[kayit.type] += 1;
  }

  for (const ders of dersler) {
    kova(kovalar, ders.date).dersSayisi += 1;
  }

  for (const teslim of teslimler) {
    // Ödev hangi döneme ait: teslim tarihi varsa o, yoksa verildiği tarih.
    const tarih = teslim.assignment.dueDate ?? teslim.assignment.createdAt;
    kova(kovalar, tarih).teslimDurumlari.push(teslim.status);
  }

  // Yalnızca ders kaydı olan ama başka hiçbir verisi olmayan dönemler
  // karşılaştırmaya girmesin: ekranda her satırı "—" olan bir dönem çifti
  // öğretmene hiçbir şey söylemez.
  const dolu = [...kovalar.values()].filter(
    (k) =>
      k.resmiYuzdeler.length > 0 ||
      k.sayimlar.PLUS > 0 ||
      olumsuzSayisi(k.sayimlar, sablon) > 0 ||
      k.teslimDurumlari.length > 0,
  );

  const sirali = dolu.sort(
    (a, b) => a.donem.yil - b.donem.yil || a.donem.sira - b.donem.sira,
  );

  if (sirali.length === 0) return { durum: "VERI_YOK" };

  // Hedef dönem verilmemişse en yenisi; verilmişse onun sırası bulunur.
  const hedefSira = hedefDonem
    ? sirali.findIndex((k) => donemAnahtari(k.donem) === donemAnahtari(hedefDonem))
    : sirali.length - 1;

  // Hedef dönemin hiç verisi yoksa karşılaştırılacak bir şey de yoktur.
  if (hedefSira < 0) return { durum: "VERI_YOK" };
  // Öncesinde dönem yoksa ok uydurulmaz; ilk dönem kendisiyle kıyaslanamaz.
  if (hedefSira === 0) return { durum: "TEK_DONEM", donem: sirali[0].donem };

  const onceki = sirali[hedefSira - 1];
  const simdi = sirali[hedefSira];

  const olcu = (
    anahtar: OlcuAnahtari,
    birim: "YUZDE" | "DERS_BASI",
    oncekiDeger: number | null,
    simdiDeger: number | null,
    oncekiAdet: number,
    simdiAdet: number,
  ): GelisimOlcusu => ({
    anahtar,
    birim,
    degisim: degisimHesapla(
      oncekiDeger,
      simdiDeger,
      olcuEsigi(anahtar),
      OLCU_IYI_YON[anahtar],
    ),
    oncekiAdet,
    simdiAdet,
  });

  const oran = (durumlar: SubmissionStatus[]) =>
    durumlar.length === 0 ? null : sayimlariHesapla(durumlar).oran;

  return {
    durum: "KARSILASTIRMA",
    onceki: onceki.donem,
    simdi: simdi.donem,
    oncekiDers: onceki.dersSayisi,
    simdiDers: simdi.dersSayisi,
    olculer: [
      olcu(
        "SINAV",
        "YUZDE",
        ortalama(onceki.resmiYuzdeler),
        ortalama(simdi.resmiYuzdeler),
        onceki.resmiYuzdeler.length,
        simdi.resmiYuzdeler.length,
      ),
      olcu(
        "ARTI",
        "DERS_BASI",
        dersBasina(onceki.sayimlar.PLUS, onceki.dersSayisi),
        dersBasina(simdi.sayimlar.PLUS, simdi.dersSayisi),
        onceki.sayimlar.PLUS,
        simdi.sayimlar.PLUS,
      ),
      olcu(
        "EKSI",
        "DERS_BASI",
        dersBasina(olumsuzSayisi(onceki.sayimlar, sablon), onceki.dersSayisi),
        dersBasina(olumsuzSayisi(simdi.sayimlar, sablon), simdi.dersSayisi),
        olumsuzSayisi(onceki.sayimlar, sablon),
        olumsuzSayisi(simdi.sayimlar, sablon),
      ),
      olcu(
        "ODEV",
        "YUZDE",
        oran(onceki.teslimDurumlari),
        oran(simdi.teslimDurumlari),
        onceki.teslimDurumlari.length,
        simdi.teslimDurumlari.length,
      ),
    ],
  };
}

// ---------- Sınıf gelişimi ----------

/**
 * Bir sınıfın son iki dönemi. Öğrenci gelişimiyle aynı kurallar, tek farkla:
 * davranış sayıları ders sayısının YANINDA öğrenci sayısına da bölünür.
 *
 * Neden: 25 kişilik bir sınıf doğal olarak 10 kişilikten çok yıldız toplar,
 * ve mevcut dönemden döneme değişebilir. Öğrenci başına indirgeyince sayı
 * öğrenci gelişimindekiyle AYNI birime gelir — bir öğrencinin 0.6'sı sınıfın
 * 0.4'üyle doğrudan karşılaştırılabilir.
 *
 * Mevcut sayısı BUGÜNÜN aktif öğrenci sayısıdır; dönem dönem sınıf mevcudu
 * tutulmuyor. İki dönem için de aynı bölen kullanıldığından okun YÖNÜ bundan
 * etkilenmez, yalnızca sayının büyüklüğü yaklaşıktır.
 *
 * Karne ortalaması sınıf raporundaki ile aynı şekilde hesaplanır (önce
 * öğrenci ortalaması, sonra öğrenciler arası ortalama) — aynı uygulamada iki
 * farklı "sınıf karne ortalaması" olmasın.
 */
export async function sinifGelisimi(
  sinifId: string,
  ogretmenId: string,
  sablon: BehaviorTemplate,
  hedefDonem?: Donem | null,
): Promise<GelisimSonucu> {
  const sinif = await prisma.classroom.findFirst({
    where: { id: sinifId, teacherId: ogretmenId },
    select: { students: { where: { isActive: true }, select: { id: true } } },
  });
  if (!sinif) return { durum: "VERI_YOK" };

  const ogrenciIdleri = sinif.students.map((o) => o.id);
  const ogrenciSayisi = ogrenciIdleri.length;

  const [kayitlar, dersler, sonuclar, teslimler] = await Promise.all([
    prisma.behaviorLog.findMany({
      where: { classroomId: sinifId, teacherId: ogretmenId },
      select: { type: true, createdAt: true },
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
          select: { status: true, assignment: { select: { dueDate: true } } },
        }),
  ]);

  const kovalar = new Map<string, DonemKovasi>();
  // Karne ortalaması için dönem → öğrenci → yüzdeler.
  const donemOgrenciYuzdeleri = new Map<string, Map<string, number[]>>();

  for (const kayit of kayitlar) {
    kova(kovalar, kayit.createdAt).sayimlar[kayit.type] += 1;
  }
  for (const ders of dersler) {
    kova(kovalar, ders.date).dersSayisi += 1;
  }
  for (const sonuc of sonuclar) {
    if (sonuc.score === null || sonuc.exam.maxScore <= 0) continue;
    const k = kova(kovalar, sonuc.exam.examDate);
    const anahtar = donemAnahtari(k.donem);
    let ogrenciler = donemOgrenciYuzdeleri.get(anahtar);
    if (!ogrenciler) {
      ogrenciler = new Map();
      donemOgrenciYuzdeleri.set(anahtar, ogrenciler);
    }
    const liste = ogrenciler.get(sonuc.studentId) ?? [];
    liste.push((sonuc.score / sonuc.exam.maxScore) * 100);
    ogrenciler.set(sonuc.studentId, liste);
  }
  for (const teslim of teslimler) {
    // Tarihsiz ödev hiçbir döneme düşmez (rapordaki aynı kural).
    if (!teslim.assignment.dueDate) continue;
    kova(kovalar, teslim.assignment.dueDate).teslimDurumlari.push(teslim.status);
  }

  /** Bir dönemin karne ortalaması: önce öğrenci, sonra öğrenciler arası. */
  const karne = (k: DonemKovasi): number | null => {
    const ogrenciler = donemOgrenciYuzdeleri.get(donemAnahtari(k.donem));
    if (!ogrenciler || ogrenciler.size === 0) return null;
    const ogrenciOrtalamalari = [...ogrenciler.values()]
      .map((liste) => ortalama(liste))
      .filter((d): d is number => d !== null);
    return ortalama(ogrenciOrtalamalari);
  };

  const dolu = [...kovalar.values()].filter(
    (k) =>
      karne(k) !== null ||
      k.sayimlar.PLUS > 0 ||
      olumsuzSayisi(k.sayimlar, sablon) > 0 ||
      k.teslimDurumlari.length > 0,
  );
  const sirali = dolu.sort(
    (a, b) => a.donem.yil - b.donem.yil || a.donem.sira - b.donem.sira,
  );

  if (sirali.length === 0) return { durum: "VERI_YOK" };

  const hedefSira = hedefDonem
    ? sirali.findIndex((k) => donemAnahtari(k.donem) === donemAnahtari(hedefDonem))
    : sirali.length - 1;
  if (hedefSira < 0) return { durum: "VERI_YOK" };
  if (hedefSira === 0) return { durum: "TEK_DONEM", donem: sirali[0].donem };

  const onceki = sirali[hedefSira - 1];
  const simdi = sirali[hedefSira];

  /** Ders başına öğrenci başına. Bölenlerden biri sıfırsa null. */
  const ogrenciDersBasina = (adet: number, dersSayisi: number): number | null =>
    ogrenciSayisi <= 0 ? null : dersBasina(adet, dersSayisi * ogrenciSayisi);

  const olcu = (
    anahtar: OlcuAnahtari,
    birim: "YUZDE" | "DERS_BASI",
    oncekiDeger: number | null,
    simdiDeger: number | null,
    oncekiAdet: number,
    simdiAdet: number,
  ): GelisimOlcusu => ({
    anahtar,
    birim,
    degisim: degisimHesapla(
      oncekiDeger,
      simdiDeger,
      olcuEsigi(anahtar),
      OLCU_IYI_YON[anahtar],
    ),
    oncekiAdet,
    simdiAdet,
  });

  const oran = (durumlar: SubmissionStatus[]) =>
    durumlar.length === 0 ? null : sayimlariHesapla(durumlar).oran;

  const oncekiOlumsuz = olumsuzSayisi(onceki.sayimlar, sablon);
  const simdiOlumsuz = olumsuzSayisi(simdi.sayimlar, sablon);

  return {
    durum: "KARSILASTIRMA",
    onceki: onceki.donem,
    simdi: simdi.donem,
    oncekiDers: onceki.dersSayisi,
    simdiDers: simdi.dersSayisi,
    ogrenciSayisi,
    olculer: [
      olcu(
        "SINAV",
        "YUZDE",
        karne(onceki),
        karne(simdi),
        donemOgrenciYuzdeleri.get(donemAnahtari(onceki.donem))?.size ?? 0,
        donemOgrenciYuzdeleri.get(donemAnahtari(simdi.donem))?.size ?? 0,
      ),
      olcu(
        "ARTI",
        "DERS_BASI",
        ogrenciDersBasina(onceki.sayimlar.PLUS, onceki.dersSayisi),
        ogrenciDersBasina(simdi.sayimlar.PLUS, simdi.dersSayisi),
        onceki.sayimlar.PLUS,
        simdi.sayimlar.PLUS,
      ),
      olcu(
        "EKSI",
        "DERS_BASI",
        ogrenciDersBasina(oncekiOlumsuz, onceki.dersSayisi),
        ogrenciDersBasina(simdiOlumsuz, simdi.dersSayisi),
        oncekiOlumsuz,
        simdiOlumsuz,
      ),
      olcu(
        "ODEV",
        "YUZDE",
        oran(onceki.teslimDurumlari),
        oran(simdi.teslimDurumlari),
        onceki.teslimDurumlari.length,
        simdi.teslimDurumlari.length,
      ),
    ],
  };
}
