# VerdantAI — Mobil Uygulama

Bitki yaprağı fotoğrafından bitki türünü ve hastalığı tespit edip tedavi önerisi sunan React Native (Expo SDK 58) uygulaması. Yapay zeka analizi `backend/` sunucusunda yapılır.

## Çalıştırma

```bash
npm install
npx expo start --lan
```

Telefonda **Expo Go (SDK 58)** ile QR kodu okutun. Telefon ve bilgisayar aynı ağda olmalı; backend adresi otomatik bulunur (bkz. `src/config.js`). Birden fazla ağ adaptörü olan bilgisayarlarda IP'yi sabitlemek için:

```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.1.X"; npx expo start --lan
```

Kurulumun tamamı (backend, veritabanı, ortam değişkenleri) için kök dizindeki `GUNCELLEME_REHBERI.md` dosyasına bakın.

## Klasör Yapısı

```text
src/
├── components/   Tekrar kullanılabilir arayüz bileşenleri (myplants/: ana sayfa bileşenleri)
├── context/      AuthContext (oturum yönetimi)
├── hooks/        useWeather, useCustomAlert, useSwipeModal
├── navigation/   Alt sekme menüsü (TabNavigator)
├── screens/      Ekranlar
├── services/     ApiClient (tüm backend istekleri), SessionStore (güvenli oturum deposu)
├── styles/       Ekran stilleri
├── theme/        Renk paleti ve tema (açık/koyu)
├── utils/        Kimlik bilgisi kuralları, teşhis durumu yardımcıları
└── config.js     Backend adresi
```

## Canlı Sürüm

Canlı (release) derlemede `EXPO_PUBLIC_API_URL` tanımlı olmalı ve `https://` ile başlamalıdır (ör. `.env.local` içinde `EXPO_PUBLIC_API_URL=https://api.alanadiniz.com`).
