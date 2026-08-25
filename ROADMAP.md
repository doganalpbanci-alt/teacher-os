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
- Sınav sonuçları
- Sınıf ortalamaları
- Öğrenci gelişimi
- Grafikler

Not: `Exam` tablosu şu an `classroomId`'ye bağlı. Ödevde çözülen "tek sınıfa
bağlılık" sorusu burada da çıkacak; aynı karar baştan verilmeli.

## v0.5 — Veli İletişimi
- Veli bilgileri
- Kişiselleştirilmiş mesajlar
- Mesaj geçmişi

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

## Notlar
- Bu belge bağlayıcı talimat değildir; yön gösterir.
- Gerçek kullanım geri bildirimlerine göre versiyon sırası değişebilir.
- Gelecek versiyonların özelliklerini bugünkü işe gereksiz yere çekme.
- Kural ve mimari kararlar için `CLAUDE.md` geçerlidir.
