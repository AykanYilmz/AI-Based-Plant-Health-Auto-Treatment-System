import { API_BASE } from '../config';

/**
 * VerdantAI backend'ine yapılan tüm HTTP isteklerini ve oturum token'larını tek noktadan yönetir.
 * Ekranlar URL, header, token veya JSON ayrıştırma ayrıntılarını bilmez; sadece metotları çağırır.
 *
 * - Oturum gerektiren isteklere `Authorization: Bearer <accessToken>` otomatik eklenir.
 * - Access token'ın süresi dolmuşsa (401) refresh token ile bir kez yenilenip istek tekrarlanır.
 *   Aynı anda 401 alan istekler tek bir yenileme işlemini paylaşır.
 * - Yenileme başarısız olursa `onSessionExpired` çağrılır (AuthContext kullanıcıyı çıkış yaptırır).
 *
 * Tüm metotlar backend'in `{ basarili, hata, ... }` biçimindeki yanıtını, HTTP durum kodu
 * `httpStatus` alanına eklenmiş olarak döndürür. Ağ hatalarında istisna fırlatılır.
 */
export class ApiClient {
    #baseUrl;
    #accessToken = null;
    #refreshToken = null;
    #refreshPromise = null;
    #listeners = { onTokensRefreshed: null, onSessionExpired: null };

    constructor(baseUrl) {
        this.#baseUrl = baseUrl;
    }

    get baseUrl() {
        return this.#baseUrl;
    }

    get refreshToken() {
        return this.#refreshToken;
    }

    // ─── Oturum ───────────────────────────────────────────────

    /** Giriş yanıtındaki token'ları oturuma yükler. */
    setSession({ accessToken, refreshToken }) {
        this.#accessToken = accessToken;
        this.#refreshToken = refreshToken;
    }

    clearSession() {
        this.#accessToken = null;
        this.#refreshToken = null;
    }

    /**
     * @param {{ onTokensRefreshed?: (refreshToken: string) => void, onSessionExpired?: () => void }} listeners
     */
    setSessionListeners(listeners) {
        this.#listeners = { ...this.#listeners, ...listeners };
    }

    // ─── Kimlik Doğrulama ─────────────────────────────────────

    login(email, password) {
        return this.#post('/api/auth/login', { email, password });
    }

    register(name, email, password) {
        return this.#post('/api/auth/register', { name, email, password });
    }

    guestLogin(deviceUuid) {
        return this.#post('/api/auth/guest', { deviceUuid });
    }

    /** Refresh token ile yeni bir oturum açar (uygulama açılışında oturumu geri yüklemek için). */
    refreshSession(refreshToken) {
        return this.#post('/api/auth/refresh', { refreshToken });
    }

    /** Oturumdaki refresh token'ı sunucuda iptal eder. */
    logout() {
        return this.#post('/api/auth/logout', { refreshToken: this.#refreshToken });
    }

    upgradeGuest(name, email, password) {
        return this.#authorizedRequest('/api/auth/upgrade', ApiClient.#jsonBody('POST', { name, email, password }));
    }

    /** Hesabı ve tüm verileri kalıcı olarak siler (kayıtlı hesaplarda şifre gerekir). */
    deleteAccount(password) {
        return this.#authorizedRequest('/api/auth/account', ApiClient.#jsonBody('DELETE', { password }));
    }

    // ─── Teşhis ve Geçmiş ─────────────────────────────────────

    /**
     * @param {FormData} formData - 'image' alanında fotoğraf
     * @param {AbortSignal} [signal] - İsteği iptal etmek için
     */
    diagnose(formData, signal) {
        return this.#authorizedRequest('/api/diagnose', { method: 'POST', body: formData, signal });
    }

    getHistory() {
        return this.#authorizedRequest('/api/history');
    }

    deleteDiagnosis(id) {
        return this.#authorizedRequest(`/api/history/${encodeURIComponent(id)}`, { method: 'DELETE' });
    }

    deleteAllHistory() {
        return this.#authorizedRequest('/api/history', { method: 'DELETE' });
    }

    /** `<Image source={...}>` için teşhis görseli kaynağı (oturum header'ı ile) */
    imageSource(filename) {
        return {
            uri: `${this.#baseUrl}/api/images/${encodeURIComponent(filename)}`,
            headers: this.#authHeader(),
        };
    }

    // ─── Özel yardımcılar ─────────────────────────────────────

    #post(path, body) {
        return this.#request(path, ApiClient.#jsonBody('POST', body));
    }

    async #authorizedRequest(path, options = {}) {
        const send = () => this.#request(path, {
            ...options,
            headers: { ...options.headers, ...this.#authHeader() },
        });

        const result = await send();
        if (result.httpStatus !== 401 || !this.#refreshToken) return result;

        // Access token süresi dolmuş olabilir: bir kez yenile ve isteği tekrarla
        return (await this.#refreshAccessToken()) ? send() : result;
    }

    /** @returns {Promise<boolean>} Yenileme başarılıysa true */
    #refreshAccessToken() {
        if (!this.#refreshPromise) {
            this.#refreshPromise = (async () => {
                try {
                    const data = await this.refreshSession(this.#refreshToken);
                    if (!data.basarili) {
                        this.clearSession();
                        this.#listeners.onSessionExpired?.();
                        return false;
                    }
                    this.setSession(data);
                    this.#listeners.onTokensRefreshed?.(data.refreshToken);
                    return true;
                } catch {
                    return false; // Ağ hatası: oturumu düşürme, bir sonraki istekte tekrar denenir
                }
            })().finally(() => {
                this.#refreshPromise = null;
            });
        }
        return this.#refreshPromise;
    }

    async #request(path, options = {}) {
        const response = await fetch(`${this.#baseUrl}${path}`, options);
        let data;
        try {
            data = await response.json();
        } catch {
            // Backend JSON dışı bir yanıt döndürdüyse (ör. proxy hata sayfası)
            data = { basarili: false, hata: `Sunucudan beklenmeyen yanıt alındı (HTTP ${response.status}).` };
        }
        return { ...data, httpStatus: response.status };
    }

    #authHeader() {
        return this.#accessToken ? { Authorization: `Bearer ${this.#accessToken}` } : {};
    }

    static #jsonBody(method, body) {
        return {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        };
    }
}

export const api = new ApiClient(API_BASE);
