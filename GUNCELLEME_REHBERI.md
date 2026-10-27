# 🚀 AI Bitki Sağlığı Sistemi - Güncelleme ve Kurulum Rehberi

Bu dosya, projeyi kendi branch'ine çeken ekip üyeleri (Arif, Mahmut vb.) için güncel kodların ve yeni mimarinin sorunsuz çalışması adına yapılması gerekenleri ve kritik sistem özelliklerini içerir.

---

## 🐍 1. Kritik Mimariler ve Yenilikler (Okunması Önemli!)

### ⚡ A. AI Inference Daemon Modu (RAM'de Sıcak Modeller)
Eski tek katmanlı ve her istekte sıfırdan Python başlatan (`child_process.spawn`) hantal yapı **tamamen kaldırılmıştır**.
*   **Nasıl Çalışır:** Sunucu ilk başladığında Express, arka planda kalıcı bir **Python Daemon sunucusu** (yerel `localhost:5005` portunda) başlatır.
*   **Modeller RAM'de:** YOLO yaprak tespiti, MobileNet bitki sınıflandırma ve Keras hastalık sınıflandırma modellerinin tamamı **yalnızca 1 kez** RAM'e yüklenir ve orada sıcak tutulur.
*   **Performans Hızı:** Fotoğraf analiz süresi **8-12 saniyeden, 150-300 milisaniyeye (~40 kat hızlı)** düşürülmüştür.
*   **Güvenli Kapatma (Graceful Shutdown):** Konsolda `Ctrl+C` yaptığınızda veya sunucu durduğunda, Express arka plandaki Python sürecini otomatik olarak kapatır. Arka planda asla zombi Python süreçleri kalmaz.

### 🔌 B. Veritabanı Direnci ve Çevrimdışı Başlangıç (Offline Mode)
Sistemin veritabanı kesintileri veya çökmeleri anında çalışmaya devam etmesi için **Fail-Safe** mekanizmaları eklenmiştir:
*   **Gecikmeli Başlangıç Koruması:** Sunucu başlarken PostgreSQL servisine bağlanmak için **5 denemelik otomatik retry (3 saniye aralıklarla)** döngüsü çalıştırır.
*   **Yumuşak Geçiş (Graceful Degradation):** Eğer PostgreSQL tamamen kapalıysa sunucu çökmeden açılır. `/api/health` durumunda veritabanı `offline` olarak görünür.
*   **Çevrimdışı Analiz Desteği:** Veritabanı kapalı olsa dahi yapay zeka çıkarımı aksamaz. Fotoğraf analiz edildiğinde yaprak kesimi diske kaydedilir, tedavi önerisi oluşturulur ve istemciye sonuç döner (sadece teşhis geçmişi DB'ye kaydedilmez, API yanıtında `veritabani_kayitli: false` döner).

### 🔍 C. In-Memory Base64 Yaprak Kırpma Transferi
*   YOLO tarafından kırpılan yaprak görseli (crop) diskteki geçici bir dosya (`yolotest_fotosu.jpg`) üzerinden değil, **doğrudan bellekte Base64 formatına dönüştürülerek** HTTP üzerinden taşınır.
*   Bu sayede disk I/O hızı artırılmış, disk ömrü korunmuş ve eşzamanlı (concurrent) taleplerde resimlerin birbirinin üzerine yazılması hatası tamamen çözülmüştür.

---

## 📦 2. Backend (Sunucu) Kurulumu

### 🐍 Python Bağımlılıkları (Kritik)
Modelin çalışması için Python ortamınızda (venv) şu kütüphaneler yüklü olmalıdır:

```bash
pip install ultralytics tensorflow tf_keras pillow numpy
```

### 🟩 Node.js Bağımlılıkları
`backend` klasörüne gidin ve paketleri yükleyin:

```bash
cd backend
npm install
```
*Not: Yeni mimari ile birlikte `@tensorflow/tfjs` ve `sharp` gibi ağır Node.js paketleri kaldırılmış, tüm AI işlemleri saf Python `predict_pipeline.py` tarafına taşınmıştır.*

### ⚙️ .env Yapılandırması
`backend` klasörü içinde bir `.env` dosyası oluşturun ve sisteminize göre gerekli yapılandırmaları girin:

```env
# Python yolu (Kendi sanal ortam venv veya global Python yolunuz)
PYTHON_PATH=C:\v\venv\Scripts\python.exe

# Port Yapılandırmaları
PORT=3000
AI_DAEMON_PORT=5005

# PostgreSQL Bağlantı Bilgileri
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=plant_health_db

# Oturum token'larını imzalama anahtarı (herkes kendi rastgele değerini üretmeli, git'e eklenmez)
# Üretmek için: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=buraya-uzun-rastgele-bir-deger
```
İsteğe bağlı ayarlar:
```env
# Tarayıcıdan (Expo web vb.) erişebilecek origin'ler; tanımlı değilse yalnızca localhost
CORS_ORIGINS=https://verdantai.com,https://admin.verdantai.com
# Sunucu nginx gibi bir ters proxy arkasındaysa (rate limit gerçek istemci IP'sini görsün diye)
TRUST_PROXY=1
# Sunucu TLS'i kendisi sonlandıracaksa sertifika dosyaları (verilirse sunucu HTTPS çalışır)
TLS_CERT_PATH=/etc/ssl/verdant/fullchain.pem
TLS_KEY_PATH=/etc/ssl/verdant/privkey.pem
# HTTPS zorunluluğu: NODE_ENV=production iken varsayılan olarak açıktır; geliştirmede denemek için true
REQUIRE_HTTPS=true
```

### 🔐 HTTPS (Canlıya Çıkarken Zorunlu)
Canlı ortamda (`NODE_ENV=production`) backend şifrelenmemiş HTTP isteklerini **403 ile reddeder** (`/api/health` hariç). İki kurulum seçeneği vardır:

1. **Ters proxy ile (önerilen):** TLS'i [Caddy](https://caddyserver.com) sonlandırır ve Let's Encrypt sertifikasını otomatik alıp yeniler. `.env`'de `TRUST_PROXY=1` ayarlanır. Örnek `Caddyfile`:
   ```
   api.alanadiniz.com {
       reverse_proxy localhost:3000
   }
   ```
2. **Doğrudan TLS:** `TLS_CERT_PATH` ve `TLS_KEY_PATH` verilirse Node sunucusu HTTPS olarak çalışır (sertifika yenilemesini sizin yapmanız gerekir).

Mobil uygulamanın **canlı (release) sürümü**, `EXPO_PUBLIC_API_URL` tanımlı değilse veya `https://` ile başlamıyorsa açılışta hata verir. Geliştirmede (Expo Go) bu kontrol devre dışıdır.

### 🧪 Testler
Mobil (`mobile_app`): `npm test` — kimlik kuralları, teşhis durumu ve ApiClient token yenileme testleri.

`backend` klasöründe:
```bash
npm test                  # Birim testleri (veritabanı gerekmez)
npm run test:integration  # Gerçek PostgreSQL ile repository/migration testleri (geçici test veritabanı açıp siler)
npm run test:python       # Python AI pipeline testleri (.env'deki PYTHON_PATH venv'i ile; pytest kurulu olmalı)
```

### 🗄️ Veritabanı Migration'ları
Şema değişiklikleri `backend/src/database/migrations/` klasöründeki numaralı SQL dosyalarıyla yönetilir ve sunucu açılışında otomatik uygulanır (uygulananlar `schema_migrations` tablosunda tutulur, hiçbir zaman otomatik tablo silinmez).
```bash
npm run migrate:status   # Hangi migration'lar uygulandı
npm run migrate          # Bekleyenleri sunucuyu başlatmadan uygula
npm run cleanup:images   # Kayda bağlı olmayan eski teşhis görsellerini listele (silmek için: -- --apply)
```
Yeni bir şema değişikliği için bir sonraki numarayla yeni dosya ekleyin (ör. `002_add_plant_notes.sql`); **uygulanmış dosyaları değiştirmeyin**. Bitki/hastalık kataloğu (`src/domain/PlantCatalog.js`) her açılışta veritabanıyla senkronize edilir; tedavi metinlerini orada güncellemeniz yeterlidir.

> `JWT_SECRET` tanımlı değilse sunucu geliştirme ortamında geçici bir anahtar üretir; bu durumda sunucu her yeniden başladığında tüm oturumlar düşer. Canlı ortamda (`NODE_ENV=production`) tanımlı değilse sunucu başlamaz.

### 🔐 Oturum (JWT) Sistemi
Giriş, kayıt ve misafir girişi `accessToken` (1 saat) ve `refreshToken` (30 gün) döndürür. Teşhis, geçmiş ve görsel uç noktaları `Authorization: Bearer <accessToken>` header'ı ister; kullanıcı kimliği artık `?uuid=` veya `X-User-UUID` ile **gönderilmez**, token'dan alınır. Teşhis görselleri herkese açık `/uploads` klasöründen değil, yalnızca sahibine açık `GET /api/images/:dosya` uç noktasından servis edilir. Mobil uygulama bunları `src/services/ApiClient.js` üzerinden otomatik yönetir (süresi dolan token'ı kendisi yeniler).

---

## 📱 3. Mobile App (Mobil Uygulama) Kurulumu

### 📦 Paket Kurulumu
`mobile_app` klasörüne gidin ve tüm bağımlılıkları yükleyin:

```bash
cd mobile_app
npm install
```
*Kritik paketler:* `expo-constants`, `expo-camera`, `expo-image-manipulator`, `expo-video`, `expo-location`, `expo-navigation-bar`.

> ⚠️ **Expo SDK 58:** Proje Expo SDK 58'e (React Native 0.88) yükseltildi. Telefonunuzdaki **Expo Go uygulamasının da SDK 58 sürümü** olmalıdır. Eski `expo-av` paketi kaldırıldı; hava durumu videoları artık `expo-video` ile oynatılıyor. Branch'i çektikten sonra `mobile_app` içinde mutlaka `npm install` çalıştırın.

### 🌐 Backend Adresi (Otomatik — IP Yazmaya Gerek Yok)
Artık kimsenin `config.js` içine kendi IP adresini yazmasına gerek yoktur. `mobile_app/src/config.js` backend adresini **otomatik** bulur: Expo Go uygulamayı hangi bilgisayardaki Metro sunucusundan yüklediyse, backend'e de aynı bilgisayarın IP'si üzerinden (port `3000`) bağlanır. Telefon ve bilgisayarın aynı ağda olması yeterlidir.

Farklı bir backend'e (ör. canlı sunucu) bağlanmak isterseniz `mobile_app/.env.local` dosyası oluşturun (git'e girmez):
```env
EXPO_PUBLIC_API_URL=https://sunucu-adresi.com
```
`.env.local` değiştikten sonra Expo'yu yeniden başlatın.

> ⚠️ `npx expo start --tunnel` ile çalışırken otomatik adres backend'e ulaşamaz; bu durumda `EXPO_PUBLIC_API_URL` tanımlanmalıdır.

Bilgisayarınızda Hamachi, VMware, WSL gibi birden fazla ağ adaptörü varsa Expo yanlış IP'yi seçebilir (telefon uygulamayı hiç yükleyemez). Bu durumda Expo'yu IP'yi sabitleyerek başlatın (PowerShell):
```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.1.X"; npx expo start --lan
```


---

## ⚙️ 4. Model Dosyalarının Konumu

Ana proje dizininde `ai_model/active_models/` klasörü altında şu dosyaların eksiksiz yer aldığından emin olun:
-   `yolo_leaf_best.pt` *(Katman 1 - Yaprak tespiti)*
-   `plant_mobilenetv3large_best.keras` *(Katman 2 - Bitki sınıflandırma)*
-   `class_names.txt` *(Desteklenen bitki sınıfları)*
-   `disease_models/` *(Katman 3 - Bitki türlerine özel `.keras` hastalık modelleri)*

---

## 🐞 5. Sık Karşılaşılan Hatalar ve Çözümleri

### ❌ `TypeError: fetch failed` (Mobile App / Metro Bundler)
Eski Node.js sürümlerindeki DNS çözümleme hatalarından kaynaklanır.
*   **Çözüm:** Projeyi **offline** (yerel geliştirme) modunda başlatın:
    ```bash
    npm start -- --offline
    # veya
    npx expo start --offline
    ```

### ❌ PostgreSQL Bağlantı Hatası (Sunucu Başlangıcı)
PostgreSQL servisi kapalıysa konsolda bağlantı denemeleri loglanır.
*   **Çözüm:** Teşhis geçmişini kullanmak istiyorsanız yerel PostgreSQL servisinizin çalıştığından emin olun. PostgreSQL kurulu değilse Docker ile çalıştırabilirsiniz:
    ```bash
    docker run -d --name verdant-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 --restart unless-stopped postgres:16-alpine
    # Sonraki açılışlarda: docker start verdant-postgres
    ```
    Kayıt/giriş işlemleri veritabanı gerektirir. Sadece anlık AI teşhisi yapmak istiyorsanız sunucu otomatik olarak **Çevrimdışı Mod**'da başlayacaktır, geliştirmeye devam edebilirsiniz.
