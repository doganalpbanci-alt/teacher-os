import type { ComponentEntry, ExamScope, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { turkceSirala } from "@/lib/siralama";
import {
  BOS_GIRDI,
  bilesenleriDogrula,
  bilesenPuani,
  bilesenYuzdesi,
  donemBul,
  girdiyiDogrula,
  netHesapla,
  sinavPuani,
  yuvarla,
  type Bilesen,
  type BilesenGirdisi,
  type BilesenTanimi,
  type Donem,
} from "@/lib/exam-rules";

// Sınav yönetimi tek yerde toplanır: sınavın kime verildiği, nasıl okunduğu,
// notunun nasıl girildiği ve ortalamaların nasıl hesaplandığı burada tanımlıdır.
// Hesabın kendisi `exam-rules.ts` içindedir; ekran da aynı fonksiyonları
// kullanır, kural iki yere kopyalanmaz.
//
// Temel kural: sınav bir sınıfa değil öğretmene aittir. Kime verildiği
// ExamResult satırlarında yazılıdır; sınıf üyeliği oradan türetilir. Ödevdeki
// kararın aynısı — böylece aynı deneme üç şubeye verilip ortalamaları
// karşılaştırılabilir.
//
// İkinci kural: ExamResult.score TÜRETİLMİŞ değerdir. Kaynak bileşen
// girdileridir; puan her yazmada yeniden hesaplanır ve cache olarak saklanır.

const ZAMAN_DILIMI = "Europe/Istanbul";
const LISTE_SINIRI = 100;

export class SinavHatasi extends Error {}

function gunAnahtari(tarih: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZAMAN_DILIMI,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(tarih);
}

export function sinavTarihiYazisi(tarih: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: ZAMAN_DILIMI,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(tarih);
}

export function tarihGirdisi(tarih: Date | null): string {
  return tarih ? gunAnahtari(tarih) : "";
}

// ---------- Ortak select ----------

const BILESEN_ALANLARI = {
  id: true,
  name: true,
  weight: true,
  maxScore: true,
  entry: true,
  questionCount: true,
  wrongDivisor: true,
  order: true,
} satisfies Prisma.ExamComponentSelect;

const SINAV_ALANLARI = {
  id: true,
  title: true,
  examDate: true,
  maxScore: true,
  scope: true,
} satisfies Prisma.ExamSelect;

// ---------- Tipler ----------

export type SinavAlanlari = {
  title: string;
  examDate: Date;
  maxScore: number;
  scope: ExamScope;
};

export type SinavSayimlari = {
  /** Sınavın verildiği öğrenci sayısı. */
  toplam: number;
  /** Notu tamamlanmış öğrenci. */
  girilmis: number;
  /** Notu eksik ya da hiç girilmemiş. */
  bekleyen: number;
  /** Sınava girmedi işaretlenmiş. */
  girmeyen: number;
  /** Girilmiş puanların ortalaması, sınavın tam puanı üzerinden. */
  ortalama: number | null;
  /** Aynı ortalamanın yüzde karşılığı. Farklı sınavlar bununla kıyaslanır. */
  ortalamaYuzde: number | null;
};

/**
 * Hesap tipi `Bilesen` sıra taşımaz — sıralama puanı etkilemez, yalnızca
 * ekrandaki sütun düzenidir. Okuma tarafı ikisini birlikte kullanır.
 */
export type SiraliBilesen = Bilesen & { order: number };

export type SinavOzeti = {
  id: string;
  title: string;
  examDate: Date;
  maxScore: number;
  scope: ExamScope;
  donem: Donem;
  bilesenler: SiraliBilesen[];
  sayimlar: SinavSayimlari;
};

// ---------- Hesap yardımcıları ----------

type HamGirdi = {
  componentId: string;
  score: number | null;
  correct: number | null;
  wrong: number | null;
  blank: number | null;
};

function girdiHaritasi(girdiler: HamGirdi[]): Map<string, BilesenGirdisi> {
  return new Map(
    girdiler.map((g) => [
      g.componentId,
      { score: g.score, correct: g.correct, wrong: g.wrong, blank: g.blank },
    ]),
  );
}

function bilesenleriSirala<T extends { order: number; name: string }>(bilesenler: T[]): T[] {
  return [...bilesenler].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "tr"));
}

/**
 * Bir sınavın sayımları. Ortalama YALNIZCA notu tamamlanmış öğrencilerden
 * hesaplanır: eksik giriş ortalamayı aşağı çekmemeli, sınava girmeyen de
 * ortalamaya karışmamalı.
 */
function sayimlariHesapla(
  sonuclar: { score: number | null; isAbsent: boolean }[],
  maxScore: number,
): SinavSayimlari {
  let girilmis = 0;
  let girmeyen = 0;
  let toplamPuan = 0;

  for (const sonuc of sonuclar) {
    if (sonuc.isAbsent) {
      girmeyen += 1;
      continue;
    }
    if (sonuc.score !== null) {
      girilmis += 1;
      toplamPuan += sonuc.score;
    }
  }

  const ortalama = girilmis === 0 ? null : yuvarla(toplamPuan / girilmis);
  return {
    toplam: sonuclar.length,
    girilmis,
    girmeyen,
    bekleyen: sonuclar.length - girilmis - girmeyen,
    ortalama,
    ortalamaYuzde:
      ortalama === null || maxScore <= 0 ? null : yuvarla((ortalama / maxScore) * 100),
  };
}

function ozetKur(
  sinav: {
    id: string;
    title: string;
    examDate: Date;
    maxScore: number;
    scope: ExamScope;
    components: SiraliBilesen[];
  },
  sonuclar: { score: number | null; isAbsent: boolean }[],
): SinavOzeti {
  return {
    id: sinav.id,
    title: sinav.title,
    examDate: sinav.examDate,
    maxScore: sinav.maxScore,
    scope: sinav.scope,
    donem: donemBul(sinav.examDate),
    bilesenler: bilesenleriSirala(sinav.components),
    sayimlar: sayimlariHesapla(sonuclar, sinav.maxScore),
  };
}

// ---------- Hedef seçimi ----------

/**
 * Verilen id'lerden yalnızca öğretmene ait olanları döndürür. Form istemciden
 * geldiği için id listesi uydurulmuş olabilir; sahiplik burada sorgunun
 * parçası olarak süzülür, ayrı bir kontrol katmanı yoktur.
 */
async function gecerliOgrenciIdleri(
  ogrenciIdleri: string[],
  ogretmenId: string,
): Promise<string[]> {
  if (ogrenciIdleri.length === 0) return [];
  const ogrenciler = await prisma.student.findMany({
    where: { id: { in: ogrenciIdleri }, classroom: { teacherId: ogretmenId } },
    select: { id: true },
  });
  return ogrenciler.map((o) => o.id);
}

// ---------- Yazma ----------

/**
 * Yeni sınav açar: bileşenlerini tanımlar ve seçilen öğrencilere boş sonuç
 * kaydı oluşturur. Boş sonuç "bu sınav bu öğrenciye verildi, notu henüz
 * girilmedi" demektir — ödevdeki PENDING satırının karşılığı.
 */
export async function sinavOlustur(
  ogretmenId: string,
  alanlar: SinavAlanlari,
  bilesenler: BilesenTanimi[],
  ogrenciIdleri: string[],
): Promise<string> {
  bilesenleriDogrula(bilesenler);

  const gecerli = await gecerliOgrenciIdleri(ogrenciIdleri, ogretmenId);
  if (gecerli.length === 0) {
    throw new SinavHatasi("En az bir öğrenci seçmelisiniz.");
  }

  const sinav = await prisma.exam.create({
    data: {
      teacherId: ogretmenId,
      ...alanlar,
      components: {
        // Alanlar tek tek yazılır, `...b` ile yayılmaz: çağıran taraf form
        // satırını taşıyor ve onda düzenlemede kullanılan bir `id` alanı var.
        // Yayılırsa yeni bileşene `id: null` gider ve kayıt reddedilir.
        // TypeScript bunu yakalamaz; fazladan alan kontrolü yalnızca nesne
        // değişmezlerinde çalışır, değişken geçilince değil.
        create: bilesenler.map((b, sira) => ({
          name: b.name,
          weight: b.weight,
          maxScore: b.maxScore,
          entry: b.entry,
          questionCount: b.questionCount,
          wrongDivisor: b.wrongDivisor,
          order: sira,
        })),
      },
      results: { create: gecerli.map((id) => ({ studentId: id })) },
    },
    select: { id: true },
  });
  return sinav.id;
}

/**
 * Sınavın alanlarını, bileşenlerini ve öğrenci listesini günceller.
 *
 * Bileşen listesinden çıkarılan bir bileşenin girdileri silinir (veritabanında
 * Cascade), listeden çıkarılan öğrencinin sonucu da öyle. İkisi de bilinçli:
 * ödevdeki kararın aynısı, ekran kaç kaydın kaybolacağını önceden yazar.
 *
 * Bileşenler değişince kalan öğrencilerin puanı yeniden hesaplanır — ağırlık
 * değiştiyse eski cache yanlış olurdu.
 */
export async function sinavGuncelle(
  sinavId: string,
  ogretmenId: string,
  alanlar: SinavAlanlari,
  bilesenler: (BilesenTanimi & { id: string | null })[],
  ogrenciIdleri: string[],
): Promise<void> {
  bilesenleriDogrula(bilesenler);

  const sinav = await prisma.exam.findFirst({
    where: { id: sinavId, teacherId: ogretmenId },
    select: {
      id: true,
      components: { select: { id: true } },
      results: { select: { id: true, studentId: true } },
    },
  });
  if (!sinav) throw new SinavHatasi("Sınav bulunamadı.");

  const gecerli = await gecerliOgrenciIdleri(ogrenciIdleri, ogretmenId);
  if (gecerli.length === 0) {
    throw new SinavHatasi("En az bir öğrenci seçmelisiniz.");
  }

  // Var olan bileşenlerden hangileri korunuyor. Uydurulmuş id gelirse
  // eşleşmez ve yeni bileşen olarak açılır; başka sınava sızamaz.
  const mevcutBilesenler = new Set(sinav.components.map((b) => b.id));
  const korunan = new Set(
    bilesenler.map((b) => b.id).filter((id): id is string => !!id && mevcutBilesenler.has(id)),
  );
  const silinecekBilesenler = sinav.components
    .filter((b) => !korunan.has(b.id))
    .map((b) => b.id);

  const istenen = new Set(gecerli);
  const mevcutOgrenciler = new Set(sinav.results.map((s) => s.studentId));
  const eklenecek = gecerli.filter((id) => !mevcutOgrenciler.has(id));
  const silinecekSonuclar = sinav.results
    .filter((s) => !istenen.has(s.studentId))
    .map((s) => s.id);

  await prisma.$transaction([
    prisma.exam.update({ where: { id: sinav.id }, data: alanlar }),
    prisma.examComponent.deleteMany({ where: { id: { in: silinecekBilesenler } } }),
    ...bilesenler
      .filter((b) => b.id && korunan.has(b.id))
      .map((b, sira) =>
        prisma.examComponent.update({
          where: { id: b.id as string },
          data: {
            name: b.name,
            weight: b.weight,
            maxScore: b.maxScore,
            entry: b.entry,
            questionCount: b.questionCount,
            wrongDivisor: b.wrongDivisor,
            order: sira,
          },
        }),
      ),
    ...bilesenler
      .filter((b) => !b.id || !korunan.has(b.id))
      .map((b, sira) =>
        prisma.examComponent.create({
          data: {
            examId: sinav.id,
            name: b.name,
            weight: b.weight,
            maxScore: b.maxScore,
            entry: b.entry,
            questionCount: b.questionCount,
            wrongDivisor: b.wrongDivisor,
            // Korunanlardan sonra gelsinler; sıra aşağıda yeniden yazılır.
            order: bilesenler.length + sira,
          },
        }),
      ),
    prisma.examResult.deleteMany({ where: { id: { in: silinecekSonuclar } } }),
    prisma.examResult.createMany({
      data: eklenecek.map((studentId) => ({ examId: sinav.id, studentId })),
    }),
  ]);

  // Sıra numaralarını formdaki sıraya göre düzelt ve puanları yenile.
  await siralamaVePuanlariYenile(sinav.id, bilesenler);
}

/**
 * Bileşen sırasını formdaki sıraya çeker ve tüm öğrencilerin puanını yeniden
 * hesaplar. Ağırlık ya da tam puan değiştiyse eski cache yanlıştır.
 */
async function siralamaVePuanlariYenile(
  sinavId: string,
  istenenSira: { name: string }[],
): Promise<void> {
  const bilesenler = await prisma.examComponent.findMany({
    where: { examId: sinavId },
    select: { id: true, name: true },
  });
  const sira = new Map(istenenSira.map((b, i) => [b.name, i]));
  await prisma.$transaction(
    bilesenler.map((b) =>
      prisma.examComponent.update({
        where: { id: b.id },
        data: { order: sira.get(b.name) ?? bilesenler.length },
      }),
    ),
  );
  await sinavPuanlariniYenile(sinavId);
}

/** Sınavdaki bütün öğrencilerin puanını bileşen girdilerinden yeniden yazar. */
export async function sinavPuanlariniYenile(sinavId: string): Promise<void> {
  const sinav = await prisma.exam.findUnique({
    where: { id: sinavId },
    select: {
      maxScore: true,
      components: { select: BILESEN_ALANLARI },
      results: {
        select: {
          id: true,
          score: true,
          entries: {
            select: {
              componentId: true,
              score: true,
              correct: true,
              wrong: true,
              blank: true,
            },
          },
        },
      },
    },
  });
  if (!sinav) return;

  const bilesenler = bilesenleriSirala(sinav.components);
  const guncellemeler = [];

  for (const sonuc of sinav.results) {
    const { puan } = sinavPuani(bilesenler, girdiHaritasi(sonuc.entries), sinav.maxScore);
    // Değişmeyeni yazmaya gerek yok; kalabalık sınıfta boşuna sorgu olur.
    if (puan !== sonuc.score) {
      guncellemeler.push(
        prisma.examResult.update({ where: { id: sonuc.id }, data: { score: puan } }),
      );
    }
  }

  if (guncellemeler.length > 0) await prisma.$transaction(guncellemeler);
}

/**
 * Tek bir öğrencinin bir bileşendeki girdisini yazar ve sınav puanını yeniler.
 * Not girme ekranındaki her hücre bunu çağırır.
 */
export async function girdiYaz(
  sonucId: string,
  bilesenId: string,
  ogretmenId: string,
  girdi: BilesenGirdisi,
): Promise<void> {
  // Sahiplik sorgunun parçası: sonuç -> sınav -> öğretmen.
  const sonuc = await prisma.examResult.findFirst({
    where: { id: sonucId, exam: { teacherId: ogretmenId } },
    select: {
      id: true,
      examId: true,
      exam: { select: { components: { select: BILESEN_ALANLARI } } },
    },
  });
  if (!sonuc) throw new SinavHatasi("Sınav kaydı bulunamadı.");

  const bilesen = sonuc.exam.components.find((b) => b.id === bilesenId);
  if (!bilesen) throw new SinavHatasi("Sınav bileşeni bulunamadı.");

  girdiyiDogrula(bilesen, girdi);

  const bos =
    girdi.score === null &&
    girdi.correct === null &&
    girdi.wrong === null &&
    girdi.blank === null;

  if (bos) {
    // Boş bırakmak "girilmedi"ye dönmektir; satırı silmek doğru olan.
    await prisma.examResultComponent.deleteMany({
      where: { resultId: sonuc.id, componentId: bilesen.id },
    });
  } else {
    await prisma.examResultComponent.upsert({
      where: { resultId_componentId: { resultId: sonuc.id, componentId: bilesen.id } },
      create: { resultId: sonuc.id, componentId: bilesen.id, ...girdi },
      update: girdi,
    });
  }

  await sinavPuanlariniYenile(sonuc.examId);
}

/** Öğrenciyi "sınava girmedi" olarak işaretler ya da işareti kaldırır. */
export async function girmediIsaretle(
  sonucId: string,
  ogretmenId: string,
  girmedi: boolean,
): Promise<void> {
  const sonuc = await prisma.examResult.findFirst({
    where: { id: sonucId, exam: { teacherId: ogretmenId } },
    select: { id: true },
  });
  if (!sonuc) throw new SinavHatasi("Sınav kaydı bulunamadı.");

  await prisma.examResult.update({
    where: { id: sonuc.id },
    data: { isAbsent: girmedi },
  });
}

/**
 * Sınavı kalıcı siler. Yalnızca hiçbir girdi yapılmamışsa mümkündür:
 * yanlışlıkla açılan sınav iz bırakmadan kalkar, ama girilmiş bir not
 * öğretmenin verdiği bir karardır ve silinerek yok edilmez.
 */
export async function sinavSil(sinavId: string, ogretmenId: string): Promise<void> {
  const sinav = await prisma.exam.findFirst({
    where: { id: sinavId, teacherId: ogretmenId },
    select: {
      id: true,
      results: {
        where: { OR: [{ entries: { some: {} } }, { isAbsent: true }] },
        select: { id: true },
      },
    },
  });
  if (!sinav) throw new SinavHatasi("Sınav bulunamadı.");
  if (sinav.results.length > 0) {
    throw new SinavHatasi(
      `Bu sınavda ${sinav.results.length} öğrencinin kaydı işlenmiş. Sınav silinemez.`,
    );
  }

  // Sıra önemli: ExamResult -> Exam bağlantısı RESTRICT, önce çocuk kayıtlar
  // gider. Bileşenler Cascade olduğu için sınavla birlikte düşer.
  await prisma.$transaction([
    prisma.examResult.deleteMany({ where: { examId: sinav.id } }),
    prisma.exam.delete({ where: { id: sinav.id } }),
  ]);
}

// ---------- Okuma ----------

export type SinavFiltresi = "tumu" | "resmi" | "deneme";

/** Öğretmenin sınavları, en yeniden eskiye. */
export async function ogretmenSinavlari(
  ogretmenId: string,
  filtre: SinavFiltresi,
): Promise<SinavOzeti[]> {
  const kosul =
    filtre === "resmi"
      ? { scope: "OFFICIAL" as const }
      : filtre === "deneme"
        ? { scope: "PRACTICE" as const }
        : {};

  const sinavlar = await prisma.exam.findMany({
    where: { teacherId: ogretmenId, ...kosul },
    orderBy: { examDate: "desc" },
    take: LISTE_SINIRI,
    select: {
      ...SINAV_ALANLARI,
      components: { select: BILESEN_ALANLARI },
      results: { select: { score: true, isAbsent: true } },
    },
  });

  return sinavlar.map((s) => ozetKur(s, s.results));
}

/**
 * Bir sınıfa verilmiş sınavlar. Sayımlar YALNIZCA o sınıfın öğrencilerinden
 * hesaplanır; aynı sınav başka şubeye de verilmişse oradaki puanlar bu
 * listeye karışmaz.
 */
export async function sinifSinavlari(
  sinifId: string,
  ogretmenId: string,
): Promise<SinavOzeti[]> {
  const sinavlar = await prisma.exam.findMany({
    where: {
      teacherId: ogretmenId,
      results: { some: { student: { classroomId: sinifId } } },
    },
    orderBy: { examDate: "desc" },
    take: LISTE_SINIRI,
    select: {
      ...SINAV_ALANLARI,
      components: { select: BILESEN_ALANLARI },
      results: {
        where: { student: { classroomId: sinifId } },
        select: { score: true, isAbsent: true },
      },
    },
  });

  return sinavlar.map((s) => ozetKur(s, s.results));
}

export type OgrenciGirdisi = BilesenGirdisi & {
  /** Bileşenin yüzdesi; boşsa null. */
  yuzde: number | null;
  /** Bileşenin ham puan karşılığı. NET bileşende net'ten hesaplanır. */
  puan: number | null;
  /** NET bileşende hesaplanan net. */
  net: number | null;
};

export type SonucSatiri = {
  sonucId: string;
  ogrenciId: string;
  ad: string;
  isAbsent: boolean;
  /** Bileşen id'sinden girdiye. */
  girdiler: Record<string, OgrenciGirdisi>;
  puan: number | null;
  yuzde: number | null;
  eksikBilesen: number;
};

export type SinifGrubu = {
  sinifId: string | null;
  sinifAdi: string;
  satirlar: SonucSatiri[];
  sayimlar: SinavSayimlari;
};

export type SinavDetayi = {
  sinav: SinavOzeti;
  gruplar: SinifGrubu[];
  /** Bileşen bazlı sınıf ortalamaları: "Listening ortalaması" sorusu. */
  bilesenOrtalamalari: BilesenOrtalamasi[];
};

export type BilesenOrtalamasi = {
  bilesenId: string;
  ad: string;
  /** Yüzde olarak ortalama; bileşenler farklı tam puanlarda olabilir. */
  ortalamaYuzde: number | null;
  girilmis: number;
};

function girdiZenginlestir(bilesen: Bilesen, ham: BilesenGirdisi): OgrenciGirdisi {
  return {
    ...ham,
    yuzde: bilesenYuzdesi(bilesen, ham),
    puan: bilesenPuani(bilesen, ham),
    net:
      bilesen.entry === "NET" && ham.correct !== null && ham.wrong !== null
        ? yuvarla(netHesapla(ham.correct, ham.wrong, bilesen.wrongDivisor))
        : null,
  };
}

/**
 * Bir sınavın öğrenci bazlı not tablosu, sınıfa göre gruplanmış. Sınav birden
 * fazla şubeye verilmiş olabilir; her şube kendi başlığı altında kendi
 * ortalamasıyla görünür.
 */
export async function sinavDetayi(
  sinavId: string,
  ogretmenId: string,
): Promise<SinavDetayi | null> {
  const sinav = await prisma.exam.findFirst({
    where: { id: sinavId, teacherId: ogretmenId },
    select: {
      ...SINAV_ALANLARI,
      components: { select: BILESEN_ALANLARI },
      results: {
        select: {
          id: true,
          score: true,
          isAbsent: true,
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              classroom: { select: { id: true, name: true } },
            },
          },
          entries: {
            select: {
              componentId: true,
              score: true,
              correct: true,
              wrong: true,
              blank: true,
            },
          },
        },
      },
    },
  });
  if (!sinav) return null;

  const bilesenler = bilesenleriSirala(sinav.components);
  const gruplar = new Map<string, SinifGrubu>();
  // Bileşen bazlı toplamlar; "sınıfın Listening ortalaması" buradan çıkar.
  const bilesenToplam = new Map<string, { toplam: number; adet: number }>();

  for (const sonuc of sinav.results) {
    const harita = girdiHaritasi(sonuc.entries);
    const girdiler: Record<string, OgrenciGirdisi> = {};

    for (const bilesen of bilesenler) {
      const ham = harita.get(bilesen.id) ?? BOS_GIRDI;
      const zengin = girdiZenginlestir(bilesen, ham);
      girdiler[bilesen.id] = zengin;

      if (!sonuc.isAbsent && zengin.yuzde !== null) {
        const t = bilesenToplam.get(bilesen.id) ?? { toplam: 0, adet: 0 };
        t.toplam += zengin.yuzde;
        t.adet += 1;
        bilesenToplam.set(bilesen.id, t);
      }
    }

    const hesap = sinavPuani(bilesenler, harita, sinav.maxScore);

    // Sınıftan çıkarılmış öğrencinin sınıfı null olur (Student.classroomId
    // SetNull). Kaydı düşürmek yerine ayrı bir başlıkta gösterilir.
    const anahtar = sonuc.student.classroom?.id ?? "";
    let grup = gruplar.get(anahtar);
    if (!grup) {
      grup = {
        sinifId: sonuc.student.classroom?.id ?? null,
        sinifAdi: sonuc.student.classroom?.name ?? "Sınıfa atanmamış",
        satirlar: [],
        sayimlar: sayimlariHesapla([], sinav.maxScore),
      };
      gruplar.set(anahtar, grup);
    }

    grup.satirlar.push({
      sonucId: sonuc.id,
      ogrenciId: sonuc.student.id,
      ad: `${sonuc.student.firstName} ${sonuc.student.lastName}`,
      isAbsent: sonuc.isAbsent,
      girdiler,
      puan: hesap.puan,
      yuzde: hesap.yuzde,
      eksikBilesen: hesap.eksikBilesen,
    });
  }

  const sirali = turkceSirala([...gruplar.values()], (g) => g.sinifAdi).map((grup) => ({
    ...grup,
    satirlar: turkceSirala(grup.satirlar, (s) => s.ad),
    sayimlar: sayimlariHesapla(
      grup.satirlar.map((s) => ({ score: s.puan, isAbsent: s.isAbsent })),
      sinav.maxScore,
    ),
  }));

  return {
    sinav: ozetKur(sinav, sinav.results),
    gruplar: sirali,
    bilesenOrtalamalari: bilesenler.map((b) => {
      const t = bilesenToplam.get(b.id);
      return {
        bilesenId: b.id,
        ad: b.name,
        ortalamaYuzde: t && t.adet > 0 ? yuvarla(t.toplam / t.adet) : null,
        girilmis: t?.adet ?? 0,
      };
    }),
  };
}

/** Düzenleme ekranı için: sınavın alanları, bileşenleri ve öğrenci id'leri. */
export type SinavDuzenlemesi = {
  id: string;
  title: string;
  examDate: Date;
  maxScore: number;
  scope: ExamScope;
  bilesenler: (Bilesen & { girdiSayisi: number })[];
  ogrenciIdleri: string[];
  /** Listeden çıkarılırsa kaybolacak, notu işlenmiş öğrenci id'leri. */
  islenmisOgrenciIdleri: string[];
};

export async function sinavDuzenlemesi(
  sinavId: string,
  ogretmenId: string,
): Promise<SinavDuzenlemesi | null> {
  const sinav = await prisma.exam.findFirst({
    where: { id: sinavId, teacherId: ogretmenId },
    select: {
      ...SINAV_ALANLARI,
      components: {
        select: { ...BILESEN_ALANLARI, _count: { select: { entries: true } } },
      },
      results: {
        select: {
          studentId: true,
          isAbsent: true,
          _count: { select: { entries: true } },
        },
      },
    },
  });
  if (!sinav) return null;

  return {
    id: sinav.id,
    title: sinav.title,
    examDate: sinav.examDate,
    maxScore: sinav.maxScore,
    scope: sinav.scope,
    bilesenler: bilesenleriSirala(sinav.components).map((b) => ({
      id: b.id,
      name: b.name,
      weight: b.weight,
      maxScore: b.maxScore,
      entry: b.entry,
      questionCount: b.questionCount,
      wrongDivisor: b.wrongDivisor,
      order: b.order,
      girdiSayisi: b._count.entries,
    })),
    ogrenciIdleri: sinav.results.map((s) => s.studentId),
    islenmisOgrenciIdleri: sinav.results
      .filter((s) => s._count.entries > 0 || s.isAbsent)
      .map((s) => s.studentId),
  };
}

// ---------- Öğrenci görünümü ----------

export type OgrenciSinavSatiri = {
  sinavId: string;
  baslik: string;
  examDate: Date;
  scope: ExamScope;
  donem: Donem;
  maxScore: number;
  puan: number | null;
  yuzde: number | null;
  isAbsent: boolean;
  /** Sınıf ortalamasının yüzdesi; öğrencinin nerede durduğu buradan okunur. */
  sinifOrtalamasiYuzde: number | null;
};

/**
 * Bir öğrencinin sınav geçmişi, en yeniden eskiye. Puan yüzdeye çevrilir:
 * sınavlar farklı tam puanlarda olduğu için ham puanlar birbiriyle
 * kıyaslanamaz, gelişim ancak yüzde üzerinden okunur.
 */
export async function ogrenciSinavlari(
  ogrenciId: string,
  ogretmenId: string,
): Promise<OgrenciSinavSatiri[]> {
  const sonuclar = await prisma.examResult.findMany({
    where: { studentId: ogrenciId, exam: { teacherId: ogretmenId } },
    orderBy: { exam: { examDate: "desc" } },
    take: LISTE_SINIRI,
    select: {
      score: true,
      isAbsent: true,
      exam: {
        select: {
          ...SINAV_ALANLARI,
          results: { select: { score: true, isAbsent: true } },
        },
      },
    },
  });

  return sonuclar.map((sonuc) => {
    const sinifSayim = sayimlariHesapla(sonuc.exam.results, sonuc.exam.maxScore);
    return {
      sinavId: sonuc.exam.id,
      baslik: sonuc.exam.title,
      examDate: sonuc.exam.examDate,
      scope: sonuc.exam.scope,
      donem: donemBul(sonuc.exam.examDate),
      maxScore: sonuc.exam.maxScore,
      puan: sonuc.score,
      yuzde:
        sonuc.score === null || sonuc.exam.maxScore <= 0
          ? null
          : yuvarla((sonuc.score / sonuc.exam.maxScore) * 100),
      isAbsent: sonuc.isAbsent,
      sinifOrtalamasiYuzde: sinifSayim.ortalamaYuzde,
    };
  });
}

export type DonemOzeti = {
  donem: Donem;
  /**
   * Karne ortalaması: yalnızca RESMÎ sınavların ortalaması, yüzde olarak.
   * Deneme ve tarama sınavları buraya karışmaz.
   */
  resmiOrtalama: number | null;
  resmiSinavSayisi: number;
  /** Deneme/tarama ortalaması, ayrı tutulur. */
  denemeOrtalama: number | null;
  denemeSinavSayisi: number;
};

/**
 * Bir öğrencinin dönem bazlı özeti. Dönem sınavın tarihinden türetilir;
 * ayrı bir tablo yoktur (bkz. `exam-rules.ts` → `donemBul`).
 *
 * Resmî ve deneme ortalamaları ayrı hesaplanır: karneye giren not ile tarama
 * sonucu aynı sayıya karışırsa ikisi de anlamını yitirir.
 */
export async function ogrenciDonemOzetleri(
  ogrenciId: string,
  ogretmenId: string,
): Promise<DonemOzeti[]> {
  const satirlar = await ogrenciSinavlari(ogrenciId, ogretmenId);

  const gruplar = new Map<
    string,
    { donem: Donem; resmi: number[]; deneme: number[] }
  >();

  for (const satir of satirlar) {
    if (satir.isAbsent || satir.yuzde === null) continue;
    const anahtar = `${satir.donem.yil}-${satir.donem.sira}`;
    let grup = gruplar.get(anahtar);
    if (!grup) {
      grup = { donem: satir.donem, resmi: [], deneme: [] };
      gruplar.set(anahtar, grup);
    }
    if (satir.scope === "OFFICIAL") grup.resmi.push(satir.yuzde);
    else grup.deneme.push(satir.yuzde);
  }

  const ortalama = (degerler: number[]) =>
    degerler.length === 0
      ? null
      : yuvarla(degerler.reduce((t, d) => t + d, 0) / degerler.length);

  return [...gruplar.values()]
    .sort((a, b) => b.donem.yil - a.donem.yil || b.donem.sira - a.donem.sira)
    .map((grup) => ({
      donem: grup.donem,
      resmiOrtalama: ortalama(grup.resmi),
      resmiSinavSayisi: grup.resmi.length,
      denemeOrtalama: ortalama(grup.deneme),
      denemeSinavSayisi: grup.deneme.length,
    }));
}

// ---------- Sınıf görünümü ----------

export type SinifOgrenciSinavSatiri = {
  ogrenciId: string;
  ad: string;
  resmiOrtalama: number | null;
  denemeOrtalama: number | null;
  girilmisSinav: number;
};

export type SinifSinavIstatistigi = {
  ogrenciler: SinifOgrenciSinavSatiri[];
  resmiOrtalama: number | null;
  denemeOrtalama: number | null;
};

/**
 * Sınıfın sınav tablosu. Öğrenciler resmî ortalamaya göre sıralanır, en düşük
 * üstte — öğretmenin kime bakması gerektiği listenin başında durur. Sınavı
 * olmayan öğrenci listeyi yanıltmasın diye sona alınır.
 */
export async function sinifSinavIstatistigi(
  sinifId: string,
  ogretmenId: string,
): Promise<SinifSinavIstatistigi> {
  const ogrenciler = await prisma.student.findMany({
    where: {
      classroomId: sinifId,
      isActive: true,
      classroom: { teacherId: ogretmenId },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      examResults: {
        where: { exam: { teacherId: ogretmenId }, isAbsent: false, score: { not: null } },
        select: { score: true, exam: { select: { maxScore: true, scope: true } } },
      },
    },
  });

  const ortalama = (degerler: number[]) =>
    degerler.length === 0
      ? null
      : yuvarla(degerler.reduce((t, d) => t + d, 0) / degerler.length);

  const yuzdeler = (
    sonuclar: { score: number | null; exam: { maxScore: number; scope: ExamScope } }[],
    scope: ExamScope,
  ) =>
    sonuclar
      .filter((s) => s.exam.scope === scope && s.score !== null && s.exam.maxScore > 0)
      .map((s) => ((s.score as number) / s.exam.maxScore) * 100);

  const satirlar = ogrenciler.map((o) => ({
    ogrenciId: o.id,
    ad: `${o.firstName} ${o.lastName}`,
    resmiOrtalama: ortalama(yuzdeler(o.examResults, "OFFICIAL")),
    denemeOrtalama: ortalama(yuzdeler(o.examResults, "PRACTICE")),
    girilmisSinav: o.examResults.length,
  }));

  return {
    ogrenciler: turkceSirala(satirlar, (s) => s.ad).sort((a, b) => {
      // Ortalaması olmayan (hiç sınavı yok) en sona.
      if (a.resmiOrtalama === null || b.resmiOrtalama === null) {
        if (a.resmiOrtalama === b.resmiOrtalama) return 0;
        return a.resmiOrtalama === null ? 1 : -1;
      }
      return a.resmiOrtalama - b.resmiOrtalama;
    }),
    resmiOrtalama: ortalama(
      satirlar.map((s) => s.resmiOrtalama).filter((d): d is number => d !== null),
    ),
    denemeOrtalama: ortalama(
      satirlar.map((s) => s.denemeOrtalama).filter((d): d is number => d !== null),
    ),
  };
}

export type { ComponentEntry, ExamScope };
