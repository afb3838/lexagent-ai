# LexAgent AI — Hukuk Bürosu Yönetim Sistemi (Ürün Planı)

## Vizyon
"Emsal karar bul + dilekçe yaz" aracından, bir avukatın günlük işini yönetebileceği
kapsamlı bir başucu sistemine dönüşüm.

---

## Modüller

### 1. Dosya (Dava) Yönetimi — ÇEKİRDEK
- Her dosya için: müvekkil, karşı taraf, mahkeme, esas no, dava türü, açılış tarihi
- Dosya durumu (aşama): açıldı / bilirkişi bekleniyor / duruşma bekleniyor / karar çıktı / temyiz / kesinleşti
- **"Son ne yapıldı" özeti**: yüklenen her yeni evrak/tutanak sonrası AI otomatik olarak
  "bu dosyada son durum" özetini günceller (mevcut PDF/UDF okuma altyapımız üzerine kurulabilir)
- Dosyaya bağlı tüm belgeler tek yerde (dilekçeler, kararlar, deliller)

### 2. Vekaletname Klasörü
- Her müvekkil için vekaletname taraması/kaydı
- **Süre takibi**: vekaletnamenin kapsamı, özel yetkiler (temyiz, sulh, ibra vb. yetkisi var mı) etiketlenir
- Eksik/süresi biten vekaletname uyarısı

### 3. Cari Hesap / Müvekkil Defteri
- Müvekkil başına: anlaşılan ücret, alınan ödemeler, kalan bakiye
- Masraf takibi (harç, bilirkişi ücreti vb.)
- Basit gelir-gider raporu (muhasebeciye değil, büronuza özel takip için)

### 4. Ajanda / Takvim — KRİTİK MODÜL
- Duruşma tarihleri, tebliğ süreleri, temyiz/istinaf süreleri
- ⚠️ **Zamanaşımı ve hak düşürücü süre hesaplamaları otomatik yapılırsa MUTLAKA
  "bu bir öneridir, avukat kendi kontrol etmeli" uyarısıyla verilmeli** — yanlış hesap
  gerçek bir hak kaybına yol açabilir, bu üründe en yüksek riskli alan.
- Bildirim: e-posta/SMS ile duruşmadan X gün önce hatırlatma

### 5. UYAP Evrak İçe Aktarma (canlı entegrasyon yerine)
- Kullanıcı UYAP'tan dışa aktardığı .udf/.pdf dosyalarını yükler
- Sistem otomatik: tarafları çıkarır (müvekkil/karşı taraf), dosyayı doğru dava kaydına
  eşler veya yeni dosya oluşturur, "son durum" özetini günceller
- (İleri faz, riskli: kullanıcının kendi UYAP e-imza/mobil imza oturumuyla, kullanıcının
  açık rızasıyla, düşük sıklıkta otomatik senkronizasyon — hukuki ve teknik risk
  değerlendirmesi yapılmadan bu faza girilmemeli)

### 6. Emsal Karar Araştırma + Dilekçe Yazımı — MEVCUT
- Zaten kurulu modül, diğer modüllerle ilişkilendirilir (bir dosyanın içinden
  "bu dosya için emsal ara" / "bu dosya için dilekçe yaz" tetiklenebilir)

### 7. Belge Yönetimi
- Dosya bazlı klasörleme, versiyon geçmişi
- Arama (dosya içi metin araması)

---

## Önerilen Geliştirme Sırası (MVP → Tam Ürün)

**Faz 1 (mevcut + küçük ekleme):** Emsal + dilekçe modülü zaten var → buna "Dosya"
kavramını ekle (her araştırma/dilekçe bir dosyaya bağlansın)

**Faz 2:** Dosya Yönetimi + Belge Yönetimi + basit kullanıcı girişi (tek avukat/büro
hesabı, henüz çoklu kullanıcı değil)

**Faz 3:** Ajanda/Takvim + bildirimler (en çok değer katan, ama en dikkatli
yapılması gereken modül)

**Faz 4:** Vekaletname Klasörü + Cari Hesap

**Faz 5:** UYAP içe aktarma otomasyonu (dikkatli, riskleri değerlendirerek)

**Faz 6 (ticarileştirme):** Çoklu kullanıcı/büro desteği, abonelik/ödeme sistemi
(Stripe/iyzico), kullanım limitleri

---

## Teknik Not
Mevcut mimari (FastAPI backend + basit frontend, Gemini API sunucu tarafında)
bu genişlemeyi kaldırabilir; ihtiyaç duyulacaklar:
- Veritabanı (şu an yok — dosya/müvekkil/ajanda kalıcı veri gerektirir; PostgreSQL önerilir)
- Kullanıcı kimlik doğrulama (auth)
- Dosya depolama (yüklenen PDF/UDF'lerin kalıcı saklanması — S3 uyumlu depolama)

## Önemli Uyarı
Ajanda/süre hesaplama ve UYAP entegrasyonu modülleri **gerçek mesleki risk**
taşıyor (kaçırılan süre = müvekkile karşı sorumluluk). Bu modüllere geçmeden
önce her hesaplamanın yanına "bu bir yardımcı araçtır, nihai kontrol avukata
aittir" ibaresi eklenmeli ve mümkünse bir meslektaşla/baro ile ürünün bu
kısmı ayrıca gözden geçirilmeli.

---

## Arayüz İskeleti (Faz 2'den itibaren)

Ürün tek sayfalık bir form değil, gerçek bir "uygulama" gibi görünecek: solda sabit bir
navigasyon menüsü (Dosyalar, Ajanda, Vekaletnameler, Cari Hesap, Emsal Araştırma gibi
modül başlıkları) ve üstte hangi modülde olduğunu gösteren bir yapı. Henüz yapılmamış
modüller boş/placeholder ("Yakında") olarak menüde yer alır. Her yeni faz, mevcut modülleri
bu ortak iskelete (sol menü + sayfa alanı) ekleyerek ilerler; iskelet baştan kurulur,
sonradan modüllerle doldurulur.
