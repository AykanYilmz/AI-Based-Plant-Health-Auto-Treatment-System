import Constants from 'expo-constants';
import { Platform } from 'react-native';

const BACKEND_PORT = 3000;

/**
 * Backend API adresini dinamik olarak belirler. Kimsenin IP adresini elle yazmasına gerek yoktur.
 *
 * 1. EXPO_PUBLIC_API_URL tanımlıysa o kullanılır (canlı sunucu veya özel durumlar için).
 *    Örnek: mobile_app/.env.local → EXPO_PUBLIC_API_URL=https://api.verdantai.com
 * 2. Geliştirmede (Expo Go), uygulamanın yüklendiği Metro sunucusunun IP adresi kullanılır.
 *    Backend aynı bilgisayarda çalıştığı için telefon Metro'ya hangi IP ile ulaştıysa backend'e de onunla ulaşır.
 * 3. Hiçbiri yoksa emülatör/simülatör varsayılanına düşülür.
 */
function resolveApiBase() {
    const envUrl = process.env.EXPO_PUBLIC_API_URL;
    if (envUrl) {
        return envUrl.replace(/\/+$/, '');
    }

    // Örn: "192.168.1.102:8081" → "192.168.1.102"
    const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
    if (devHost) {
        return `http://${devHost}:${BACKEND_PORT}`;
    }

    // Android emülatörü bilgisayara 10.0.2.2 üzerinden erişir
    return Platform.OS === 'android'
        ? `http://10.0.2.2:${BACKEND_PORT}`
        : `http://localhost:${BACKEND_PORT}`;
}

export const API_BASE = resolveApiBase();
