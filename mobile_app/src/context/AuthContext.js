import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { api } from '../services/ApiClient';
import { sessionStore } from '../services/SessionStore';

const AuthContext = createContext();

const GUEST_DEVICE_UUID_KEY = 'guestDeviceUuid';
const NETWORK_ERROR = 'Sunucuya bağlanılamadı. Lütfen ağınızı kontrol edin.';

/** Misafir hesabın kimliği; tahmin edilemez olması için kriptografik rastgele üretilir. */
async function getOrCreateGuestDeviceUuid({ forceNew = false } = {}) {
    let deviceUuid = forceNew ? null : await AsyncStorage.getItem(GUEST_DEVICE_UUID_KEY);
    if (!deviceUuid) {
        deviceUuid = Crypto.randomUUID();
        await AsyncStorage.setItem(GUEST_DEVICE_UUID_KEY, deviceUuid);
    }
    return deviceUuid;
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    // "Beni hatırla" açıksa yenilenen refresh token'lar güvenli depoya da yazılır
    const rememberSessionRef = useRef(false);

    const endSession = useCallback(() => {
        api.clearSession();
        rememberSessionRef.current = false;
        setUser(null);
    }, []);

    // Uygulama açılışı: eski düz metin verileri temizle, hatırlanan oturumu geri yükle
    useEffect(() => {
        api.setSessionListeners({
            onTokensRefreshed: (refreshToken) => {
                if (rememberSessionRef.current) sessionStore.saveRefreshToken(refreshToken);
            },
            onSessionExpired: () => {
                sessionStore.clearRefreshToken();
                endSession();
            },
        });

        const restoreSession = async () => {
            try {
                await sessionStore.removeLegacyData();
                const refreshToken = await sessionStore.loadRefreshToken();
                if (!refreshToken) return;

                const data = await api.refreshSession(refreshToken);
                if (data.basarili) {
                    api.setSession(data);
                    rememberSessionRef.current = true;
                    await sessionStore.saveRefreshToken(data.refreshToken);
                    setUser(data.user);
                } else if (data.httpStatus === 401) {
                    await sessionStore.clearRefreshToken(); // Token geçersiz; giriş ekranı gösterilir
                }
            } catch (err) {
                console.log('Oturum geri yüklenemedi:', err);
            } finally {
                setLoading(false);
            }
        };
        restoreSession();
    }, [endSession]);

    /**
     * Backend isteğini çalıştırır; başarılıysa token'ları yükleyip oturumu açar.
     * Tüm giriş işlemlerinde tekrarlanan "çağır → oturumu aç → hata mesajı" akışını tek yerde toplar.
     */
    const authenticate = async (request, fallbackError, { remember = false, email = null } = {}) => {
        try {
            const data = await request();
            if (!data.basarili) {
                return { basarili: false, hata: data.hata || fallbackError };
            }

            api.setSession(data);
            rememberSessionRef.current = remember;
            if (remember) {
                await sessionStore.remember(email, data.refreshToken);
            } else if (email) {
                await sessionStore.forget();
            }
            setUser(data.user);
            return { basarili: true };
        } catch (err) {
            console.log('Auth API Hatası:', err);
            return { basarili: false, hata: NETWORK_ERROR };
        }
    };

    // Giriş Yap — "Beni hatırla" açıksa şifre değil, iptal edilebilir oturum token'ı saklanır
    const login = (email, password, rememberMe) => authenticate(
        () => api.login(email, password),
        'Giriş yapılamadı.',
        { remember: rememberMe, email }
    );

    // Kayıt Ol
    const register = (name, email, password) => authenticate(
        () => api.register(name, email, password),
        'Kayıt yapılamadı.'
    );

    // Misafir Girişi
    const guestLogin = () => authenticate(
        async () => {
            const result = await api.guestLogin(await getOrCreateGuestDeviceUuid());
            if (result.httpStatus !== 403) return result;

            // 403: Bu cihazın misafir kimliği daha önce kayıtlı hesaba yükseltilmiş; o hesaba
            // şifresiz girilemeyeceği için yeni bir misafir kimliği ile tekrar dene.
            return api.guestLogin(await getOrCreateGuestDeviceUuid({ forceNew: true }));
        },
        'Misafir oturumu açılamadı.'
    );

    // Hesabı Yükselt (Misafir -> Kayıtlı Üye)
    const upgrade = async (name, email, password) => {
        if (!user || user.user_type !== 'guest') {
            return { basarili: false, hata: 'Aktif bir misafir oturumu bulunamadı.' };
        }
        try {
            const data = await api.upgradeGuest(name, email, password);
            if (!data.basarili) {
                return { basarili: false, hata: data.hata || 'Hesap yükseltilemedi.' };
            }
            // Bu kimlik artık kayıtlı hesaba ait; bir sonraki misafir girişi yeni kimlikle yapılır
            await AsyncStorage.removeItem(GUEST_DEVICE_UUID_KEY);
            setUser(data.user);
            return { basarili: true };
        } catch (err) {
            console.log('Yükseltme API Hatası:', err);
            return { basarili: false, hata: NETWORK_ERROR };
        }
    };

    // Çıkış Yap — sunucudaki oturum da iptal edilir
    const logout = async () => {
        try {
            await api.logout();
        } catch (err) {
            console.log('Sunucu oturumu kapatılamadı:', err); // Yerel çıkış yine de yapılır
        }
        await sessionStore.clearRefreshToken();
        endSession();
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, guestLogin, upgrade, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
