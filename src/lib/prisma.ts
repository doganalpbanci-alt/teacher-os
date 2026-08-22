import { PrismaClient } from "@prisma/client";

// Next.js gelistirme modunda dosya degistikce modulleri yeniden yukler.
// Her yeniden yuklemede yeni bir PrismaClient uretilirse veritabani baglanti
// havuzu kisa surede tukenir. Bu yuzden client globalThis uzerinde saklanir.
// Uretimde (Vercel) modul bir kez yuklendigi icin bu saklama gereksizdir.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
