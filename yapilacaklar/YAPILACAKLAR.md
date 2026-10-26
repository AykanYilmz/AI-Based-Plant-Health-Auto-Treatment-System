# 📋 VerdantAI — Yapılacaklar Listesi

Projede tespit edilen güvenlik açıkları, eksiklikler ve geliştirme ihtiyaçları. Öncelik sırasına göre dizilmiştir; bir madde tamamlandığında `[ ]` → `[x]` yapılıp kısa bir not düşülmelidir.

**Önerilen sıra:** Önce 🔴 Kritik (1–6), ardından gerçek oturum sistemi (2) ile rate limit ve şifre kuralları (7–8), sonra repo temizliği ve yapılandırma (17–19).

---

## 🔴 Kritik — Güvenlik Açıkları

- [x] **1. Şifresiz hesap ele geçirme** — `backend/src/services/AuthService.js`
  - `POST /api/auth/guest` gelen UUID'nin misafire ait olup olmadığını kontrol etmiyordu; kayıtlı bir kullanıcının UUID'si gönderilirse o kullanıcı olarak **şifresiz giriş** yapılıyordu.
  - `POST /api/auth/upgrade` aynı şekilde kayıtlı kullanıcıları da "yükseltiyordu"; UUID ile yeni e-posta/şifre gönderilerek **hesap çalınabiliyordu**.
  - ✅ Çözüldü: Kayıtlı UUID ile misafir girişi 403, yükseltme 404 döner (birim testi + canlı test ile doğrulandı). Mobil uygulama yükseltmeden sonra misafir cihaz kimliğini sıfırlıyor.
- [ ] **2. Gerçek oturum (authentication) sistemi yok**
  - Kullanıcı sadece `x-user-uuid` header'ı / `?uuid=` parametresiyle tanınıyor; UUID URL'de gidip loglara düşüyor.
  - `GET /api/history?uuid=...` ile UUID'yi bilen herkes başkasının teşhis geçmişini okuyabiliyor.
  - Çözüm: Giriş sonrası JWT (access + refresh token) üretilmeli, tüm korumalı endpoint'ler middleware ile doğrulanmalı.
- [x] **3. Herkes her teşhis kaydını silebiliyor** — `DELETE /api/history/:id`
  - Sahiplik kontrolü yoktu; ID'ler sıralı (SERIAL) olduğu için döngüyle tüm kayıtlar silinebiliyordu.
  - ✅ Çözüldü: Silme artık `X-User-UUID` header'ı zorunlu ve yalnızca o kullanıcının kaydını siler (`DiagnosisRepository.deleteForUser`). ⚠️ UUID gizli bir bilgi olmadığı için tam koruma 2. madde (JWT) ile sağlanacak.
- [ ] **4. Yüklenen fotoğraflar herkese açık** *(kısmen)*
  - `/uploads` kimlik doğrulamasız statik olarak servis ediliyor.
  - ✅ Dosya adları artık rastgele (`img_<zaman>_<12 hex>_<bitki>.jpg`), tahmin edilemez; path traversal engellendi.
  - Kalan: Oturum kontrolü olan bir görsel endpoint'i (2. maddeye bağlı).
- [x] **5. DEBUG kodu açık kalmış**
  - Her teşhis isteğinde ham fotoğraf `debug_*.jpg` olarak `uploads/` klasörüne yazılıyordu.
  - ✅ Kod kaldırıldı. Not: Daha önce oluşmuş `backend/uploads/debug_*.jpg`, `backend/debug_crop.jpg` ve `backend/debug_model_input.jpg` dosyaları yerelde duruyor (git'te değiller), elle silinebilir.
- [ ] **6. Şifre telefonda düz metin saklanıyor** — `mobile_app/src/context/AuthContext.js`
  - "Beni hatırla" seçildiğinde şifre AsyncStorage'a açık olarak (`savedPassword`) yazılıyor.
  - Çözüm: Şifre değil token saklanmalı; gerekiyorsa `expo-secure-store` kullanılmalı.

## 🟠 Yüksek — Sağlamlık ve Güvenlik Eksikleri

- [ ] **7. Rate limit yok** — Login'e brute-force yapılabilir; `/api/diagnose` pahalı bir AI işlemi olduğu için DoS'a açık. (`express-rate-limit`)
- [ ] **8. Şifre ve e-posta kuralları yok**
  - Kayıtta 1 karakterlik şifre bile kabul ediliyor; e-posta formatı doğrulanmıyor.
  - E-posta büyük/küçük harfe duyarlı (`Ali@x.com` ≠ `ali@x.com`) — kayıt ve girişte `toLowerCase().trim()` uygulanmalı.
- [ ] **9. Güvenlik header'ları yok** — CORS tüm origin'lere açık, `helmet` kullanılmıyor.
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
- [ ] **20. Test kapsamı düşük** *(kısmen)* — ✅ 17 birim testi var (`DiagnosisService`, `AuthService`, `errorHandler`). Kalan: repository'ler için entegrasyon testi (gerçek PostgreSQL), `AiDaemonClient` ve Python pipeline (`pytest`) testleri, mobil testler.
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
