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

## ADIM 5 — Dosya Yönetimi ve Giriş için Supabase Kurulumu

Uygulama artık "Dosya" (dava) bazlı çalışıyor: giriş yapmanız, dosya oluşturmanız ve
belge yüklemeniz gerekiyor. Bunun için ücretsiz bir **Supabase** (veritabanı + kullanıcı girişi
+ dosya depolama) hesabı gerekir. Aşağıdaki adımları takip edin.

### 5.1 — Supabase Projesi Oluşturun

1. https://supabase.com adresine gidin, ücretsiz kayıt olun.
2. **New Project** deyin, bir isim verin (örn. `lexagent-ai`), bir veritabanı şifresi belirleyin
   (bir kenara not edin, ileride lazım olabilir), bölge olarak size yakın birini seçin.
3. Proje oluşunca sol menüden **Project Settings → API** sayfasına gidin. Şu üç değeri not alın:
   - **Project URL** (örn. `https://xxxxx.supabase.co`)
   - **anon public** anahtarı (uzun bir metin, `eyJ...` ile başlar)
   - **service_role** anahtarı (⚠️ bu GİZLİ bir anahtardır, GEMINI_API_KEY gibi asla tarayıcıya
     veya koda YAZILMAZ, sadece Render'a env var olarak eklenecek)
4. Aynı sayfada **JWT Settings** bölümüne bakın: **"Legacy JWT Secret"** diye bir alan görüyorsanız
   onu da not alın (bu, ADIM 5.4'te `SUPABASE_JWT_SECRET` olarak kullanılacak). Görmüyorsanız
   sorun değil, bu durumda o değişkeni Render'a hiç eklemeyeceksiniz.

### 5.2 — Giriş İçin Tek Kullanıcı Oluşturun

Uygulamada herkese açık kayıt (signup) ekranı YOK — sadece sizin (veya büronuzdaki) önceden
oluşturulmuş hesapla giriş yapılır.

1. Supabase panelinde sol menüden **Authentication → Users** sayfasına gidin.
2. **Add user → Create new user** deyin, kendi e-posta adresinizi ve bir şifre belirleyin.
   "Auto Confirm User" seçeneğini işaretleyin (e-posta doğrulama beklemeden giriş yapabilesiniz).

### 5.3 — Veritabanı Şemasını ve Depolama Alanını Oluşturun

1. Sol menüden **SQL Editor**'e gidin, **New query** deyin.
2. Bu depodaki `supabase/schema.sql` dosyasının tüm içeriğini kopyalayıp yapıştırın, **Run**'a basın.
3. Sol menüden **Storage**'a gidin, **New bucket** deyin, adını tam olarak `dosyalar` yazın,
   **Public bucket** seçeneğini İŞARETLEMEYİN (private kalsın — yüklenen belgeler gizli olmalı).

### 5.4 — Render'a Yeni Ortam Değişkenlerini Ekleyin

Render panelinde uygulamanızın **Environment** sekmesine gidip şunları ekleyin:

- `SUPABASE_URL` → 5.1'de aldığınız Project URL
- `SUPABASE_SERVICE_ROLE_KEY` → 5.1'de aldığınız service_role anahtarı
- `SUPABASE_JWT_SECRET` → 5.1'de "Legacy JWT Secret" gördüyseniz onu ekleyin; görmediyseniz
  bu değişkeni hiç eklemeyin (sistem otomatik olarak JWKS yöntemine geçer).

**Save, rebuild and deploy** deyip yeniden yayınlayın.

### 5.5 — Frontend'e Supabase Bilgilerini Ekleyin

`backend/static/api.js` dosyasını açın, en üstteki iki satırı kendi bilgilerinizle değiştirin:

```js
const SUPABASE_URL = "https://xxxxx.supabase.co";   // kendi Project URL'niz
const SUPABASE_ANON_KEY = "eyJ...";                  // kendi anon public anahtarınız
```

(`anon` anahtarı public bir anahtardır, tarayıcıda görünmesi güvenlidir — `service_role`
anahtarıyla karıştırmayın, o asla buraya yazılmaz.)

Değişikliği GitHub'a yükleyip Render'ın yeniden deploy etmesini bekleyin (veya Render'da
**Manual Deploy** deyin). Ardından sitenizi açıp 5.2'de oluşturduğunuz e-posta/şifre ile
giriş yapabilir, "Yeni Dosya" ile ilk dava dosyanızı oluşturabilirsiniz.

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
