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
- Öğrenci geçmişi kaybolmamalı.
- +/- ve kartlar yalnızca toplam sayı olarak değil, tarihçesi tutulan event kayıtları olarak saklanmalı.
- Performance score loglardan türetilir; `Student` üzerindeki değer hızlı erişim için cached value olarak tutulabilir.
- Başlangıç değeri: 90.
- MINUS = -5 puan, PLUS = +1 puan.
- Bu değerleri merkezi sabitlerden yönet.

## Kart sistemi
- İlk kural ihlali → Yellow Card + warning.
- Aynı ders içinde tekrar eden ihlal → Red Card + MINUS.
- Yellow Card, öğrenci davranışını düzelttiyse sonraki derste sıfırlanır.
- Geçmiş kart kayıtları silinmez.
- Kart kurallarını tek bir servis/modülde tut.

## Gelecek
Mimari ileride Exam, PDF processing, AI assistant, reporting, smartboard ve gamification eklenmesine uygun olmalı. Bunları MVP'ye gereksiz yere dahil etme.

## Çalışma yöntemi
Önce incele → planla → onay al → uygula → test et → kısa rapor ver.
