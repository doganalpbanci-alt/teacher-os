import type { SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { turkceSirala } from "@/lib/siralama";

// Ödev yönetimi tek yerde toplanır: ödevin kime verildiği, nasıl okunduğu,
// düzenlendiği ve istatistiğinin nasıl hesaplandığı burada tanımlıdır.
// Sayfalar ve action'lar bu kuralı bilmez, yalnızca id kullanır.
//
// Temel kural: ödev bir sınıfa değil öğretmene aittir. Kime verildiği
// Submission satırlarında yazılıdır; sınıf üyeliği oradan türetilir. Böylece
// aynı ödev birden fazla sınıfa ve tek tek seçilen öğrencilere verilebilir,
// "asıl sınıf hangisi" sorusu hiç doğmaz.
//
// Süre kuralı: son teslim tarihi geçtiğinde durum KENDİLİĞİNDEN değişmez.
// Ekran "süresi geçti" diye işaretler, kararı öğretmen verir.

const ZAMAN_DILIMI = "Europe/Istanbul";

// Listelerde gösterilen en fazla kayıt. Sayfa sınırsız büyümesin diye.
const LISTE_SINIRI = 100;

export class OdevHatasi extends Error {}

/**
 * Tarihi öğretmenin saat dilimine göre "2026-08-25" biçimine indirger.
 * Sunucu UTC çalışır; gün sınırı buna göre kaydırılmazsa akşam saatlerinde
 * "bugün" ertesi güne kayar. `lesson.ts` ile aynı kural.
 */
function gunAnahtari(tarih: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZAMAN_DILIMI,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(tarih);
}

export function odevTarihiYazisi(tarih: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: ZAMAN_DILIMI,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(tarih);
}

/** `<input type="date">` alanına konacak biçim. */
export function tarihGirdisi(tarih: Date | null): string {
  return tarih ? gunAnahtari(tarih) : "";
}

/**
 * Bugünün başlangıcı, tarih alanlarıyla aynı ölçekte. `<input type="date">`
 * "2026-09-01" gönderir, bu da UTC gece yarısı olarak saklanır; bugünün
 * anahtarını aynı biçimde okuyunca ikisi doğrudan karşılaştırılabilir.
 */
function bugunSiniri(): Date {
  return new Date(`${gunAnahtari(new Date())}T00:00:00.000Z`);
}

/** Son teslim günü geçti mi. Bugün son gün ise henüz geçmemiş sayılır. */
export function suresiGectiMi(dueDate: Date | null): boolean {
  return dueDate !== null && dueDate.getTime() < bugunSiniri().getTime();
}

// ---------- Sayımlar ----------

export type OdevSayimlari = {
  toplam: number;
  pending: number;
  done: number;
  missing: number;
  late: number;
  /** Tamamlanma oranı, yüzde. Yapıldı ve Geç tamamlanmış sayılır. */
  oran: number;
};

export function sayimlariHesapla(durumlar: SubmissionStatus[]): OdevSayimlari {
  const sayim: OdevSayimlari = {
    toplam: durumlar.length,
    pending: 0,
    done: 0,
    missing: 0,
    late: 0,
    oran: 0,
  };
  for (const durum of durumlar) {
    if (durum === "PENDING") sayim.pending += 1;
    else if (durum === "DONE") sayim.done += 1;
    else if (durum === "MISSING") sayim.missing += 1;
    else if (durum === "LATE") sayim.late += 1;
  }
  // Geç teslim de sonunda yapılmıştır; tamamlanma oranına girer.
  sayim.oran =
    sayim.toplam === 0
      ? 0
      : Math.round(((sayim.done + sayim.late) / sayim.toplam) * 100);
  return sayim;
}

export type OdevOzeti = {
  id: string;
  title: string;
  description: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  isActive: boolean;
  gecikti: boolean;
  sayimlar: OdevSayimlari;
};

type OdevAlanlari = {
  title: string;
  description: string | null;
  startDate: Date | null;
  dueDate: Date | null;
};

function ozetKur(
  odev: {
    id: string;
    title: string;
    description: string | null;
    startDate: Date | null;
    dueDate: Date | null;
    isActive: boolean;
  },
  durumlar: SubmissionStatus[],
): OdevOzeti {
  const sayimlar = sayimlariHesapla(durumlar);
  return {
    id: odev.id,
    title: odev.title,
    description: odev.description,
    startDate: odev.startDate,
    dueDate: odev.dueDate,
    isActive: odev.isActive,
    // Süresi geçmiş ama hâlâ bekleyen öğrenci varsa gecikmiştir. Herkes
    // işaretlenmişse tarih geçse de gündemde değildir.
    gecikti: suresiGectiMi(odev.dueDate) && sayimlar.pending > 0,
    sayimlar,
  };
}

// ---------- Hedef seçimi ----------

export type HedefOgrenci = { id: string; ad: string };
export type HedefSinif = { id: string; ad: string; ogrenciler: HedefOgrenci[] };

/**
 * Ödev verilebilecek sınıf ve öğrenciler. Sahiplik sorgunun parçası:
 * yalnızca öğretmenin kendi sınıfları döner.
 */
export async function hedefSecenekleri(ogretmenId: string): Promise<HedefSinif[]> {
  const siniflar = await prisma.classroom.findMany({
    where: { teacherId: ogretmenId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      students: {
        where: { isActive: true },
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  return siniflar.map((sinif) => ({
    id: sinif.id,
    ad: sinif.name,
    ogrenciler: turkceSirala(
      sinif.students.map((o) => ({ id: o.id, ad: `${o.firstName} ${o.lastName}` })),
      (o) => o.ad,
    ),
  }));
}

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
 * Yeni ödev açar ve seçilen öğrencilere PENDING teslim kaydı oluşturur.
 * Sonradan sınıfa katılan öğrenci geçmiş ödevlere eklenmez; ödev kime
 * verildiyse onun kaydıdır.
 */
export async function odevOlustur(
  ogretmenId: string,
  alanlar: OdevAlanlari,
  ogrenciIdleri: string[],
): Promise<string> {
  const gecerli = await gecerliOgrenciIdleri(ogrenciIdleri, ogretmenId);
  if (gecerli.length === 0) {
    throw new OdevHatasi("En az bir öğrenci seçmelisiniz.");
  }

  const odev = await prisma.assignment.create({
    data: {
      teacherId: ogretmenId,
      ...alanlar,
      submissions: { create: gecerli.map((id) => ({ studentId: id })) },
    },
    select: { id: true },
  });
  return odev.id;
}

/**
 * Ödevin alanlarını ve atanan öğrenci listesini günceller. Listeden çıkarılan
 * öğrencinin teslim kaydı silinir — işaretli olsa bile. Bu bilinçli bir
 * tercih; ekran kaç işaretli kaydın gideceğini önceden yazar.
 */
export async function odevGuncelle(
  odevId: string,
  ogretmenId: string,
  alanlar: OdevAlanlari,
  ogrenciIdleri: string[],
): Promise<void> {
  const odev = await prisma.assignment.findFirst({
    where: { id: odevId, teacherId: ogretmenId },
    select: { id: true, submissions: { select: { id: true, studentId: true } } },
  });
  if (!odev) throw new OdevHatasi("Ödev bulunamadı.");

  const gecerli = await gecerliOgrenciIdleri(ogrenciIdleri, ogretmenId);
  if (gecerli.length === 0) {
    throw new OdevHatasi("En az bir öğrenci seçmelisiniz.");
  }

  const istenen = new Set(gecerli);
  const mevcut = new Set(odev.submissions.map((s) => s.studentId));
  const eklenecek = gecerli.filter((id) => !mevcut.has(id));
  const silinecek = odev.submissions
    .filter((s) => !istenen.has(s.studentId))
    .map((s) => s.id);

  // Tek işlem: alanlar, çıkarmalar ve eklemeler ya hep birlikte olur ya hiç.
  await prisma.$transaction([
    prisma.assignment.update({ where: { id: odev.id }, data: alanlar }),
    prisma.submission.deleteMany({ where: { id: { in: silinecek } } }),
    prisma.submission.createMany({
      data: eklenecek.map((studentId) => ({ assignmentId: odev.id, studentId })),
    }),
  ]);
}

/** Ödevi arşivler ya da arşivden çıkarır. Kayıtlara dokunmaz. */
export async function odevArsivle(
  odevId: string,
  ogretmenId: string,
  arsiv: boolean,
): Promise<void> {
  const odev = await prisma.assignment.findFirst({
    where: { id: odevId, teacherId: ogretmenId },
    select: { id: true },
  });
  if (!odev) throw new OdevHatasi("Ödev bulunamadı.");

  await prisma.assignment.update({
    where: { id: odev.id },
    data: { isActive: !arsiv },
  });
}

/**
 * Ödevi kalıcı siler. Yalnızca hiçbir öğrenci işaretlenmemişse mümkündür:
 * yanlışlıkla açılan ödev iz bırakmadan kalkar, ama işaretlenmiş bir kayıt
 * öğretmenin verdiği bir karardır ve silinerek yok edilmez. Onun yolu arşiv.
 */
export async function odevSil(odevId: string, ogretmenId: string): Promise<void> {
  const odev = await prisma.assignment.findFirst({
    where: { id: odevId, teacherId: ogretmenId },
    select: {
      id: true,
      submissions: { where: { status: { not: "PENDING" } }, select: { id: true } },
    },
  });
  if (!odev) throw new OdevHatasi("Ödev bulunamadı.");
  if (odev.submissions.length > 0) {
    throw new OdevHatasi(
      `Bu ödevde ${odev.submissions.length} öğrenci işaretlenmiş. Silmek yerine arşivleyin.`,
    );
  }

  // Sıra önemli: Submission -> Assignment bağlantısı RESTRICT, önce çocuk
  // kayıtlar gider. Veritabanı korumasını gevşetmek yerine kasıtlı sırayla
  // siliyoruz; yanlışlıkla silme yine engellenmiş kalır.
  await prisma.$transaction([
    prisma.submission.deleteMany({ where: { assignmentId: odev.id } }),
    prisma.assignment.delete({ where: { id: odev.id } }),
  ]);
}

/** Tek bir öğrencinin teslim durumunu günceller. */
export async function teslimGuncelle(
  submissionId: string,
  ogretmenId: string,
  status: SubmissionStatus,
): Promise<void> {
  // Sahiplik sorgunun parçası: teslim -> ödev -> öğretmen.
  const teslim = await prisma.submission.findFirst({
    where: { id: submissionId, assignment: { teacherId: ogretmenId } },
    select: { id: true },
  });
  if (!teslim) throw new OdevHatasi("Teslim kaydı bulunamadı.");

  await prisma.submission.update({ where: { id: teslim.id }, data: { status } });
}

/**
 * Bir ödevdeki öğrencilerin tamamını aynı duruma çeker. Ders başında sınıfı
 * hızlı kontrol etmek için: hepsini "Yapıldı" işaretle, sonra istisnaları
 * tek tek değiştir. `sinifId` verilirse yalnızca o sınıfın öğrencileri.
 */
export async function topluTeslimGuncelle(
  odevId: string,
  ogretmenId: string,
  status: SubmissionStatus,
  sinifId: string | null,
): Promise<number> {
  const odev = await prisma.assignment.findFirst({
    where: { id: odevId, teacherId: ogretmenId },
    select: { id: true },
  });
  if (!odev) throw new OdevHatasi("Ödev bulunamadı.");

  const sonuc = await prisma.submission.updateMany({
    where: {
      assignmentId: odev.id,
      ...(sinifId ? { student: { classroomId: sinifId } } : {}),
    },
    data: { status },
  });
  return sonuc.count;
}

// ---------- Okuma ----------

export type OdevFiltresi = "aktif" | "gecikmis" | "arsiv";

/**
 * Öğretmenin ödevleri, en yeniden eskiye. Ödevler sekmesinde listelenir.
 * "Gecikmiş" filtresi süresi geçmiş ve hâlâ bekleyen öğrencisi olanları verir.
 */
export async function ogretmenOdevleri(
  ogretmenId: string,
  filtre: OdevFiltresi,
): Promise<OdevOzeti[]> {
  const kosul =
    filtre === "arsiv"
      ? { isActive: false }
      : filtre === "gecikmis"
        ? {
            isActive: true,
            dueDate: { lt: bugunSiniri() },
            submissions: { some: { status: "PENDING" as const } },
          }
        : { isActive: true };

  const odevler = await prisma.assignment.findMany({
    where: { teacherId: ogretmenId, ...kosul },
    orderBy: { createdAt: "desc" },
    take: LISTE_SINIRI,
    select: {
      id: true,
      title: true,
      description: true,
      startDate: true,
      dueDate: true,
      isActive: true,
      submissions: { select: { status: true } },
    },
  });

  return odevler.map((odev) => ozetKur(odev, odev.submissions.map((s) => s.status)));
}

/**
 * Bir sınıfa verilmiş ödevler. Sayımlar YALNIZCA o sınıfın öğrencilerinden
 * hesaplanır; aynı ödev başka sınıfa da verilmişse oradaki durumlar bu
 * listeye karışmaz.
 */
export async function sinifOdevleri(
  sinifId: string,
  ogretmenId: string,
): Promise<OdevOzeti[]> {
  const odevler = await prisma.assignment.findMany({
    where: {
      teacherId: ogretmenId,
      isActive: true,
      submissions: { some: { student: { classroomId: sinifId } } },
    },
    orderBy: { createdAt: "desc" },
    take: LISTE_SINIRI,
    select: {
      id: true,
      title: true,
      description: true,
      startDate: true,
      dueDate: true,
      isActive: true,
      submissions: {
        where: { student: { classroomId: sinifId } },
        select: { status: true },
      },
    },
  });

  return odevler.map((odev) => ozetKur(odev, odev.submissions.map((s) => s.status)));
}

export type TeslimSatiri = {
  submissionId: string;
  ogrenciId: string;
  ad: string;
  status: SubmissionStatus;
};

export type SinifGrubu = {
  sinifId: string | null;
  sinifAdi: string;
  teslimler: TeslimSatiri[];
  sayimlar: OdevSayimlari;
};

export type OdevDetayi = {
  odev: OdevOzeti;
  gruplar: SinifGrubu[];
};

/**
 * Bir ödevin öğrenci bazlı teslim listesi, sınıfa göre gruplanmış. Ödev
 * birden fazla sınıfa verilmiş olabilir; her sınıf kendi başlığı altında
 * kendi sayımıyla görünür.
 */
export async function odevDetayi(
  odevId: string,
  ogretmenId: string,
): Promise<OdevDetayi | null> {
  const odev = await prisma.assignment.findFirst({
    where: { id: odevId, teacherId: ogretmenId },
    select: {
      id: true,
      title: true,
      description: true,
      startDate: true,
      dueDate: true,
      isActive: true,
      submissions: {
        select: {
          id: true,
          status: true,
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              classroom: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });
  if (!odev) return null;

  const gruplar = new Map<string, SinifGrubu>();
  for (const teslim of odev.submissions) {
    // Sınıftan çıkarılmış öğrencinin sınıfı null olur (Student.classroomId
    // SetNull). Kaydı düşürmek yerine ayrı bir başlıkta gösterilir.
    const anahtar = teslim.student.classroom?.id ?? "";
    let grup = gruplar.get(anahtar);
    if (!grup) {
      grup = {
        sinifId: teslim.student.classroom?.id ?? null,
        sinifAdi: teslim.student.classroom?.name ?? "Sınıfa atanmamış",
        teslimler: [],
        sayimlar: sayimlariHesapla([]),
      };
      gruplar.set(anahtar, grup);
    }
    grup.teslimler.push({
      submissionId: teslim.id,
      ogrenciId: teslim.student.id,
      ad: `${teslim.student.firstName} ${teslim.student.lastName}`,
      status: teslim.status,
    });
  }

  const sirali = turkceSirala([...gruplar.values()], (g) => g.sinifAdi).map((grup) => ({
    ...grup,
    teslimler: turkceSirala(grup.teslimler, (t) => t.ad),
    sayimlar: sayimlariHesapla(grup.teslimler.map((t) => t.status)),
  }));

  return {
    odev: ozetKur(odev, odev.submissions.map((s) => s.status)),
    gruplar: sirali,
  };
}

/** Düzenleme ekranı için: ödevin alanları ve atanmış öğrenci id'leri. */
export type OdevDuzenleme = {
  id: string;
  title: string;
  description: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  isActive: boolean;
  ogrenciIdleri: string[];
  /** Listeden çıkarılırsa kaybolacak işaretli kayıt sayısı, öğrenci bazında. */
  isaretliOgrenciIdleri: string[];
};

export async function odevDuzenlemesi(
  odevId: string,
  ogretmenId: string,
): Promise<OdevDuzenleme | null> {
  const odev = await prisma.assignment.findFirst({
    where: { id: odevId, teacherId: ogretmenId },
    select: {
      id: true,
      title: true,
      description: true,
      startDate: true,
      dueDate: true,
      isActive: true,
      submissions: { select: { studentId: true, status: true } },
    },
  });
  if (!odev) return null;

  return {
    id: odev.id,
    title: odev.title,
    description: odev.description,
    startDate: odev.startDate,
    dueDate: odev.dueDate,
    isActive: odev.isActive,
    ogrenciIdleri: odev.submissions.map((s) => s.studentId),
    isaretliOgrenciIdleri: odev.submissions
      .filter((s) => s.status !== "PENDING")
      .map((s) => s.studentId),
  };
}

export type OgrenciOdevSatiri = {
  odevId: string;
  baslik: string;
  startDate: Date | null;
  dueDate: Date | null;
  status: SubmissionStatus;
  gecikti: boolean;
};

/** Bir öğrencinin ödev geçmişi, en yeniden eskiye. Arşivlenenler de görünür. */
export async function ogrenciOdevleri(
  ogrenciId: string,
  ogretmenId: string,
): Promise<OgrenciOdevSatiri[]> {
  const teslimler = await prisma.submission.findMany({
    where: { studentId: ogrenciId, assignment: { teacherId: ogretmenId } },
    orderBy: { assignment: { createdAt: "desc" } },
    take: LISTE_SINIRI,
    select: {
      status: true,
      assignment: {
        select: { id: true, title: true, startDate: true, dueDate: true },
      },
    },
  });

  return teslimler.map((t) => ({
    odevId: t.assignment.id,
    baslik: t.assignment.title,
    startDate: t.assignment.startDate,
    dueDate: t.assignment.dueDate,
    status: t.status,
    gecikti: t.status === "PENDING" && suresiGectiMi(t.assignment.dueDate),
  }));
}

/** Bir öğrencinin ödev toplamı. Öğrenci sayfasındaki ölçüm satırında görünür. */
export async function ogrenciOdevIstatistigi(
  ogrenciId: string,
  ogretmenId: string,
): Promise<OdevSayimlari> {
  const teslimler = await prisma.submission.findMany({
    where: { studentId: ogrenciId, assignment: { teacherId: ogretmenId } },
    select: { status: true },
  });
  return sayimlariHesapla(teslimler.map((t) => t.status));
}

export type SinifOgrenciIstatistigi = {
  ogrenciId: string;
  ad: string;
  sayimlar: OdevSayimlari;
};

export type SinifOdevIstatistigi = {
  toplam: OdevSayimlari;
  ogrenciler: SinifOgrenciIstatistigi[];
};

/**
 * Sınıfın ödev tablosu: sınıf geneli ve öğrenci bazlı döküm. Öğrenciler
 * tamamlanma oranına göre sıralanır, en düşük üstte — öğretmenin kime
 * bakması gerektiği listenin başında durur.
 */
export async function sinifOdevIstatistigi(
  sinifId: string,
  ogretmenId: string,
): Promise<SinifOdevIstatistigi> {
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
      submissions: {
        where: { assignment: { teacherId: ogretmenId } },
        select: { status: true },
      },
    },
  });

  const satirlar = ogrenciler.map((o) => ({
    ogrenciId: o.id,
    ad: `${o.firstName} ${o.lastName}`,
    sayimlar: sayimlariHesapla(o.submissions.map((s) => s.status)),
  }));

  return {
    toplam: sayimlariHesapla(
      ogrenciler.flatMap((o) => o.submissions.map((s) => s.status)),
    ),
    // Ödevi olmayan öğrenci (%0 ama 0 ödev) listeyi yanıltmasın diye
    // ödevi olanlar önce gelir, sonra oran, sonra ad.
    ogrenciler: turkceSirala(satirlar, (s) => s.ad).sort((a, b) => {
      if (a.sayimlar.toplam === 0 || b.sayimlar.toplam === 0) {
        return a.sayimlar.toplam === b.sayimlar.toplam
          ? 0
          : a.sayimlar.toplam === 0
            ? 1
            : -1;
      }
      return a.sayimlar.oran - b.sayimlar.oran;
    }),
  };
}
