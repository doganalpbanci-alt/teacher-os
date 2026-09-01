import { NextResponse, type NextRequest } from "next/server";
import { CEREZ_ADI, jetonuCoz } from "@/lib/session";
import { KILIT_CEREZI, kilitJetonunuCoz, kilitKapaliMi } from "@/lib/lock-token";

// Oturum gerektirmeyen adresler. Kurulum sayfası ayrıca kendi içinde
// kurulumun tamamlanıp tamamlanmadığını kontrol eder.
const ACIK_YOLLAR = ["/giris", "/kurulum"];

/** Kilitli cihazın görebildiği tek adres. */
function kilitliYol(sinifId: string): string {
  return `/sinif/${sinifId}`;
}

export async function middleware(istek: NextRequest) {
  const yol = istek.nextUrl.pathname;

  // API rotaları burada denetlenmez: sayfa yönlendirmesi (giriş/kilit) bir
  // `fetch` isteğine HTML döndürür, çağıran taraf onu JSON sanıp patlar. Her
  // API rotası kendi oturum ve sahiplik kontrolünü kendi yapar — bkz.
  // src/app/api/ders/[dersId]/olaylar/route.ts. Yeni bir API rotası eklenirse
  // bu kontrolü kendisi yapmak zorundadır, buradan bedava gelmez.
  if (yol.startsWith("/api/")) return NextResponse.next();

  const acikYol = ACIK_YOLLAR.some((acik) => yol === acik || yol.startsWith(`${acik}/`));

  // Middleware Edge'de çalışır, veritabanına erişemez; yalnızca çerezlerin
  // imzası doğrulanır. Kayıtların gerçekten var olduğunu sayfalar kontrol eder.
  const ogretmenId = await jetonuCoz(istek.cookies.get(CEREZ_ADI)?.value);

  if (!ogretmenId) {
    // Oturum yokken kilit bakılmaz: bakılsaydı giriş sayfası da kilitli
    // sayılır, kilit onu sınıfa, oturum kontrolü sınıfı girişe yollar ve
    // tarayıcı iki adres arasında sonsuza kadar dönerdi.
    if (acikYol) return NextResponse.next();
    return NextResponse.redirect(new URL("/giris", istek.url));
  }

  // Kilitli cihaz yalnızca kilitlendiği sınıfın ekranını görür. Yalnızca
  // düğmeleri pasifleştirmek yetmezdi: öğrenci ayarlara, başka bir sınıfa ya
  // da çıkışa gidebilirdi.
  const kilit = await kilitJetonunuCoz(istek.cookies.get(KILIT_CEREZI)?.value);
  if (kilitKapaliMi(kilit) && kilit) {
    const hedef = kilitliYol(kilit.sinifId);
    if (yol !== hedef) return NextResponse.redirect(new URL(hedef, istek.url));
  }

  return NextResponse.next();
}

export const config = {
  // Statik dosyalar ve Next.js'in kendi istekleri dışındaki her şey.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
