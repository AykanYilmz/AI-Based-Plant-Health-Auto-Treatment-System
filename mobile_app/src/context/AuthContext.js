import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/ApiClient';

const AuthContext = createContext();

const STORAGE_KEYS = {
    session: 'userSession',
    guestDeviceUuid: 'guestDeviceUuid',
    savedEmail: 'savedEmail',
    savedPassword: 'savedPassword',
    rememberMe: 'rememberMe',
};

const NETWORK_ERROR = 'Sunucuya bağlanılamadı. Lütfen ağınızı kontrol edin.';

const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

async function getOrCreateGuestDeviceUuid({ forceNew = false } = {}) {
    let deviceUuid = forceNew ? null : await AsyncStorage.getItem(STORAGE_KEYS.guestDeviceUuid);
    if (!deviceUuid) {
        deviceUuid = generateUUID();
        await AsyncStorage.setItem(STORAGE_KEYS.guestDeviceUuid, deviceUuid);
    }
    return deviceUuid;
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Uygulama başlarken aktif oturumu yükle
    useEffect(() => {
        const loadSession = async () => {
            try {
                // Otomatik giriş devre dışı bırakıldı. Uygulama her açıldığında giriş ekranı gösterilecek.
                await AsyncStorage.removeItem(STORAGE_KEYS.session);
            } catch (err) {
                console.log('Oturum yükleme hatası:', err);
            } finally {
                setLoading(false);
            }
        };
        loadSession();
    }, []);

    /**
     * Backend isteğini çalıştırır; başarılıysa oturumu açar.
     * Tüm auth işlemlerinde tekrarlanan "çağır → kaydet → hata mesajı" akışını tek yerde toplar.
     */
    const authenticate = async (request, fallbackError, onSuccess) => {
        try {
            const data = await request();
            if (!data.basarili) {
                return { basarili: false, hata: data.hata || fallbackError };
            }
            await AsyncStorage.setItem(STORAGE_KEYS.session, JSON.stringify(data.user));
            if (onSuccess) await onSuccess(data.user);
            setUser(data.user);
            return { basarili: true };
        } catch (err) {
            console.log('Auth API Hatası:', err);
            return { basarili: false, hata: NETWORK_ERROR };
        }
    };

    // Giriş Yap
    const login = (email, password, rememberMe) => authenticate(
        () => api.login(email, password),
        'Giriş yapılamadı.',
        async () => {
            if (rememberMe) {
                await AsyncStorage.setItem(STORAGE_KEYS.savedEmail, email);
                await AsyncStorage.setItem(STORAGE_KEYS.savedPassword, password);
                await AsyncStorage.setItem(STORAGE_KEYS.rememberMe, 'true');
            } else {
                await AsyncStorage.multiRemove([STORAGE_KEYS.savedEmail, STORAGE_KEYS.savedPassword, STORAGE_KEYS.rememberMe]);
            }
        }
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
    const upgrade = (name, email, password) => {
        if (!user || user.user_type !== 'guest') {
            return Promise.resolve({ basarili: false, hata: 'Aktif bir misafir oturumu bulunamadı.' });
        }
        return authenticate(
            () => api.upgradeGuest(user.uuid, name, email, password),
            'Hesap yükseltilemedi.',
            // Bu kimlik artık kayıtlı hesaba ait; bir sonraki misafir girişi yeni kimlikle yapılır
            () => AsyncStorage.removeItem(STORAGE_KEYS.guestDeviceUuid)
        );
    };

    // Çıkış Yap
    const logout = async () => {
        try {
            await AsyncStorage.removeItem(STORAGE_KEYS.session);
            setUser(null);
        } catch (err) {
            console.log('Oturum kapatma hatası:', err);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, guestLogin, upgrade, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
