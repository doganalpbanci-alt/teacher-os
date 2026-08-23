import { redirect } from "next/navigation";
import type { Teacher } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { kurulmusMu, oturumdakiOgretmenId } from "@/lib/auth";

/**
 * Oturumdaki öğretmen. Oturum yoksa, çerez geçersizse ya da kayıt silinmişse
 * giriş sayfasına yönlendirir; yani çağıran taraf her zaman gerçek bir
 * öğretmen elde eder.
 *
 * Faz 3'ten önce burada geçici tek öğretmen çözümü vardı. Söz verildiği gibi
 * yalnızca bu dosya değişti; sayfalar ve server action'lar aynı fonksiyonu
 * çağırmaya devam ediyor.
 */
export async function getCurrentTeacher(): Promise<Teacher> {
  const id = await oturumdakiOgretmenId();
  if (!id) redirect("/giris");

  const ogretmen = await prisma.teacher.findUnique({ where: { id } });
  // Kurulumu tamamlanmamış bir kayda ait jeton geçerli sayılmaz.
  if (!ogretmen || !kurulmusMu(ogretmen.passwordHash)) redirect("/giris");

  return ogretmen;
}
