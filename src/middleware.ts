import { NextResponse, type NextRequest } from "next/server";
import { CEREZ_ADI, jetonuCoz } from "@/lib/session";

// Oturum gerektirmeyen adresler. Kurulum sayfası ayrıca kendi içinde
// kurulumun tamamlanıp tamamlanmadığını kontrol eder.
const ACIK_YOLLAR = ["/giris", "/kurulum"];

export async function middleware(istek: NextRequest) {
  const yol = istek.nextUrl.pathname;
  if (ACIK_YOLLAR.some((acik) => yol === acik || yol.startsWith(`${acik}/`))) {
    return NextResponse.next();
  }

  // Middleware Edge'de çalışır, veritabanına erişemez; yalnızca çerezin
  // imzası doğrulanır. Kaydın gerçekten var olduğunu sayfalar kontrol eder.
  const ogretmenId = await jetonuCoz(istek.cookies.get(CEREZ_ADI)?.value);
  if (ogretmenId) return NextResponse.next();

  const girisAdresi = new URL("/giris", istek.url);
  return NextResponse.redirect(girisAdresi);
}

export const config = {
  // Statik dosyalar ve Next.js'in kendi istekleri dışındaki her şey.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
