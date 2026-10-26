# 📋 VerdantAI — Yapılacaklar Listesi

Projede tespit edilen güvenlik açıkları, eksiklikler ve geliştirme ihtiyaçları. Öncelik sırasına göre dizilmiştir; bir madde tamamlandığında `[ ]` → `[x]` yapılıp kısa bir not düşülmelidir.

**Önerilen sıra:** Önce 🔴 Kritik (1–6), ardından gerçek oturum sistemi (2) ile rate limit ve şifre kuralları (7–8), sonra repo temizliği ve yapılandırma (17–19).

---

## 🔴 Kritik — Güvenlik Açıkları

- [x] **1. Şifresiz hesap ele geçirme** — `backend/src/services/AuthService.js`
  - `POST /api/auth/guest` gelen UUID'nin misafire ait olup olmadığını kontrol etmiyordu; kayıtlı bir kullanıcının UUID'si gönderilirse o kullanıcı olarak **şifresiz giriş** yapılıyordu.
  - `POST /api/auth/upgrade` aynı şekilde kayıtlı kullanıcıları da "yükseltiyordu"; UUID ile yeni e-posta/şifre gönderilerek **hesap çalınabiliyordu**.
  - ✅ Çözüldü: Kayıtlı UUID ile misafir girişi 403, yükseltme 404 döner (birim testi + canlı test ile doğrulandı). Mobil uygulama yükseltmeden sonra misafir cihaz kimliğini sıfırlıyor.
- [x] **2. Gerçek oturum (authentication) sistemi yok**
  - Kullanıcı sadece `x-user-uuid` header'ı / `?uuid=` parametresiyle tanınıyordu; UUID'yi bilen herkes başkasının geçmişini okuyabiliyordu.
  - ✅ Çözüldü: JWT access token (1 saat) + opak refresh token (30 gün, DB'de SHA-256 hash'i, her kullanımda yenisiyle değiştirilir). Kullanılmış bir refresh token tekrar gelirse çalıntı kabul edilip kullanıcının tüm oturumları kapatılır. Korumalı uç noktalar `middlewares/authenticate.js` ile doğrulanır; kimlik yalnızca token'dan alınır. Çıkış yapınca refresh token sunucuda iptal edilir. Mobil `ApiClient` süresi dolan token'ı otomatik yeniler (eşzamanlı isteklerde tek yenileme). Misafir cihaz kimliği artık `expo-crypto` ile kriptografik rastgele üretiliyor.
- [x] **3. Herkes her teşhis kaydını silebiliyor** — `DELETE /api/history/:id`
  - Sahiplik kontrolü yoktu; ID'ler sıralı (SERIAL) olduğu için döngüyle tüm kayıtlar silinebiliyordu.
  - ✅ Çözüldü: Silme yalnızca token sahibinin kaydını siler (`DiagnosisRepository.deleteForUser`); başka kullanıcının kaydı için 404 döner.
- [x] **4. Yüklenen fotoğraflar herkese açık**
  - `/uploads` kimlik doğrulamasız statik olarak servis ediliyordu; dosya adları tahmin edilebilirdi.
  - ✅ Çözüldü: Statik `/uploads` kaldırıldı. Görseller `GET /api/images/:dosya` ile yalnızca sahibine servis edilir (başkasına 404, tokensız 401). Dosya adları rastgele; path traversal engellendi.
- [x] **5. DEBUG kodu açık kalmış**
  - Her teşhis isteğinde ham fotoğraf `debug_*.jpg` olarak `uploads/` klasörüne yazılıyordu.
  - ✅ Kod kaldırıldı. Not: Daha önce oluşmuş `backend/uploads/debug_*.jpg`, `backend/debug_crop.jpg` ve `backend/debug_model_input.jpg` dosyaları yerelde duruyor (git'te değiller), elle silinebilir.
- [x] **6. Şifre telefonda düz metin saklanıyor** — `mobile_app/src/services/SessionStore.js`
  - "Beni hatırla" seçildiğinde şifre AsyncStorage'a açık olarak (`savedPassword`) yazılıyordu.
  - ✅ Çözüldü: Şifre artık hiç saklanmıyor. "Beni hatırla" açıksa sunucuda iptal edilebilen refresh token `expo-secure-store` ile şifreli depoda (Android Keystore / iOS Keychain) tutulur ve uygulama açılışında oturum otomatik geri yüklenir; giriş formu için yalnızca e-posta hatırlanır. Eski sürümlerin bıraktığı `savedPassword` ilk açılışta cihazdan silinir.
  - Kalan küçük iyileştirme: Misafir cihaz kimliği (`guestDeviceUuid`) hâlâ AsyncStorage'da; misafir oturumu açabildiği için `SecureStore`'a taşınabilir.

## 🟠 Yüksek — Sağlamlık ve Güvenlik Eksikleri

- [x] **7. Rate limit yok** — `backend/src/middlewares/rateLimiters.js`
  - ✅ Çözüldü (`express-rate-limit`): genel API 300 istek / 15 dk (IP); başarısız giriş 10 deneme / 15 dk (IP + e-posta, başarılı girişler sayılmaz); diğer oturum işlemleri 30 / 15 dk (IP); AI teşhisi 10 / dk (kullanıcı). Aşılınca 429 + `Retry-After`. Proxy arkasında `TRUST_PROXY` ayarlanmalı.
  - Not: Sayaçlar bellekte; birden fazla sunucu süreci çalıştırılırsa Redis gibi ortak bir depoya taşınmalı.
- [x] **8. Şifre ve e-posta kuralları yok** — `backend/src/domain/CredentialPolicy.js`, `mobile_app/src/utils/credentialRules.js`
  - ✅ Çözüldü: şifre 8–72 karakter, en az bir harf ve bir rakam; geçerli e-posta formatı (uzun uzantılar dahil, ör. `.online`); isim 2–50 karakter. E-posta kayıt/girişte küçük harfe çevrilip kırpılıyor, aramalar büyük/küçük harf duyarsız. Kurallar kayıt ve hesap yükseltmede uygulanır; girişte uygulanmaz (eski hesaplar girebilsin).
  - Düzeltilen hata: mobildeki e-posta regex'i 4+ harfli uzantıları (`.info`, `.online`) reddediyordu.
- [x] **9. Güvenlik header'ları yok** — `backend/src/index.js`
  - ✅ Çözüldü: `helmet` (CSP, HSTS, nosniff, X-Frame-Options, `X-Powered-By` gizli). CORS yalnızca `CORS_ORIGINS` listesine (tanımlı değilse localhost'a) açık; mobil uygulama Origin göndermediği için etkilenmez. JSON gövde limiti 15 MB'tan 100 KB'a indirildi (aşılırsa 413).
- [x] **10. Hata mesajları sızıyor** — ✅ Çözüldü: `AppError` hiyerarşisi + `middlewares/errorHandler.js`. Beklenen hatalar kendi mesajıyla, beklenmeyenler genel "Beklenmeyen bir sunucu hatası oluştu." mesajıyla döner; `detay` alanı kaldırıldı.
- [ ] **11. HTTP kullanılıyor** — Şifreler ağda şifrelenmeden gidiyor; canlıya çıkmadan HTTPS şart.
- [x] **12. DB bağlantı bayrağı takılı kalıyor** — `backend/src/config/db.js`
  - Bağlantı bir kez koparsa endpoint'ler başka bir sorgu başarılı olana kadar `offline` kalıyordu.
  - ✅ Çözüldü: `Database.ensureConnected()` bağlantı kopuksa önce yeniden bağlanmayı dener. DB durdurulup açılarak test edildi; sunucu yeniden başlatılmadan toparlanıyor.
- [ ] **13. Riskli migration** — `backend/src/config/DatabaseInitializer.js`
  - `users` tablosu yoksa diğer tablolar `DROP` ediliyor. Gerçek bir migration aracına geçilmeli (`node-pg-migrate` vb.).
- [ ] **14. Seed verisi güncellenmiyor** — Seed yalnızca tablo boşken çalışıyor; yeni hastalık/tedavi metinleri mevcut veritabanlarına ulaşmıyor. `INSERT ... ON CONFLICT DO UPDATE` ile idempotent hale getirilmeli.
- [ ] **15. Hastalık katmanında güven eşiği yok** — `backend/src/services/predict_pipeline.py`
  - Bitki türünde %50 eşiği var; hastalık modeli düşük güvenle bile kesin teşhis döndürüyor → yanlış ilaç önerisi riski. Eşik altı sonuçlar "Emin değiliz, daha net bir fotoğraf çekin" olarak dönmeli.

## 🟡 Orta — Kod Kalitesi ve Bakım

- [ ] **16. Mimari plan ile gerçek kod uyuşmuyor** — Plan "cihaz üzerinde TFLite, çevrimdışı (Edge AI)" diyordu; şu an teşhis tamamen sunucuda yapılıyor ve internetsiz çalışmıyor. Karar verilmeli: plan güncellensin ya da edge AI'a geçilsin.
- [ ] **17. Ölü kod ve dosyalar**
  - `backend/src/services/predict.py` (eski tek katmanlı pipeline)
  - `backend/src/model/` ve `ai_model/egitilmis_model/` (eski `.tflite` model)
  - `ai_model/active_models/plant_mobilenetv3large_best.h5` (`.keras` kopyası)
  - Expo şablonundan kalanlar: `mobile_app/components/`, `mobile_app/hooks/`, `mobile_app/constants/`, `scripts/reset-project.js`, `src/screens/HomeScreen.js` (kullanılmıyor)
  - Kullanılmayan paketler: `expo-router`, `nativewind`, `tailwindcss`
- [ ] **18. Git'te olmaması gereken dosyalar**
  - `backend/logs/app.log` (takipten çıkarılıp `.gitignore`'a eklenmeli)
  - `.idea/` (IDE ayarları)
  - Yüzlerce MB'lık model dosyaları → Git LFS'e taşınmalı
- [x] **19. Backend adresi koda gömülü** — `mobile_app/src/config.js`
  - IP her değiştiğinde dosya düzenlenip commit'leniyor; ekipte herkes birbirinin IP'sini eziyor.
  - ✅ Çözüldü: Adres artık otomatik — önce `EXPO_PUBLIC_API_URL`, yoksa Metro'nun çalıştığı bilgisayarın IP'si (`Constants.expoConfig.hostUri`), o da yoksa emülatör varsayılanı.
- [ ] **20. Test kapsamı düşük** *(kısmen)* — ✅ 47 birim testi var (`DiagnosisService`, `AuthService`, `TokenService`, `authenticate`, `CredentialPolicy`, `errorHandler`). Kalan: repository'ler için entegrasyon testi (gerçek PostgreSQL), `AiDaemonClient` ve Python pipeline (`pytest`) testleri, mobil testler.
- [ ] **21. Lint hataları** *(kısmen)* — ✅ 24 → 12 sorun. Kalanlar (hepsi refactor öncesinden):
  - `useSwipeModal.js`: render sırasında ref okuma (8 hata) — `Animated` değerlerinin state'e/`useMemo`'ya taşınması gerekiyor
  - `ThemeContext.js`, `LoginScreen.js`, `DiagnosisDetailModal.js`: effect içinde senkron `setState`
  - `HomeScreen.js`: kullanılmayan `Image` (ekranın kendisi de kullanılmıyor, bkz. 17)
- [ ] **22. Deprecated `SafeAreaView`** — 6 ekran `react-native`'in `SafeAreaView`'ini kullanıyor (ileride kaldırılacak); `react-native-safe-area-context`'e geçilmeli.
- [ ] **23. Bağımlılık açıkları** — `npm audit` mobil tarafta 16 açık gösteriyor (1 kritik, 9 yüksek).
- [ ] **24. Tasarım kuralına aykırı sabit renkler** — Bazı stillerde `'#888'`, `'#1C1C1E'`, `'#1A1A1A'` gibi sabit hex renkler var; `src/theme/colors.js`'ten beslenmeli.

## 🔵 Ürün ve Kullanıcı Deneyimi

- [ ] **25. Eskimiş etiket** — Kamera ekranında "Hastalık (Yakında)" yazıyor, oysa hastalık tespiti çalışıyor.
- [ ] **26. Boş ekranlar** — Topluluk (Stats) sekmesi, Akıllı Sulama ve iki karusel kartı "Yakında" durumunda.
- [ ] **27. Çevrimdışı mod yok** — Planlanan yerel DB (SQLite/MMKV) ve senkronizasyon yapılmadı.
- [ ] **28. Şifre sıfırlama ve e-posta doğrulama yok** — "Şifremi unuttum" akışı eksik.
- [ ] **29. Tedavi önerileri sabit ve genel** — Dozaj, etken madde ve bölgeye göre öneri yok; planlanan "karar motoru" yapılmadı.
- [ ] **30. Yetim görsel dosyalar** — Kullanıcı silindiğinde teşhis kayıtları cascade ile siliniyor ama diskteki fotoğrafları kalıyor.

---

## ✅ Tamamlananlar

- [x] **Expo SDK 54 → 58 yükseltmesi** (React Native 0.88, React 19.3) — Expo Go'nun güncel sürümüyle uyum.
- [x] **`expo-av` → `expo-video` geçişi** — Hava durumu arka plan videosu `WeatherBackgroundVideo` bileşenine taşındı.
- [x] **Android navigasyon çubuğu** — Uygulama açıkken gizleniyor; tab bar güvenli alan payını hesaba katıyor.
- [x] **Konum izni** — Sistem penceresinden önce uygulama temasında, Türkçe açıklama penceresi gösteriliyor.
- [x] **Kamera izin ekranı yeniden tasarlandı** — Temaya uygun tasarım, "Galeriden Fotoğraf Seç" alternatifi; çalışmayan "Ayarlara Git" butonu ve ayarlardan dönüşte izin durumunun yenilenmemesi hataları düzeltildi.
- [x] **AI araç kalıntıları temizlendi** — `.agent/`, `graphify-out/`, `docs/superpowers/`, `.idea/studiobot.xml` kaldırıldı.
- [x] **Kurulum rehberi güncellendi** — `GUNCELLEME_REHBERI.md`'ye SDK 58, Docker ile PostgreSQL ve Expo IP sabitleme notları eklendi.
- [x] **OOP refactor (backend)** — Repository / Service / Controller katmanları, constructor ile bağımlılık enjeksiyonu (`container.js`), kapsüllenmiş `Database`, `AiDaemonClient`, `PlantCatalog` (tekrarlanan veri tek kaynakta), `AppError` hiyerarşisi. Python pipeline sınıf hiyerarşisine taşındı (`LeafDetector`, `KerasClassifier` → `PlantClassifier` / `DiseaseClassifier`, `PlantDiagnosisPipeline`, `InferenceServer`).
  - Düzeltilen hatalar: daemon yeniden başlatılırken eski sürecin yeni süreci "öldürmesi" ve eşzamanlı isteklerde birden fazla daemon başlatılması; bitki güveni düşükken "Emin Değilim" uyarısının hiç çıkmaması; çevrimdışı modda tedavi önerisi verilememesi.
- [x] **OOP refactor (mobil)** — Tüm backend istekleri `services/ApiClient.js` sınıfında; 4 ekranda kopyalanmış alert state'i `useCustomAlert` hook'unda; 10 dosyada tekrarlanan tema renk hesabı `ThemeContext`'te; `AuthContext` tekrarlanan akışlarda tek `authenticate` yardımcısı kullanıyor.
