# LexAgent AI — Satışa Hazırlık Durum Raporu

Bu dosya, "2 gün içinde satışa hazır bitir" görevi kapsamında yapılan her adımı
kronolojik olarak biriktirir (üzerine yazılmaz, eklenir).

---

## 2026-08-04 — Başlangıç

Görev alındı: 7 madde (kullanım limiti, Gemini kota zarif davranış, AAÜT gerçek
tarife, Vekaletname OCR alan çıkarımı, Emsal Araştırma halüsinasyon sıkılaştırma,
uçtan uca test döngüsü, genel cila). Çalışma modu: onay beklemeden sürekli
test-et/düzelt/tekrar-test-et, her anlamlı düzeltmede commit+push.

## Madde 1 — Kullanıcı bazlı günlük limit (TAMAMLANDI, commit 6204253)
- Limit artık `GUNLUK_ARAMA_LIMITI` env var'ından okunuyor (varsayılan 15),
  sabit kod değil — Render Environment'tan deploy'suz değiştirilebilir.
- Kapsam genişletildi: /api/research, /api/draft, /api/vekaletname-oku
  (önceden sadece research+mevzuat kontrol ediliyordu, madde 1 dilekçe ve
  OCR'ı da istiyordu).
- Migration `supabase/011_gunluk_kullanim_limiti.sql` henüz kullanıcı
  tarafından Supabase'de çalıştırılmadı — tablo yokken kod "fail-open"
  çalışıyor (limit uygulanmaz ama sistem çökmez), bu yüzden acil değil
  ama gerçek limit için gerekli.

## Madde 2 — Gemini kota/hata durumunda zarif mesaj (TAMAMLANDI, commit 6204253)
- `friendly_gemini_error()` metinleri "kota/faturalandırma" kelimelerini
  hiç geçmeyecek şekilde değiştirildi: "Bu özellik şu anda geçici olarak
  kullanılamıyor..." — kullanıcıya asla ham JSON/teknik detay sızmıyor
  (zaten önceki oturumda kurulmuştu, bu turda sadece metin/görsel
  profesyonelleştirildi).
- Bu mesaj artık kırmızı "hata" kutusu yerine amber/turuncu "geçici"
  kutusunda gösteriliyor (research, dilekçe, doğrulama, mevzuat, belge
  analizi, vekaletname OCR — Gemini'ye dokunan her yüzeyde tutarlı).
- Diğer modüller (Dosyalar, Ajanda, Cari Hesap, İcra Takip, 5 hesaplayıcı,
  Vekaletname kayıt) zaten Gemini'ye hiç dokunmuyor, kod incelemesiyle
  doğrulandı — bu hatadan etkilenmeleri mümkün değil.

## Madde 3 — AAÜT gerçek resmi tarife (TAMAMLANDI)
- Kullanıcının verdiği Tablo 1 (26 mahkeme/iş türü, maktu ücret) ve Tablo 2
  (kademeli % dilim tablosu — önceki oturumdaki dilim tablosuyla birebir
  aynı çıktı, yani önceki rakamlar zaten doğruymuş) sıfırdan koduna işlendi.
- Madde 13 (nispi ücret maktu ücretin altına düşemez — iki tablo karşılaştırılıp
  büyük olan esas alınır), Madde 11 (icra: 56.250 TL eşiği), Madde 6/7 (yarı/tam
  ücret + mahkeme ücretini geçmeme sınırı), Madde 16 (arabuluculuk 1/4 fazlası,
  50.000 TL eşiği, asıl alacağı geçmeme sınırı) uygulandı.
- 8 senaryoyla localhost'ta javascript_exec ile test edildi, hepsi elle
  hesaplanan beklenen sonuçla birebir eşleşti (asliye 45.000 TL maktu, 500.000 TL
  dava değerinde 80.000 TL nispi, 100.000 TL dava değerinde madde 13 floor ile
  yine 45.000 TL, icra 30.000 TL'de madde 11 ile 9.000 TL, icra 200.000 TL'de
  32.000 TL nispi, madde 7 yarısı 22.500 TL, madde 16'da iki farklı deger için
  40.000 TL/40.000 TL — hepsi doğru).
- Listede olmayan özel durumlar için hesaplama yapılmıyor, kullanıcı arayüzde
  net şekilde "tarifeyi manuel kontrol edin" uyarısı görüyor.

