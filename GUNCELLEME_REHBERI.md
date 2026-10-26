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
```

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

### 🌐 IP Adresi Güncelleme (Manuel Yöntem)
Fiziksel cihazda (Expo Go) test yaparken mobil uygulamanın bilgisayarınızda çalışan backend sunucusuna bağlanabilmesi için bilgisayarınızın yerel WiFi IP adresini elle tanımlamanız gerekmektedir. 

`mobile_app/src/config.js` dosyasında şu yapı kullanılmaktadır:
```javascript
// Backend API URL (Fiziksel cihaz için bilgisayarın yerel WiFi IP adresi)
// Bilgisayarınızın IP adresi her değiştiğinde sadece burayı güncellemeniz yeterlidir.
export const API_BASE = 'http://192.168.1.3:3000'; // Bilgisayarınızın yerel IP adresi
```
Bu sayede bilgisayarınızın IP adresi değiştiğinde sadece bu dosyadan güncelleyerek fiziksel cihazınızda testi sorunsuz bir şekilde sürdürebilirsiniz.

Bilgisayarınızda Hamachi, VMware, WSL gibi birden fazla ağ adaptörü varsa Expo yanlış IP'yi seçebilir. Bu durumda Expo'yu IP'yi sabitleyerek başlatın (PowerShell):
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
