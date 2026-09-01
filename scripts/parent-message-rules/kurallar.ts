import {
  EN_UZUN_MESAJ,
  mesajGecerliMi,
  telefonuUluslararasiyaCevir,
  whatsappBaglantisi,
  mesajSablonlari,
} from "../../src/lib/parent-message-rules";

let gecti = 0, kaldi = 0;
const ok = (ad: string, kosul: boolean, ayrinti = "") => {
  console.log(`${kosul ? "GECTI" : "KALDI"}  ${ad}${kosul ? "" : `  -> ${ayrinti}`}`);
  kosul ? gecti++ : kaldi++;
};

// --- Mesaj gecerliligi ---
ok("Bos mesaj gecersiz", !mesajGecerliMi(""));
ok("Yalnizca bosluk gecersiz", !mesajGecerliMi("   "));
ok("Normal mesaj gecerli", mesajGecerliMi("Merhaba, iyi günler."));
ok("Sinir uzunluk gecerli", mesajGecerliMi("a".repeat(EN_UZUN_MESAJ)));
ok("Sinir asan gecersiz", !mesajGecerliMi("a".repeat(EN_UZUN_MESAJ + 1)));

// --- Telefon normalizasyonu ---
ok("0'li yerel format", telefonuUluslararasiyaCevir("0555 123 45 67") === "905551234567");
ok("0'siz yerel format", telefonuUluslararasiyaCevir("555 123 45 67") === "905551234567");
ok("Zaten uluslararasi", telefonuUluslararasiyaCevir("905551234567") === "905551234567");
ok("Arti isaretli", telefonuUluslararasiyaCevir("+90 555 123 45 67") === "905551234567");
ok("Noktali/tireli yazim", telefonuUluslararasiyaCevir("0555.123.45.67") === "905551234567");
ok("Cok kisa numara cozulmez", telefonuUluslararasiyaCevir("12345") === null);
ok("Bos numara cozulmez", telefonuUluslararasiyaCevir("") === null);
ok("Yabanci format cozulmez", telefonuUluslararasiyaCevir("+1 202 555 0143") === null);

// --- WhatsApp baglantisi ---
ok("Telefon yoksa baglanti kurulmaz", whatsappBaglantisi(null, "merhaba") === null);
ok("Cozulmeyen telefon baglanti kurmaz", whatsappBaglantisi("123", "merhaba") === null);
{
  const baglanti = whatsappBaglantisi("0555 123 45 67", "Merhaba & iyi günler!");
  ok("Baglanti dogru numarayla kuruluyor", (baglanti ?? "").startsWith("https://wa.me/905551234567?text="));
  ok("Mesaj URL-encode ediliyor", (baglanti ?? "").includes(encodeURIComponent("Merhaba & iyi günler!")));
}

// --- Sablonlar ---
{
  const sablonlar = mesajSablonlari({
    ogrenciAdi: "Ayşe Yılmaz",
    veliAdi: "Fatma Yılmaz",
    kartSistemi: false,
    ozet: { arti: 5, eksi: 2, sariKart: 0, kirmiziKart: 0 },
    odevOzeti: { toplam: 0, oran: 0, done: 0, late: 0 },
    sonSinav: null,
  });
  ok("Odev yoksa odev sablonu yok", !sablonlar.some((s) => s.anahtar === "odev"));
  ok("Sinav yoksa sinav sablonu yok", !sablonlar.some((s) => s.anahtar === "sinav"));
  ok("Serbest sablon her zaman var", sablonlar.some((s) => s.anahtar === "serbest" && s.metin === ""));
  const davranis = sablonlar.find((s) => s.anahtar === "davranis");
  ok("Basit sablonda arti/eksi geciyor", (davranis?.metin ?? "").includes("5 artı ve 2 eksi"));
  ok("Veli adi selamlamada geciyor", (davranis?.metin ?? "").startsWith("Merhaba Fatma Yılmaz,"));
}

{
  const sablonlar = mesajSablonlari({
    ogrenciAdi: "Ali Kaya",
    veliAdi: null,
    kartSistemi: true,
    ozet: { arti: 3, eksi: 0, sariKart: 1, kirmiziKart: 2 },
    odevOzeti: { toplam: 4, oran: 75, done: 2, late: 1 },
    sonSinav: { baslik: "1. Yazılı", puan: 80, maxScore: 100, yuzde: 80 },
  });
  ok("Veli adi yoksa genel selamlama", (sablonlar[0]?.metin ?? "").startsWith("Merhaba,"));
  ok("Kart sisteminde yildiz/kart geciyor", sablonlar[0].metin.includes("3 yıldız, 1 sarı kart ve 2 kırmızı kart"));
  const odev = sablonlar.find((s) => s.anahtar === "odev");
  ok("Odev varsa odev sablonu var", odev !== undefined && odev.metin.includes("%75") && odev.metin.includes("3/4"));
  const sinav = sablonlar.find((s) => s.anahtar === "sinav");
  ok("Sinav varsa sinav sablonu var", sinav !== undefined && sinav.metin.includes("1. Yazılı") && sinav.metin.includes("80/100"));
}

console.log(`\n${gecti} gecti, ${kaldi} kaldi`);
process.exit(kaldi === 0 ? 0 : 1);
