// Veli mesajının veritabanına dokunmayan kısmı: telefon numarasını WhatsApp'ın
// beklediği biçime çevirme, bağlantı kurma, uzunluk kuralı ve şablon
// metinleri. Kayıt katmanı (`parent-message.ts`) bunu kullanır; bileşenler de
// (bağlantıyı kurmak, önizlemek için) doğrudan buradan okur — behavior-rules
// ve exam-rules ile aynı ayrım.

export const EN_UZUN_MESAJ = 1000;

export function mesajGecerliMi(mesaj: string): boolean {
  const kirpilmis = mesaj.trim();
  return kirpilmis.length > 0 && mesaj.length <= EN_UZUN_MESAJ;
}

/**
 * Serbest yazılmış bir telefon numarasını WhatsApp'ın istediğe ülke koduyla
 * başlayan, yalnızca rakamlardan oluşan biçime çevirir. Çözemezse null
 * döner — o zaman WhatsApp bağlantısı kurulmaz, yalnızca kopyalama kalır.
 *
 * Yalnızca Türkiye numaralarını bilir: "0555 123 45 67", "555 123 45 67",
 * "+90 555 123 45 67" gibi yaygın yazımların hepsi aynı sonuca gider.
 */
export function telefonuUluslararasiyaCevir(ham: string): string | null {
  const rakamlar = ham.replace(/[^\d]/g, "");

  if (rakamlar.startsWith("90") && rakamlar.length === 12) return rakamlar;
  if (rakamlar.startsWith("0") && rakamlar.length === 11) return `90${rakamlar.slice(1)}`;
  if (rakamlar.length === 10) return `90${rakamlar}`;
  return null;
}

/** `wa.me` bağlantısı. Telefon çözülemezse (ya da yoksa) null döner. */
export function whatsappBaglantisi(
  parentPhone: string | null,
  mesaj: string,
): string | null {
  if (!parentPhone) return null;
  const uluslararasi = telefonuUluslararasiyaCevir(parentPhone);
  if (!uluslararasi) return null;
  return `https://wa.me/${uluslararasi}?text=${encodeURIComponent(mesaj)}`;
}

export type SablonGirdisi = {
  ogrenciAdi: string;
  veliAdi: string | null;
  kartSistemi: boolean;
  ozet: { arti: number; eksi: number; sariKart: number; kirmiziKart: number };
  odevOzeti: { toplam: number; oran: number; done: number; late: number };
  sonSinav: { baslik: string; puan: number; maxScore: number; yuzde: number } | null;
};

export type MesajSablonu = { anahtar: string; ad: string; metin: string };

function selamlama(veliAdi: string | null): string {
  return veliAdi ? `Merhaba ${veliAdi},` : "Merhaba,";
}

/**
 * Hazır şablonlar, öğrencinin gerçek verisiyle doldurulmuş. Veri yoksa
 * (henüz ödev/sınav yoksa) o şablon hiç önerilmez — boş bir istatistik
 * yanıltıcı olurdu.
 */
export function mesajSablonlari(girdi: SablonGirdisi): MesajSablonu[] {
  const sablonlar: MesajSablonu[] = [
    {
      anahtar: "davranis",
      ad: "Davranış özeti",
      metin: girdi.kartSistemi
        ? `${selamlama(girdi.veliAdi)} ${girdi.ogrenciAdi} şu ana kadar ${girdi.ozet.arti} yıldız, ${girdi.ozet.sariKart} sarı kart ve ${girdi.ozet.kirmiziKart} kırmızı kart aldı.`
        : `${selamlama(girdi.veliAdi)} ${girdi.ogrenciAdi} şu ana kadar ${girdi.ozet.arti} artı ve ${girdi.ozet.eksi} eksi aldı.`,
    },
  ];

  // Kart sisteminde, aynı ders içinde sarı üstüne kırmızıya yükselen bir
  // ihlal yaşanmışsa: veliye durumu anlatan, cezalandırıcı olmayan bir
  // bilgilendirme mektubu. Kırmızı kartı hiç olmayan öğrencide anlamsız.
  if (girdi.kartSistemi && girdi.ozet.kirmiziKart > 0) {
    sablonlar.push({
      anahtar: "kart-olay",
      ad: "Kart uygulaması (sarı → kırmızı)",
      // Öğretmenin kendi yazdığı metin, birebir korunuyor. Değişen tek şey
      // sonundaki öğrenci adı — "sistem sadece ismi değiştirecek" isteği.
      metin: `${selamlama(girdi.veliAdi)} bugün İngilizce dersimizde sınıf içi davranış ve katılım sistemimiz kapsamında öğrencimize önce sarı kart ile ilk uyarı verilmiştir. Uyarıya rağmen sınıf kurallarına uygun olmayan davranışın devam etmesi üzerine kırmızı kart ile ikinci uyarı uygulanmıştır.

Dönem sonunda verilecek 3 performans notundan biri, öğrencinin ders içerisindeki katılımı, kurallara uyumu ve genel sınıf içi performansı dikkate alınarak bu sistem üzerinden değerlendirilecektir. Kırmızı kart performans notunu olumsuz etkileyebilmektedir. Bununla birlikte bu durum öğrencinin dönem içerisindeki sonraki derslerde göstereceği olumlu katılım ve kurallara uyumla telafi edilebilir.

Amacımız öğrencimizi cezalandırmak değil, ders ortamının düzenli ve verimli bir şekilde ilerlemesini sağlamak. Önümüzdeki derslerde daha olumlu bir performans göstereceğine inanıyorum. Desteğiniz için teşekkür ederim.

Öğrenci: ${girdi.ogrenciAdi}`,
    });
  }

  // Tek seferlik bir olaydan farklı: aynı öğrencide kırmızı kart birden
  // fazlaysa (yani tekrar ediyorsa) daha ciddi ve iş birliği isteyen bir ton.
  if (girdi.kartSistemi && girdi.ozet.kirmiziKart > 1) {
    sablonlar.push({
      anahtar: "kart-tekrar",
      ad: "Tekrarlayan davranış",
      metin: `${selamlama(girdi.veliAdi)} ${girdi.ogrenciAdi} ile ilgili sınıf içi davranış ve katılım sistemimiz kapsamında daha önce de bir uyarı paylaşmıştım. Benzer durumun tekrar etmesi üzerine bu konuyu bir kez daha sizinle paylaşmak istedim.

Ders içi katılım ve kurallara uyum, dönem sonu performans değerlendirmesinin bir parçasıdır; tekrar eden ihlaller bu notu olumsuz etkileyebilir. Yine de amacımız bir yaptırım uygulamak değil, ${girdi.ogrenciAdi}'in sınıf ortamına uyumunu birlikte güçlendirmektir.

Evde de bu konuda destek olabilirseniz, önümüzdeki derslerde farkı görebileceğimize inanıyorum. Görüş ve sorularınızı benimle paylaşmaktan çekinmeyin. Desteğiniz için teşekkür ederim.`,
    });
  }

  if (girdi.odevOzeti.toplam > 0) {
    sablonlar.push({
      anahtar: "odev",
      ad: "Ödev durumu",
      metin: `${selamlama(girdi.veliAdi)} ${girdi.ogrenciAdi}'in ödev tamamlama oranı %${girdi.odevOzeti.oran} (${girdi.odevOzeti.done + girdi.odevOzeti.late}/${girdi.odevOzeti.toplam}).`,
    });
  }

  if (girdi.sonSinav) {
    sablonlar.push({
      anahtar: "sinav",
      ad: "Son sınav",
      metin: `${selamlama(girdi.veliAdi)} ${girdi.ogrenciAdi}'in "${girdi.sonSinav.baslik}" sınavı: ${girdi.sonSinav.puan}/${girdi.sonSinav.maxScore} (%${girdi.sonSinav.yuzde}).`,
    });
  }

  // Belirli bir olaya bağlı değil; her zaman önerilir. Köşeli parantez
  // öğretmenin o anki gözlemini eklemesi için bir hatırlatma, gönderilmeden
  // önce doldurulması/kaldırılması beklenir.
  sablonlar.push({
    anahtar: "genel-durum",
    ad: "Genel durum bilgilendirmesi",
    metin: `${selamlama(girdi.veliAdi)} ${girdi.ogrenciAdi}'in derslerimizdeki genel katılımı ve sınıf içi davranışı hakkında kısa bir bilgilendirme yapmak istedim. [Güncel gözleminizi buraya ekleyin.]

Ders içi katılım, kurallara uyum ve genel tutum, dönem sonunda verilecek performans değerlendirmesinin bir parçasıdır. Süreç boyunca gelişimini yakından takip ediyor, kendisini olumlu yönde desteklemeye devam ediyoruz.

Her türlü soru ya da geri bildiriminiz için bana ulaşabilirsiniz. İlginiz için teşekkür ederim.`,
  });

  sablonlar.push({ anahtar: "serbest", ad: "Serbest", metin: "" });

  return sablonlar;
}
