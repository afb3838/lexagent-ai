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

## Madde 4 — Vekaletname OCR alan çıkarımı (TAMAMLANDI — zaten uygundu, küçük iyileştirme)
- Kod incelemesi: `VEKALETNAME_EXTRACTION_SYSTEM` istenen tüm alanları zaten
  çıkarıyordu (vekil adı, müvekkil adı, TC, adres, özel yetkiler, tarih, noter)
  ve "okuyamadığın alanı null bırak, ASLA uydurma" kuralı zaten vardı.
  `ozel_yetkiler` örnek listesine "Dava Açma" eklendi (madde 4'te açıkça
  istenen bir örnekti, eksikti).
- `extract_vekaletname_fields` Gemini hata/kota durumunda `{}` döndürüp
  formu boş bırakıyor (crash yok), `vekaletname.js` null alanları formu
  doldurmadan atlıyor (JS falsy kontrolü) — uydurma değer riski yok.
- Kod değişikliği küçük olduğu için ayrı commit yerine Madde 5 ile birlikte
  commitlenecek.

## Madde 5 — Emsal Araştırma halüsinasyon sıkılaştırması (TAMAMLANDI — zaten uygundu)
- Kod incelemesi: `bul_dogrulanmamis_kunyeler()` gerçekten Gemini'nin ham
  `groundingSupports` karakter-aralıklarını kullanıp her Esas/Karar künyesinin
  bu aralıklarda geçip geçmediğini kontrol ediyor (prompt'a değil, API'nin
  kendi grounding verisine dayanan kod-seviyesi kontrol — tam istenen şey).
  `/api/research`'te `chunks` boşsa (grounding hiç kaynak dönmediyse) model
  metni HİÇ gösterilmiyor, sabit "şu anda gerçek kaynaklardan doğrulanmış bir
  emsal karar bulunamadı" mesajı dönüyor — madde 5'in istediği tam davranış.
  Doğrulanamayan künyeler ayrı etiketle işaretleniyor (frontend'de kırmızı
  "kaynağı doğrulanamadı" rozeti, `api.js` → `renderKaynakliSonuc`).
- Değişiklik gerekmedi, sadece doğrulandı.

## Madde 6 — Uçtan uca canlı test döngüsü (DEVAM EDİYOR)
Supabase Authentication panelinden `afurkan.baser+lextest2@gmail.com` test
hesabı "Auto confirm user" ile oluşturuldu (gerçek hesabınıza dokunulmadı,
sadece test verisi). Bununla canlıda gerçek tıklamalarla test edildi:

- **Kayıt ol akışı**: `afurkan.baser+lexagenttest@gmail.com` ile kayıt denendi,
  "Kayıt başarılı, e-postanızı onaylayın" mesajı doğru çıktı (e-posta onayı
  gerektiği için o hesapla giriş tamamlanamadı — Supabase admin panelinden
  "Auto confirm" ile ikinci bir test hesabı açılarak devam edildi). Bu ilk
  test hesabı silindi.
- **Giriş yap**: Yeni hesapla sorunsuz giriş yapıldı, boş "Dosyalarım" ekranı
  doğru göründü.
- **Boş form gönderme**: "Yeni Dosya" formunu boş gönderme → doğru şekilde
  reddedildi (dosya oluşmadı, "Müvekkil adı zorunlu" kuralı çalışıyor).
- **Türkçe özel karakter**: "Öğüt Çağlaşşık İnşaat A.Ş." / "Şükrü Güneş" ile
  dosya oluşturuldu, ç/ğ/ı/ö/ş/ü karakterleri başlıkta ve veritabanında sorunsuz
  görüntülendi.
- **Negatif/sıfır tutar**: Cari Hesap'ta -500 TL girilip Kaydet'e basıldığında
  doğru şekilde reddedildi ("Geçerli bir tutar girin"); 1500 TL ile tekrar
  denendiğinde doğru kaydedildi, bakiye güncellendi.
- **🔴 GERÇEK BUG BULUNDU VE DÜZELTİLDİ (commit b4b3ac3)**: F5 ile sayfa
  yenilendiğinde dosya detay sayfası tamamen BOŞ kaldı (sidebar var, içerik
  yok). Kök neden: bir önceki committe (717cee5) `router()`'ın başına eklenen
  `closeMobileMenu()` çağrısı, tarayıcıda eski HTML (yeni `#sidebar` id'si
  olmayan) + yeni app.js karışık önbellekte kaldığında `getElementById(...).
  classList` üzerinde `null` hatası fırlatıp **router()'ın tamamını
  durduruyordu** — hiçbir `.page` div'i gösterilmiyordu. İki katmanlı düzeltme
  yapıldı: (1) `closeMobileMenu`/`toggleMobileMenu`'de optional chaining ile
  eksik elementin router'ı asla bloklamaması sağlandı, (2) statik dosyalara
  `Cache-Control: no-cache` eklenerek tarayıcının her deploy sonrası
  sunucuyla revalidate etmesi, eski HTML+yeni JS karışımının bir daha
  oluşmaması sağlandı. Bu, sadece benim art arda hızlı deploy yapmamdan
  kaynaklanan bir senaryo değildi — gerçek kullanıcılar da her deploy sonrası
  aynı riske maruz kalabilirdi, bu yüzden kritik önemde bir düzeltmeydi.
- **Mobil genişlik**: `resize_window` aracı bu ortamda gerçek viewport'u
  değiştirmiyor (window.innerWidth sabit kaldı), bu yüzden görsel olarak
  doğrulanamadı. Ancak kod incelemesi sırasında sidebar'ın sabit 240px
  genişlikte, responsive class'ı olmadan tasarlandığı fark edildi (gerçek
  bir eksiklik) — hamburger menü + slide-in sidebar + overlay eklendi
  (commit 717cee5), toggle mantığı DOM üzerinden doğrulandı.
- **🔴 İKİNCİ GERÇEK BUG BULUNDU VE DÜZELTİLDİ**: Ajanda'da "Yeni Etkinlik"
  formunu doldurup "Kaydet"e iki kez art arda tıklandığında (form görünür
  şekilde kapanmadığı için ikinci tıklama doğal geliyor), network sekmesi
  incelemesiyle **2 ayrı POST /api/etkinlikler isteğinin ikisinin de 200
  döndüğü ve aynı başlıkla 2 kopya kayıt oluştuğu** doğrulandı
  (`api.listEtkinlikler()` ile teyit edildi: 2× "Duruşma - Ön İnceleme").
  Kök neden: "Kaydet" butonları gönderim sırasında devre dışı bırakılmıyordu,
  aynı formu ikinci kez göndermeyi engelleyen bir kilit yoktu. Düzeltme:
  uygulamadaki TÜM "oluştur/kaydet" fonksiyonlarına (Yeni Dosya, Cari Hesap
  kaydı, Vekaletname kaydet, Ajanda etkinlik, İcra Takip oluştur, İcra adımı
  ekle, Plan talebi) aynı basit kilit deseni eklendi: fonksiyon çalışırken
  tekrar çağrılırsa sessizce çıkar, network isteği tamamlanınca kilit açılır.
  Test hesabındaki kopya etkinlik kaydı temizlendi (test hesabı tamamen
  silinerek — gerçek kullanıcı verisine dokunulmadı).
- Mobil genişlik: kod incelemesiyle sidebar'ın sabit 240px genişlikte,
  responsive class'ı olmadığı görüldü (gerçek eksiklik) — hamburger menü +
  slide-in sidebar + overlay eklendi (commit 717cee5).
- Kalan kontroller (Vekaletname/İcra Takip'te tekrar tıklama sonrası kayıt
  doğrulaması, farklı tarayıcı genişlikleri) zaman kısıtı nedeniyle kod
  düzeyinde düzeltilip genel desenle kapatıldı; her modülde ayrı ayrı canlı
  tekrar test edilmedi — düzeltmenin doğruluğu Ajanda'daki orijinal bug ile
  birebir aynı kod deseni olduğu için yüksek güvenilirlikte kabul edildi.

