import { prisma } from "@/lib/prisma";
import { turkceSirala } from "@/lib/siralama";
import type { GecmisKaydi } from "@/lib/student-history";
import { kirmiziKartlariBirlestir } from "@/lib/student-history";

// Ders yönetimi tek yerde toplanır: aktif dersin ne olduğu, dersin nasıl
// başlayıp bittiği ve geçmiş derslerin nasıl okunduğu burada tanımlıdır.
// Sayfalar ve kart kuralları bu kuralı bilmez, yalnızca ders id'si kullanır.
//
// Kural: bir sınıfın bitmemiş dersi (endedAt = null) aktif derstir. Aynı anda
// birden fazla ders açılmaz; ders bitmeden yenisi başlatılamaz.

const ZAMAN_DILIMI = "Europe/Istanbul";

// Geçmiş ekranında gösterilen ders sayısı. Sayfa sınırsız büyümesin diye.
const GECMIS_SINIRI = 60;

export class DersHatasi extends Error {}

export type AktifDers = {
  id: string;
  tarih: Date;
  // Aynı gün içinde kaçıncı ders olduğu. Öğretmen aynı sınıfa günde birden
  // fazla ders işleyebildiği için gösterilir.
  gunlukSira: number;
};

// Tarihi öğretmenin saat dilimine göre "2026-08-23" biçimine indirger.
// Sunucu UTC çalışır; gün sınırı buna göre kaydırılmazsa akşam dersleri
// ertesi güne düşer.
function gunAnahtari(tarih: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZAMAN_DILIMI,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(tarih);
}

export function dersTarihiYazisi(tarih: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: ZAMAN_DILIMI,
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(tarih);
}

/**
 * Ders ekranındaki kısa yazı. Ders bugünse saat yeter; tarihi tekrar etmek
 * dar ekranda yer harcar. Dün açılıp bitirilmemiş bir ders varsa tarih
 * görünür, çünkü o zaman bilgi taşır.
 */
export function dersKisaYazisi(tarih: Date): string {
  const bugun = gunAnahtari(new Date());
  return gunAnahtari(tarih) === bugun
    ? saatYazisi(tarih)
    : dersTarihiYazisi(tarih);
}

export function saatYazisi(zaman: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: ZAMAN_DILIMI,
    hour: "2-digit",
    minute: "2-digit",
  }).format(zaman);
}

/**
 * Derslerin gün içindeki sırası. Liste yeniden eskiye gelir; aynı güne düşen
 * dersler eskiden yeniye numaralanır, yani günün ilk dersi 1'dir.
 */
function gunlukSiralar(dersler: { id: string; date: Date }[]): Map<string, number> {
  const sayaclar = new Map<string, number>();
  const siralar = new Map<string, number>();
  for (const ders of [...dersler].reverse()) {
    const anahtar = gunAnahtari(ders.date);
    const sira = (sayaclar.get(anahtar) ?? 0) + 1;
    sayaclar.set(anahtar, sira);
    siralar.set(ders.id, sira);
  }
  return siralar;
}

export async function aktifDersiGetir(
  sinifId: string,
  ogretmenId: string,
): Promise<AktifDers | null> {
  // Günlük sırayı bulmak için son dersler çekilir. Bir sınıfta aynı gün
  // onlarca ders olmayacağı için küçük bir pencere yeterli.
  //
  // Sahiplik sorgunun parçası: sınıf sorgusunun sonucunu beklemeden, onunla
  // aynı anda çalışabilsin diye. Başkasının sınıfı için boş döner.
  const dersler = await prisma.lesson.findMany({
    where: { classroomId: sinifId, classroom: { teacherId: ogretmenId } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 50,
    select: { id: true, date: true, endedAt: true },
  });

  const aktif = dersler.find((ders) => ders.endedAt === null);
  if (!aktif) return null;

  return {
    id: aktif.id,
    tarih: aktif.date,
    gunlukSira: gunlukSiralar(dersler).get(aktif.id) ?? 1,
  };
}

/**
 * Yeni ders açar. Sınıfta süren bir ders varsa açmaz: aynı anda tek ders
 * kuralı burada korunur, yanlışlıkla çift kayıt oluşmaz.
 */
export async function dersBaslat(sinifId: string): Promise<void> {
  const acik = await prisma.lesson.findFirst({
    where: { classroomId: sinifId, endedAt: null },
    select: { id: true },
  });
  if (acik) throw new DersHatasi("Bu sınıfta süren bir ders var. Önce onu bitirin.");

  await prisma.lesson.create({ data: { classroomId: sinifId, date: new Date() } });
}

/**
 * Dersi bitirir. Sahiplik sorgunun parçası: başka öğretmenin dersi
 * "bulunamadı" sayılır. Bitmiş dersi yeniden bitirmek sessizce geçilmez,
 * çünkü bitiş saati geçmişin parçasıdır ve değiştirilmez.
 */
export async function dersBitir(dersId: string, ogretmenId: string): Promise<void> {
  const ders = await prisma.lesson.findFirst({
    where: { id: dersId, classroom: { teacherId: ogretmenId } },
    select: { id: true, endedAt: true },
  });
  if (!ders) throw new DersHatasi("Ders bulunamadı.");
  if (ders.endedAt) throw new DersHatasi("Bu ders zaten bitmiş.");

  await prisma.lesson.update({
    where: { id: ders.id },
    data: { endedAt: new Date() },
  });
}

export type DersSayimlari = {
  arti: number;
  eksi: number;
  sariKart: number;
  kirmiziKart: number;
};

export type DersOzeti = {
  id: string;
  tarih: Date;
  bitis: Date | null;
  gunlukSira: number;
  suruyor: boolean;
  sayimlar: DersSayimlari;
};

/**
 * Bir sınıfın dersleri, en yeniden eskiye. Ders geçmişi ekranında listelenir.
 * Sahiplik sorgunun parçası; başkasının sınıfı boş liste döner.
 */
export async function dersGecmisi(
  sinifId: string,
  ogretmenId: string,
): Promise<DersOzeti[]> {
  const dersler = await prisma.lesson.findMany({
    where: { classroomId: sinifId, classroom: { teacherId: ogretmenId } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: GECMIS_SINIRI,
    select: { id: true, date: true, endedAt: true },
  });
  if (dersler.length === 0) return [];

  const gruplar = await prisma.behaviorLog.groupBy({
    by: ["lessonId", "type"],
    where: { lessonId: { in: dersler.map((d) => d.id) } },
    _count: { _all: true },
  });

  const sayimlar = new Map<string, DersSayimlari>();
  for (const grup of gruplar) {
    const mevcut = sayimlar.get(grup.lessonId) ?? {
      arti: 0,
      eksi: 0,
      sariKart: 0,
      kirmiziKart: 0,
    };
    if (grup.type === "PLUS") mevcut.arti += grup._count._all;
    else if (grup.type === "MINUS") mevcut.eksi += grup._count._all;
    else if (grup.type === "YELLOW_CARD") mevcut.sariKart += grup._count._all;
    else if (grup.type === "RED_CARD") mevcut.kirmiziKart += grup._count._all;
    sayimlar.set(grup.lessonId, mevcut);
  }

  const siralar = gunlukSiralar(dersler);
  return dersler.map((ders) => {
    const sayim = sayimlar.get(ders.id) ?? {
      arti: 0,
      eksi: 0,
      sariKart: 0,
      kirmiziKart: 0,
    };
    return {
      id: ders.id,
      tarih: ders.date,
      bitis: ders.endedAt,
      gunlukSira: siralar.get(ders.id) ?? 1,
      suruyor: ders.endedAt === null,
      sayimlar: {
        ...sayim,
        // Her kırmızı kart yanında bir MINUS yazar; o eksi ayrıca sayılmaz.
        eksi: Math.max(sayim.eksi - sayim.kirmiziKart, 0),
      },
    };
  });
}

export type DersOgrencisi = {
  ogrenciId: string;
  ad: string;
  kayitlar: GecmisKaydi[];
};

export type DersDetayi = {
  ders: DersOzeti;
  ogrenciler: DersOgrencisi[];
};

/**
 * Bir dersin kayıtları, öğrenciye göre gruplanmış. Sahiplik sorgunun
 * parçası: başka öğretmenin dersi null döner, sayfa 404 verir.
 */
export async function dersDetayi(
  dersId: string,
  sinifId: string,
  ogretmenId: string,
): Promise<DersDetayi | null> {
  // Günlük sıra ve sayımlar geçmiş listesiyle aynı kuraldan gelsin diye
  // özet oradan okunur; iki ekran aynı dersi farklı anlatmaz. Sahiplik her
  // iki sorgunun da parçası olduğu için ikisi aynı anda çalışabilir.
  const [gecmis, kayitlar] = await Promise.all([
    dersGecmisi(sinifId, ogretmenId),
    prisma.behaviorLog.findMany({
      where: { lessonId: dersId, classroom: { teacherId: ogretmenId } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        points: true,
        createdAt: true,
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
  ]);

  const ozet = gecmis.find((d) => d.id === dersId);
  if (!ozet) return null;

  const ogrenciler = new Map<string, DersOgrencisi>();
  for (const kayit of kayitlar) {
    let grup = ogrenciler.get(kayit.student.id);
    if (!grup) {
      grup = {
        ogrenciId: kayit.student.id,
        ad: `${kayit.student.firstName} ${kayit.student.lastName}`,
        kayitlar: [],
      };
      ogrenciler.set(kayit.student.id, grup);
    }
    grup.kayitlar.push({
      id: kayit.id,
      tur: kayit.type,
      puan: kayit.points,
      zaman: kayit.createdAt,
    });
  }

  return {
    ders: ozet,
    ogrenciler: turkceSirala(
      [...ogrenciler.values()].map((grup) => ({
        ...grup,
        kayitlar: kirmiziKartlariBirlestir(grup.kayitlar),
      })),
      (grup) => grup.ad,
    ),
  };
}
