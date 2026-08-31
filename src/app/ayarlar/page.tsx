import { getCurrentTeacher } from "@/lib/current-teacher";
import { SablonFormu } from "@/components/SablonFormu";
import { UstMenu } from "@/components/UstMenu";
import { TahtaPinFormu, TahtaSuresiFormu } from "@/components/TahtaAyarlari";

export const dynamic = "force-dynamic";

export default async function AyarlarSayfasi() {
  const ogretmen = await getCurrentTeacher();

  return (
    <>
      <UstMenu aktif="ayarlar" />

      <main className="kart">
        <h1>Ayarlar</h1>
        <h2>Davranış sistemi</h2>
        <p className="soluk">
          Ders içinde hangi düğmeleri kullanacağınızı ve performans notunun
          nasıl belirleneceğini seçer. Bütün sınıflarınızda geçerli olur.
          Geçmiş kayıtlar sistem değiştirdiğinizde silinmez.
        </p>
        <SablonFormu secili={ogretmen.behaviorTemplate} />

        <h2>Akıllı tahta kilidi</h2>
        <p className="soluk">
          Tahta sınıfın önünde açıkken kart ve yıldızı yalnızca sizin
          verebilmeniz için. Kilitlediğiniz cihazda düğmeler görünür ama
          basıldığında PIN sorar. Kilit cihaza aittir: tahtayı kilitlemek
          telefonunuzu etkilemez.
        </p>
        <p className="soluk">
          PIN hesap parolanızdan ayrıdır ve bilerek öyle: tahtaya yazdığınız
          şeyi bütün sınıf görür, orada hesap parolanız yazılmamalıdır. PIN ele
          geçerse yalnızca onu değiştirirsiniz, hesabınız etkilenmez.
        </p>
        <TahtaPinFormu pinVar={ogretmen.boardPin !== null} />
        <TahtaSuresiFormu dakika={ogretmen.boardUnlockMinutes} />
      </main>
    </>
  );
}
