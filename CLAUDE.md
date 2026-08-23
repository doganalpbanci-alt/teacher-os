# Teacher OS

## Amaç
İngilizce öğretmenlerinin öğrenci, sınıf, ders, ödev, performans ve davranış takibini tek panelden yapabilmesi.

## Temel prensipler
- Simple now, extensible later.
- Gereksiz abstraction ve over-engineering yapma.
- Çalışan kodlara gerekmedikçe dokunma.
- Değişiklikleri mümkün olan en küçük kapsamda tut.
- Yeni özellik eklemeden önce mevcut mimariyi incele.
- Kritik değişikliklerde önce nedenini ve çözümünü açıkla, onaydan sonra uygula.
- Her değişiklikten sonra ilgili özelliği test et.
- Mevcut özelliklerde regression oluşturma.

## Veri prensipleri
Şablondan bağımsız, her zaman geçerli:
- Öğrenci geçmişi kaybolmamalı.
- +/- ve kartlar yalnızca toplam sayı olarak değil, tarihçesi tutulan event kayıtları olarak saklanmalı.
- Kayıt katmanı tek ve ortaktır; şablonlar yalnızca bu kayıtların nasıl üretildiğini ve yorumlandığını değiştirir.
- Şablon değiştirmek geçmiş kayıtları silmez veya değiştirmez.

## Davranış şablonları
Öğretmen hangi sistemi kullandığını seçer (`Teacher.behaviorTemplate`).
Şablon profile bağlıdır, öğretmenin tüm sınıflarında geçerlidir.
Şablon kurallarını tek bir servis/modülde tut.

### Basit (varsayılan)
- Ders içinde yalnızca artı ve eksi verilir, kart yoktur.
- Kayıtlar performans notunu kendiliğinden değiştirmez.
- Performans notunu öğretmen geçmişe bakarak elle girer.

### Kart sistemi
- İlk kural ihlali → Yellow Card + warning.
- Aynı ders içinde tekrar eden ihlal → Red Card + MINUS.
- Yellow Card, öğrenci davranışını düzelttiyse sonraki derste sıfırlanır.
- Kart durumu yalnızca aktif dersin kayıtlarından hesaplanır; sıfırlama diye bir yazma işlemi yoktur.
- Performance score loglardan türetilir; `Student` üzerindeki değer hızlı erişim için cached value olarak tutulabilir.
- Başlangıç değeri: 90. MINUS = -5 puan, PLUS = +1 puan.
- Bu değerleri merkezi sabitlerden yönet.

## Kapsam
Uygulama tek öğretmenin kişisel aracı olarak başladı, artık başka öğretmenlerin
de kullanabileceği şekilde ilerliyor. Varsayılan davranış herkes için sade
olmalı; kişiye özel kurallar şablon olarak eklenir, koda gömülmez.

Şu an giriş sistemi yoktur ve uygulama internete açıktır. Gerçek öğrenci ve
veli bilgisi giriş sistemi tamamlanmadan girilmemeli.

## Gelecek
Mimari ileride Exam, PDF processing, AI assistant, reporting, smartboard ve gamification eklenmesine uygun olmalı. Bunları MVP'ye gereksiz yere dahil etme.

## Çalışma yöntemi
Önce incele → planla → onay al → uygula → test et → kısa rapor ver.
