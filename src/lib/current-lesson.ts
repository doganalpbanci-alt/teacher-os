import { prisma } from "@/lib/prisma";

// GEÇİCİ: ders yönetimi ekranı henüz yok.
//
// Kural: bir sınıfın EN SON açılmış dersi aktif derstir. Ders başlatmak yeni
// bir Lesson kaydı oluşturur; başka bir alan ya da durum tutulmaz, şemada
// değişiklik gerekmez.
//
// Gerçek ders ekranı geldiğinde SADECE bu dosya değişir: aktif dersin nasıl
// seçildiği burada tanımlıdır, sayfalar ve kart kuralları bunu bilmez.

const ZAMAN_DILIMI = "Europe/Istanbul";

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

export async function aktifDersiGetir(sinifId: string): Promise<AktifDers | null> {
  // Günlük sırayı bulmak için son dersler çekilir. Bir sınıfta aynı gün
  // onlarca ders olmayacağı için küçük bir pencere yeterli.
  const dersler = await prisma.lesson.findMany({
    where: { classroomId: sinifId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 50,
    select: { id: true, date: true },
  });

  const aktif = dersler[0];
  if (!aktif) return null;

  const anahtar = gunAnahtari(aktif.date);
  const ayniGun = dersler.filter(
    (ders) => gunAnahtari(ders.date) === anahtar && ders.date <= aktif.date,
  );

  return { id: aktif.id, tarih: aktif.date, gunlukSira: ayniGun.length };
}

export async function dersBaslat(sinifId: string): Promise<void> {
  await prisma.lesson.create({ data: { classroomId: sinifId, date: new Date() } });
}
