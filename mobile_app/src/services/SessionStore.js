import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
    refreshToken: 'verdant.refreshToken',  // SecureStore (şifreli: Android Keystore / iOS Keychain)
    guestDeviceUuid: 'verdant.guestDeviceUuid', // SecureStore
    rememberedEmail: 'savedEmail',         // AsyncStorage (hassas değil, giriş formunu doldurmak için)
    rememberMe: 'rememberMe',
};

// Eski sürümlerde misafir kimliği AsyncStorage'da (şifresiz) bu anahtarla tutuluyordu
const LEGACY_GUEST_UUID_KEY = 'guestDeviceUuid';

// Eski sürümlerin cihazda düz metin olarak bıraktığı anahtarlar
const LEGACY_KEYS = ['savedPassword', 'userSession'];

/**
 * "Beni hatırla" verilerini cihazda saklar.
 * Şifre asla saklanmaz; yalnızca sunucuda iptal edilebilen refresh token şifreli depoda tutulur.
 */
class SessionStore {
    /** Eski sürümlerden kalan düz metin şifreyi ve oturum verisini siler. */
    async removeLegacyData() {
        await AsyncStorage.multiRemove(LEGACY_KEYS);
    }

    async loadRefreshToken() {
        try {
            return await SecureStore.getItemAsync(KEYS.refreshToken);
        } catch {
            return null; // Güvenli depo bu platformda yoksa (ör. web) hatırlama devre dışı
        }
    }

    async saveRefreshToken(refreshToken) {
        try {
            await SecureStore.setItemAsync(KEYS.refreshToken, refreshToken);
        } catch (err) {
            console.log('Oturum güvenli depoya kaydedilemedi:', err);
        }
    }

    async remember(email, refreshToken) {
        await this.saveRefreshToken(refreshToken);
        await AsyncStorage.setItem(KEYS.rememberedEmail, email);
        await AsyncStorage.setItem(KEYS.rememberMe, 'true');
    }

    async forget() {
        try {
            await SecureStore.deleteItemAsync(KEYS.refreshToken);
        } catch { /* Güvenli depo yoksa silinecek bir şey de yok */ }
        await AsyncStorage.multiRemove([KEYS.rememberedEmail, KEYS.rememberMe]);
    }

    /** Oturum kapanınca token'ı sil ama giriş formu için e-postayı hatırlamaya devam et. */
    async clearRefreshToken() {
        try {
            await SecureStore.deleteItemAsync(KEYS.refreshToken);
        } catch { /* yok sayılır */ }
    }

    /**
     * Misafir hesabın cihaz kimliği. Misafir oturumu açmaya yettiği için güvenli depoda tutulur;
     * eski sürümlerin AsyncStorage'da bıraktığı değer bir kez güvenli depoya taşınır (misafir geçmişi korunur).
     */
    async loadGuestDeviceUuid() {
        const stored = await this.#secureGet(KEYS.guestDeviceUuid);
        if (stored) return stored;

        const legacy = await AsyncStorage.getItem(LEGACY_GUEST_UUID_KEY);
        if (legacy && await this.#secureSet(KEYS.guestDeviceUuid, legacy)) {
            await AsyncStorage.removeItem(LEGACY_GUEST_UUID_KEY);
        }
        return legacy;
    }

    async saveGuestDeviceUuid(uuid) {
        if (!(await this.#secureSet(KEYS.guestDeviceUuid, uuid))) {
            await AsyncStorage.setItem(LEGACY_GUEST_UUID_KEY, uuid); // Güvenli depo yoksa (ör. web)
        }
    }

    async clearGuestDeviceUuid() {
        try {
            await SecureStore.deleteItemAsync(KEYS.guestDeviceUuid);
        } catch { /* Güvenli depo yoksa silinecek bir şey de yok */ }
        await AsyncStorage.removeItem(LEGACY_GUEST_UUID_KEY);
    }

    async #secureGet(key) {
        try {
            return await SecureStore.getItemAsync(key);
        } catch {
            return null;
        }
    }

    /** @returns {Promise<boolean>} Kayıt başarılıysa true */
    async #secureSet(key, value) {
        try {
            await SecureStore.setItemAsync(key, value);
            return true;
        } catch {
            return false;
        }
    }

    /** @returns {Promise<{ email: string|null, rememberMe: boolean }>} */
    async loadRememberedLogin() {
        const [email, rememberMe] = await Promise.all([
            AsyncStorage.getItem(KEYS.rememberedEmail),
            AsyncStorage.getItem(KEYS.rememberMe),
        ]);
        return { email, rememberMe: rememberMe === 'true' };
    }
}

export const sessionStore = new SessionStore();
