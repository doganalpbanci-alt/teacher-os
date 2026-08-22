import { prisma } from "@/lib/prisma";
import type { Teacher } from "@prisma/client";

// GEÇİCİ: giriş sistemi henüz yok. Uygulama tek öğretmenle çalışıyor.
//
// Giriş sistemi eklendiğinde SADECE bu dosya değişir: fonksiyon oturumdaki
// öğretmeni döndürür, sayfalar ve server action'lar aynı kalır. Geçici çözüm
// bilerek tek noktada toplanmıştır.
const TEK_OGRETMEN_EPOSTA = "ogretmen@teacher-os.local";
const TEK_OGRETMEN_AD = "Öğretmen";

// Parola alanı şemada zorunlu. Giriş sistemi gelene kadar buraya geçerli bir
// hash yazılmaz; bu değer hiçbir parolayla eşleşmez, yani bu kayıtla giriş
// yapılamaz.
const GIRIS_KAPALI = "!giris-sistemi-yok";

export async function getCurrentTeacher(): Promise<Teacher> {
  const mevcut = await prisma.teacher.findUnique({
    where: { email: TEK_OGRETMEN_EPOSTA },
  });
  if (mevcut) return mevcut;

  // İlk açılışta oluşturulur. Aynı anda gelen iki istek yarışırsa email
  // benzersizliği ikincisini reddeder; upsert bu durumu sessizce çözer.
  return prisma.teacher.upsert({
    where: { email: TEK_OGRETMEN_EPOSTA },
    update: {},
    create: {
      email: TEK_OGRETMEN_EPOSTA,
      name: TEK_OGRETMEN_AD,
      passwordHash: GIRIS_KAPALI,
    },
  });
}
