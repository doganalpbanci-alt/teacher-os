# Teacher OS — Yol Haritası

Gelişim yönü ve ana versiyonlar. Detaylı görev listesi değildir.

Durum işaretleri: `✓` tamam · `◐` kısmen · boş = yapılmadı.

## v0.1 — Core / Gerçek kullanım
- ✓ Ders modu
- ✓ Öğrenci +/− sistemi
- ✓ Sarı/kırmızı kart
- ✓ Performans puanı
- ✓ Teneffüs cezası
- ✓ Öğrenci davranış geçmişi

Ayrıca tamamlandı: giriş sistemi ve öğretmen bazlı veri ayrımı, davranış
şablonları (basit / kart sistemi).

v0.1 canlıda doğrulandı.

## v0.2 — Ders Yönetimi
- ✓ Ders başlatma ve bitirme *(bir sınıfın aynı anda tek dersi olur)*
- ✓ Ders geçmişi
- ✓ Ders bazlı takip *(tek dersin kayıtları)*
- ✓ Kullanım deneyimi iyileştirmeleri *(telefon ve akıllı tahta düzeni)*

v0.2 tamamlandı ve canlıda kullanımda.

## v0.3 — Ödev
- ✓ Ödev oluşturma *(çoklu sınıf ve tek tek öğrenci seçimi, başlangıç ve
  son teslim tarihi, geçmişe dönük verilebilir)*
- ✓ Öğrenci bazlı takip *(tek tek ve sınıf bazında toplu işaretleme)*
- ✓ Ödev geçmişi *(öğrenci sayfasında, sınıfta ve ödevler sekmesinde)*

Ayrıca tamamlandı: ödevler kendi üst sekmesinde, düzenleme, arşivleme ve
silme, ödev kopyalama, öğrenci ve sınıf bazlı ödev istatistikleri, "süresi
geçti" göstergesi, ana sayfada günlük gündem paneli ve sekme sayacı.

Mimari karar: ödev bir sınıfa değil öğretmene aittir; kime verildiği teslim
kayıtlarından türetilir. Ayrıntısı `HANDOFF.md`'de.

v0.3 canlıda kullanımda.

## v0.4 — Sınav & Akademik Takip
- ✓ Sınav sonuçları *(bileşenli sınav: MEB üç parça, tek puan, tarama/net;
  ağırlıklı hesap yüzde üzerinden)*
- ✓ Sınıf ortalamaları *(sınav, sınıf ve bileşen bazında)*
- ✓ Öğrenci gelişimi *(öğrenci sayfasında dönem dönem sınav geçmişi)*
- Grafikler

Ayrıca tamamlandı: resmî/deneme ayrımı, "sınava girmedi" işareti, dönemin
sınav tarihinden türetilmesi, sınav düzenleme ve kopyalama, öğrenci dökümü.

Mimari karar ödevle aynı: sınav bir sınıfa değil öğretmene aittir. Ayrıntısı
`HANDOFF.md`'de.

Grafikler bilerek bırakıldı: sayılar okunur hâlde duruyor, grafiğin neyi
göstermesi gerektiği birkaç dönem veri birikmeden belli olmaz.

v0.4 canlıda, gerçek kullanım bekleniyor.

## v0.5 — Veli İletişimi
- Veli bilgileri
- Kişiselleştirilmiş mesajlar
- Mesaj geçmişi

Not: `ParentMessage` tablosu şemada hazır, `Student.parentName` ve
`parentPhone` zaten dolduruluyor. Mesajın nasıl gönderileceği (uygulama
içinde taslak mı, WhatsApp/SMS'e aktarma mı) kararlaştırılmadı; bu, işin
kapsamını belirleyen ilk soru.

## v0.6 — Dashboard & Raporlama
- Genel dashboard
- Öğrenci/sınıf raporları
- Gelişim görünümü

## v0.7 — AI Assistant
- Öğrenci ve sınıf verilerini analiz etme
- Öğretmene yardımcı sorgular

## v0.8 — PDF / AI Import
- PDF yükleme
- AI ile veri çıkarma
- Öğretmen onayı
- Database'e aktarım

## v0.9 — Smartboard
- Akıllı tahta ders görünümü
- Canlı öğrenci/davranış göstergeleri

## v1.0 — Teacher OS
Temel öğretmen yönetimi · davranış · ödev · sınav · veli iletişimi ·
raporlama · AI · smartboard.

---

## Ekstra — Gamification (opsiyonel modül)

Numaralı sıranın dışında tutulur: davranış şablonu gibi (`Teacher.behaviorTemplate`)
öğretmen bazlı açılıp kapanan ayrı bir modül olacak. Kart/yıldız sistemini
kullanmayan ya da bu tarz bir ödül mekaniği istemeyen öğretmen hiç görmeyecek.
v1.0'ın temel tanımına dahil değildir.

Büyükten küçüğe değil, en basitinden en büyüğüne düşünülüyor — her aşama
kendi başına anlamlı, bir sonrakini beklemek zorunda değil:

- Sınıf hedefleri *(toplu yıldız/kart sayacı bir eşiğe ulaşınca ödül —
  "100 yıldızda film günü" gibi)*
- Tecrübe puanı (XP) ve seviye
- Bireysel ödüller
- Karakter özelleştirme
- Öğrenciler arası düello

Mimari not: kaynak veri yine `BehaviorLog` olacak (ya da yanına eklenecek
benzer bir event tablosu). XP ve seviye `Student.performanceScore` ile aynı
prensiple çalışır — geçmiş kayıttan **türetilen**, hızlı erişim için
tutulan bir değer; kayıtların kendisi hiçbir zaman silinip yeniden yazılmaz.

Sınıf hedefleri en basit ve en bağımsız parça: mevcut kart sistemi üzerine
kurulur, başka hiçbir modülü beklemez. Bu yüzden istenirse v0.5'i beklemeden
de ele alınabilir — sıra öğretmenin isteğine göre belirlenir, roadmap
numarasına göre değil. XP/seviyeden itibaren gelen kısım daha büyük bir
mimari karar gerektirir (XP'nin kaynağı, performans notuyla ilişkisi,
seviyenin neyi temsil ettiği) ve şimdilik yalnızca yer ayrılıyor;
tasarımı iş sırası geldiğinde yapılır.

---

## Notlar
- Bu belge bağlayıcı talimat değildir; yön gösterir.
- Gerçek kullanım geri bildirimlerine göre versiyon sırası değişebilir.
- Gelecek versiyonların özelliklerini bugünkü işe gereksiz yere çekme.
- Kural ve mimari kararlar için `CLAUDE.md` geçerlidir.
