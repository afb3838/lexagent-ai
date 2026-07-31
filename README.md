# LexAgent AI — Kurulum ve Yayınlama Rehberi

Bu uygulama iki parçadan oluşur:
- **backend/** → Python (FastAPI) sunucusu. Gemini API'yi *sunucu tarafında* çağırır (API anahtarınız tarayıcıda hiç görünmez).
- **backend/static/** → Web arayüzü (tek bir HTML dosyası, backend tarafından otomatik sunulur).

Aşağıdaki adımları sırayla takip edin. Toplam süre yaklaşık 20-30 dakika.

---

## ADIM 1 — Ücretsiz Gemini API Anahtarı Alın

1. https://aistudio.google.com adresine gidin, Google hesabınızla giriş yapın.
2. Sol menüden **Get API key** seçeneğine tıklayın.
3. **Create API key** → **Create API key in new project** seçin.
   - ⚠️ "Set up billing" veya "Link a paid API key" seçeneklerine TIKLAMAYIN, bunlar gerekli değil.
4. Size verilen `AIzaSy...` ile başlayan anahtarı bir kenara not edin. (Bunu birazdan Render'a ekleyeceğiz, koda YAZMAYACAĞIZ.)

---

## ADIM 2 — GitHub Hesabı ve Depo (Repository) Oluşturun

1. https://github.com adresinde ücretsiz bir hesap oluşturun (yoksa).
2. Sağ üstteki **+** işaretine tıklayıp **New repository** seçin.
3. Repository adı: `lexagent-ai` yazın, **Public** veya **Private** seçin (fark etmez), **Create repository** butonuna basın.
4. Açılan sayfada **"uploading an existing file"** linkine tıklayın.
5. Bilgisayarınızdaki `lexagent` klasörünün İÇİNDEKİ tüm dosya ve klasörleri (backend klasörü, README.md vb.) bu sayfaya sürükleyip bırakın.
6. Alt kısımdaki **Commit changes** butonuna basın.

---

## ADIM 3 — Render.com'da Yayınlayın (Ücretsiz)

1. https://render.com adresine gidin, **GitHub hesabınızla** ücretsiz kayıt olun.
2. Render panelinde **New +** → **Web Service** seçin.
3. GitHub deponuzu (`lexagent-ai`) bulup **Connect** deyin.
4. Ayarları şöyle doldurun:
   - **Name**: `lexagent-ai` (istediğiniz isim)
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free`
5. Aşağıda **Environment Variables** (Ortam Değişkenleri) bölümüne gelin, **Add Environment Variable** deyin:
   - **Key**: `GEMINI_API_KEY`
   - **Value**: Adım 1'de aldığınız `AIzaSy...` anahtarı
6. **Create Web Service** butonuna basın.
7. Render birkaç dakika içinde uygulamanızı derleyip yayınlayacak. Üstteki logları izleyebilirsiniz; "Your service is live 🎉" yazısını görünce hazırdır.
8. Size verilen adrese (`https://lexagent-ai-xxxx.onrender.com` gibi) tıklayarak uygulamayı açabilirsiniz.

---

## ADIM 4 — Test Edin

1. Açılan sayfanın sağ üstünde **"Sunucu hazır (gemini-3.6-flash)"** yazısını görmelisiniz — bu, API anahtarının doğru tanındığını gösterir.
2. Bir .pdf veya .udf dosyası yükleyin, dava konusu/talebinizi yazın, **"Emsal Araştırmayı Başlat"** butonuna basın.
3. Sonuçlar geldikten sonra **"Bu Kararlarla Dilekçeyi Oluştur"** butonuna basarak taslağı alın.

---

## Bilinmesi Gerekenler / Sınırlamalar

- **Ücretsiz Render planı** belirli bir süre kullanılmayınca "uyur"; ilk açılışta 30-60 saniye gecikme normaldir.
- **Gemini ücretsiz API kotası** dakikada/günde sınırlıdır. Yoğun kullanımda "kota aşıldı" hatası alırsanız birkaç dakika bekleyip tekrar deneyin.
- Sistem, **karararama.yargitay.gov.tr** ve **Kazancı** gibi güvenlik kodu (CAPTCHA) veya abonelik ile korunan sitelere doğrudan bağlanamaz — bu teknik olarak mümkün değildir ve kullanım şartlarına aykırıdır. Bunun yerine Gemini'nin **gerçek web araması (grounding)** özelliğiyle açık kaynaklardan doğrulanabilir kararlar arar; halüsinasyon (uydurma karar) riskini azaltmak için sistem, emin olmadığı durumlarda bunu açıkça belirtecek şekilde talimatlandırılmıştır.
- **Bu araç hukuki tavsiye vermez, avukatın yerini tutmaz.** Üretilen her taslak mutlaka bir avukat tarafından incelenmelidir.

---

## Model adı ileride "not found" hatası verirse

Google zaman zaman model isimlerini değiştiriyor. Eğer `models/gemini-3.6-flash is not found` gibi bir hata alırsanız:
1. Render panelinde uygulamanızın **Environment** sekmesine gidin.
2. `GEMINI_MODEL` adında yeni bir ortam değişkeni ekleyin, değerine güncel model adını yazın (örn. `gemini-flash-latest` yerine güncel GA modelini kullanın — https://ai.google.dev/gemini-api/docs/models sayfasından kontrol edin).
3. **Save, rebuild and deploy** deyin.

Kodu değiştirmenize gerek yoktur; `GEMINI_MODEL` ortam değişkeni tanımlıysa kod otomatik olarak onu kullanır.
