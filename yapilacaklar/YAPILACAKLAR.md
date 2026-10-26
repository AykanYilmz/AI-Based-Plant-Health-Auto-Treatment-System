# 📋 VerdantAI — Yapılacaklar Listesi

Projede tespit edilen güvenlik açıkları, eksiklikler ve geliştirme ihtiyaçları. Öncelik sırasına göre dizilmiştir; bir madde tamamlandığında `[ ]` → `[x]` yapılıp kısa bir not düşülmelidir.

**Önerilen sıra:** Önce 🔴 Kritik (1–6), ardından gerçek oturum sistemi (2) ile rate limit ve şifre kuralları (7–8), sonra repo temizliği ve yapılandırma (17–19).

---

## 🔴 Kritik — Güvenlik Açıkları

- [ ] **1. Şifresiz hesap ele geçirme** — `backend/src/controllers/authController.js`
  - `POST /api/auth/guest` gelen UUID'nin misafire ait olup olmadığını kontrol etmiyor; kayıtlı bir kullanıcının UUID'si gönderilirse o kullanıcı olarak **şifresiz giriş** yapılıyor.
  - `POST /api/auth/upgrade` aynı şekilde kayıtlı kullanıcıları da "yükseltiyor"; UUID ile yeni e-posta/şifre gönderilerek **hesap çalınabiliyor**.
  - Çözüm: Her iki sorguya `user_type = 'guest'` şartı eklenmeli.
- [ ] **2. Gerçek oturum (authentication) sistemi yok**
  - Kullanıcı sadece `x-user-uuid` header'ı / `?uuid=` parametresiyle tanınıyor; UUID URL'de gidip loglara düşüyor.
  - `GET /api/history?uuid=...` ile UUID'yi bilen herkes başkasının teşhis geçmişini okuyabiliyor.
  - Çözüm: Giriş sonrası JWT (access + refresh token) üretilmeli, tüm korumalı endpoint'ler middleware ile doğrulanmalı.
- [ ] **3. Herkes her teşhis kaydını silebiliyor** — `DELETE /api/history/:id`
  - Sahiplik kontrolü yok; ID'ler sıralı (SERIAL) olduğu için döngüyle tüm kayıtlar silinebilir.
  - Çözüm: Silme sorgusuna `AND user_id = <oturumdaki kullanıcı>` şartı eklenmeli.
- [ ] **4. Yüklenen fotoğraflar herkese açık**
  - `/uploads` kimlik doğrulamasız statik olarak servis ediliyor; dosya adları zaman damgası (`img_<timestamp>_...jpg`), yani tahmin edilebilir.
  - Çözüm: Rastgele dosya adları (UUID) + oturum kontrolü olan bir görsel endpoint'i.
- [ ] **5. DEBUG kodu açık kalmış** — `backend/src/controllers/diagnoseController.js` (~25. satır)
  - Her teşhis isteğinde ham fotoğraf `debug_*.jpg` olarak `uploads/` klasörüne yazılıyor ve hiç silinmiyor (disk dolar + fotoğraflar herkese açık).
  - Ayrıca `backend/debug_crop.jpg` ve `backend/debug_model_input.jpg` dosyaları duruyor.
- [ ] **6. Şifre telefonda düz metin saklanıyor** — `mobile_app/src/context/AuthContext.js`
  - "Beni hatırla" seçildiğinde şifre AsyncStorage'a açık olarak (`savedPassword`) yazılıyor.
  - Çözüm: Şifre değil token saklanmalı; gerekiyorsa `expo-secure-store` kullanılmalı.

## 🟠 Yüksek — Sağlamlık ve Güvenlik Eksikleri

- [ ] **7. Rate limit yok** — Login'e brute-force yapılabilir; `/api/diagnose` pahalı bir AI işlemi olduğu için DoS'a açık. (`express-rate-limit`)
- [ ] **8. Şifre ve e-posta kuralları yok**
  - Kayıtta 1 karakterlik şifre bile kabul ediliyor; e-posta formatı doğrulanmıyor.
  - E-posta büyük/küçük harfe duyarlı (`Ali@x.com` ≠ `ali@x.com`) — kayıt ve girişte `toLowerCase().trim()` uygulanmalı.
- [ ] **9. Güvenlik header'ları yok** — CORS tüm origin'lere açık, `helmet` kullanılmıyor.
- [ ] **10. Hata mesajları sızıyor** — Global hata yakalayıcı `err.message`'ı istemciye olduğu gibi gönderiyor; canlıda genel bir mesaj dönülmeli.
- [ ] **11. HTTP kullanılıyor** — Şifreler ağda şifrelenmeden gidiyor; canlıya çıkmadan HTTPS şart.
- [ ] **12. DB bağlantı bayrağı takılı kalıyor** — `backend/src/config/db.js`
  - Bağlantı bir kez koparsa `isDbConnected = false` oluyor; teşhis/geçmiş endpoint'leri DB'yi hiç denemediği için başka bir sorgu başarılı olana kadar `offline` kalıyor.
  - Çözüm: Periyodik `checkConnection()` veya bayrak yerine sorguyu deneyip hatayı yakalamak.
- [ ] **13. Riskli migration** — `backend/src/config/dbInit.js`
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
- [ ] **19. Backend adresi koda gömülü** — `mobile_app/src/config.js`
  - IP her değiştiğinde dosya düzenlenip commit'leniyor; ekipte herkes birbirinin IP'sini eziyor.
  - Çözüm: `EXPO_PUBLIC_API_URL` ortam değişkeni (`.env`) veya `app.config.js` ile okunmalı.
- [ ] **20. Test kapsamı çok düşük** — Sadece 4 birim testi var (`diagnoseController.test.js`, hepsi geçiyor). Auth, diagnose akışı ve Python pipeline için test yok.
- [ ] **21. Lint hataları**
  - `MyPlantsScreen.js`: React Compiler hatası (`useCallback` bağımlılığı `user?.uuid`)
  - `CameraScreen.js`: kullanılmayan `Image` import'u
  - `TabNavigator.js`: kullanılmayan `CameraScreen` import'u
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
