import { redirect } from "next/navigation";
import { kurulumTamamlandiMi, oturumdakiOgretmenId } from "@/lib/auth";
import { GirisFormu } from "@/components/GirisFormu";

export const dynamic = "force-dynamic";

export default async function GirisSayfasi() {
  // Henüz hesap yoksa giriş denemek anlamsız; kuruluma yönlendirilir.
  if (!(await kurulumTamamlandiMi())) redirect("/kurulum");
  if (await oturumdakiOgretmenId()) redirect("/");

  return (
    <main className="kart">
      <h1>Teacher OS</h1>
      <p className="soluk">Devam etmek için giriş yapın.</p>
      <GirisFormu />
    </main>
  );
}
