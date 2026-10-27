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
- [x] **11. HTTP kullanılıyor** — `backend/src/middlewares/requireHttps.js`, `mobile_app/src/config.js`
  - ✅ Çözüldü: Canlıda (`NODE_ENV=production`) şifrelenmemiş istekler 403 ile reddedilir (`/api/health` hariç); ters proxy arkasında `X-Forwarded-Proto` tanınır (`TRUST_PROXY`). `TLS_CERT_PATH`/`TLS_KEY_PATH` verilirse sunucu doğrudan HTTPS çalışır. HSTS açık. Mobilin canlı sürümü `https://` olmayan API adresiyle açılmayı reddeder. Proxy ve doğrudan TLS senaryoları test edildi.
  - Kalan: Canlıya çıkarken alan adı + sertifika (önerilen: Caddy ile otomatik Let's Encrypt — rehberde örnek var).
- [x] **12. DB bağlantı bayrağı takılı kalıyor** — `backend/src/config/db.js`
  - Bağlantı bir kez koparsa endpoint'ler başka bir sorgu başarılı olana kadar `offline` kalıyordu.
  - ✅ Çözüldü: `Database.ensureConnected()` bağlantı kopuksa önce yeniden bağlanmayı dener. DB durdurulup açılarak test edildi; sunucu yeniden başlatılmadan toparlanıyor.
- [x] **13. Riskli migration** — `backend/src/database/Migrator.js`
  - `users` tablosu yoksa diğer tablolar `DROP` ediliyordu.
  - ✅ Çözüldü: Numaralı SQL migration dosyaları (`src/database/migrations/`), uygulananlar `schema_migrations` tablosunda (checksum ile), her migration kendi transaction'ında, eşzamanlı çalıştırmaya karşı advisory lock. Otomatik `DROP` tamamen kaldırıldı. `npm run migrate` / `npm run migrate:status`. Mevcut veritabanında şema farkı olmadan uygulandığı ve sıfırdan kurulumda çalıştığı doğrulandı. Veritabanı yoksa oluşturma yalnızca "veritabanı yok" hatasında deneniyor (yönetilen PostgreSQL uyumlu).
- [x] **14. Seed verisi güncellenmiyor** — `backend/src/database/CatalogSeeder.js`
  - ✅ Çözüldü: Katalog her açılışta tek transaction içinde `INSERT ... ON CONFLICT DO UPDATE` ile senkronize ediliyor; yalnızca değişen kayıtlar güncellenir. Katalogdan çıkarılan kayıtlar teşhislere bağlı olduğu için silinmez.
- [x] **15. Hastalık katmanında güven eşiği yok** — `backend/src/services/predict_pipeline.py`
  - ✅ Çözüldü: Hastalık güveni %60'ın altındaysa sonuç `belirsiz` döner — kesin teşhis ve ilaç önerisi verilmez, kullanıcı daha net fotoğraf çekmeye ve gerekirse ziraat mühendisine yönlendirilir; olası sonuçlar "kesin değil" notuyla listelenir. %60–70 arası teşhis edilir ama "düşük güven" uyarısı gösterilir.
  - Düzeltilen hata: Geçmiş ekranları kesin teşhisi olmayan kayıtları (belirsiz / model yok / hata) "Hastalık Tespit Edildi" olarak gösteriyordu; API de bu durumlarda `diseaseDisplayName: "Sağlıklı"` döndürüyordu.
  - Not: %60 eşiği gerçek fotoğraflarla ayarlanmalı (bitki türüne göre farklı eşik gerekebilir) — `DiseaseClassifier.MIN_CONFIDENCE`.

## 🟡 Orta — Kod Kalitesi ve Bakım

- [ ] **16. Mimari plan ile gerçek kod uyuşmuyor** — Plan "cihaz üzerinde TFLite, çevrimdışı (Edge AI)" diyordu; şu an teşhis tamamen sunucuda yapılıyor ve internetsiz çalışmıyor. Karar verilmeli: plan güncellensin ya da edge AI'a geçilsin.
- [x] **17. Ölü kod ve dosyalar**
  - ✅ Silindi: `backend/src/services/predict.py` (eski pipeline), `backend/src/model/` ve `ai_model/egitilmis_model/` (eski `.tflite`), `plant_mobilenetv3large_best.h5` (`.keras` kopyası), Expo şablonundan kalan `mobile_app/components/`, `hooks/`, `constants/`, `scripts/reset-project.js`, `src/screens/HomeScreen.js`, `tailwind.config.js` ve kullanılmayan React logoları.
  - ✅ Kaldırılan paketler: `expo-router`, `nativewind`, `tailwindcss`, `expo-haptics`, `expo-symbols`, `expo-web-browser`, `expo-image`, `expo-linking`, `@react-navigation/elements`. `expo-router`a bağlı `typedRoutes` ayarı kaldırıldı, web çıktısı `single` yapıldı. Şablon README projeye özel README ile değiştirildi.
  - Kalan: `react-native-reanimated` / `react-native-worklets` uygulamada kullanılmıyor ama babel ayarına bağlı; kaldırılırsa `babel.config.js` de güncellenmeli.
- [x] **18. Git'te olmaması gereken dosyalar**
  - ✅ Takipten çıkarıldı ve `.gitignore`'a eklendi: `backend/logs/app.log`, `.idea/` ve herkese açık repoya commit'lenmiş kullanıcı fotoğrafları (`backend/uploads/`, `backend/debug_*.jpg`). Fotoğraflarda EXIF/konum bilgisi, logda e-posta/şifre/token olmadığı doğrulandı; bu yüzden geçmiş yeniden yazılmadı. Kök `.gitignore` eklendi (IDE, OS, Python, `.env`, sertifikalar).
  - Karar: Model dosyaları (~257 MB) şimdilik git'te kalıyor (dosyalar 100 MB sınırının altında). **Modeller yeniden eğitilip güncellenecekse önce Git LFS'e geçilmeli**; aksi halde her yeni sürüm repoya ~257 MB ekler.
- [x] **19. Backend adresi koda gömülü** — `mobile_app/src/config.js`
  - IP her değiştiğinde dosya düzenlenip commit'leniyor; ekipte herkes birbirinin IP'sini eziyor.
  - ✅ Çözüldü: Adres artık otomatik — önce `EXPO_PUBLIC_API_URL`, yoksa Metro'nun çalıştığı bilgisayarın IP'si (`Constants.expoConfig.hostUri`), o da yoksa emülatör varsayılanı.
- [ ] **20. Test kapsamı** *(büyük ölçüde)* — ✅ Backend: 48 birim testi (`npm test`), gerçek PostgreSQL ile 8 entegrasyon testi (`npm run test:integration`: migration/katalog idempotency, büyük/küçük harf duyarsız e-posta, kullanıcılar arası kayıt/görsel izolasyonu, refresh token iptali ve cascade, süresi dolmuş token temizliği), Python pipeline için 11 pytest testi (`npm run test:python`: güven eşikleri, yaprak kırpma hesabı, model yok/hata durumları). Kalan: `AiDaemonClient` (süreç yönetimi) testleri ve mobil testler (jest-expo kurulumu gerekir).
- [x] **21. Lint hataları** — ✅ 24 → 0 sorun. Son adımda: `useSwipeModal` render sırasında ref okumuyor (`useState` başlatıcıları) ve gerçek bir hatası düzeltildi — PanResponder ilk render'daki `onClose`'u yakalıyordu, `onClose` değişirse kaydırarak kapatma eski fonksiyonu çağırıyordu; artık her zaman günceli çağrılıyor. `ThemeContext`, `LoginScreen` ve `DiagnosisDetailModal`'daki "effect içinde setState" kalıbı render sırasında önceki değerle karşılaştırmaya çevrildi (aynı davranış, ekstra render yok). Tek `eslint-disable` (`react-hooks/refs`) gerekçesiyle `useSwipeModal`'da: analiz aracının yanlış alarmı.
- [ ] **22. Deprecated `SafeAreaView`** — 6 ekran `react-native`'in `SafeAreaView`'ini kullanıyor (ileride kaldırılacak); `react-native-safe-area-context`'e geçilmeli.
- [x] **23. Bağımlılık açıkları** — ✅ `npm audit fix` (uyumlu sürümler, `--force` yok): backend 9 → 0 (kritik `proxy-addr` IP sahteciliği ve `multer` DoS dahil), mobil 14 → 3. Kalan 3 açık `zod` kaynaklı ve yalnızca geliştirme araçlarında (`@expo/cli`, `eslint-plugin-react-hooks`) kullanılıyor, uygulama bundle'ına girmiyor; npm'in önerdiği "düzeltme" Expo SDK 54'e geri dönmek olduğu için uygulanmadı — Expo yeni sürüm çıkardığında `npx expo install --fix` ile kapanır.
- [ ] **24. Tasarım kuralına aykırı sabit renkler** — Bazı stillerde `'#888'`, `'#1C1C1E'`, `'#1A1A1A'` gibi sabit hex renkler var; `src/theme/colors.js`'ten beslenmeli.

## 🔵 Ürün ve Kullanıcı Deneyimi

- [x] **25. Eskimiş etiket** — ✅ Kamera ekranındaki gri "Hastalık (Yakında)" adımı, diğer adımlarla aynı görünümde "Hastalığı Bul" yapıldı.
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
