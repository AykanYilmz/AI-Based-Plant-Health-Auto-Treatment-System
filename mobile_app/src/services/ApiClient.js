import { API_BASE } from '../config';

/**
 * VerdantAI backend'ine yapılan tüm HTTP isteklerini tek noktadan yönetir.
 * Ekranlar URL, header veya JSON ayrıştırma ayrıntılarını bilmez; sadece metotları çağırır.
 *
 * Tüm metotlar backend'in `{ basarili, hata, ... }` biçimindeki yanıtını, HTTP durum kodu
 * `httpStatus` alanına eklenmiş olarak döndürür.
 * Ağ hatalarında (sunucuya ulaşılamazsa) istisna fırlatılır; çağıran taraf yakalamalıdır.
 */
export class ApiClient {
    #baseUrl;

    constructor(baseUrl) {
        this.#baseUrl = baseUrl;
    }

    get baseUrl() {
        return this.#baseUrl;
    }

    /** Teşhis görselinin tam URL'si */
    imageUrl(filename) {
        return `${this.#baseUrl}/uploads/${filename}`;
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

    upgradeGuest(deviceUuid, name, email, password) {
        return this.#post('/api/auth/upgrade', { deviceUuid, name, email, password });
    }

    // ─── Teşhis ve Geçmiş ─────────────────────────────────────

    /**
     * @param {FormData} formData - 'image' alanında fotoğraf
     * @param {string} userUuid
     * @param {AbortSignal} [signal] - İsteği iptal etmek için
     */
    diagnose(formData, userUuid, signal) {
        return this.#request('/api/diagnose', {
            method: 'POST',
            headers: ApiClient.#userHeader(userUuid),
            body: formData,
            signal,
        });
    }

    getHistory(userUuid) {
        return this.#request(`/api/history?uuid=${encodeURIComponent(userUuid)}`);
    }

    deleteDiagnosis(id, userUuid) {
        return this.#request(`/api/history/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: ApiClient.#userHeader(userUuid),
        });
    }

    deleteAllHistory(userUuid) {
        return this.#request(`/api/history?uuid=${encodeURIComponent(userUuid)}`, { method: 'DELETE' });
    }

    // ─── Özel yardımcılar ─────────────────────────────────────

    #post(path, body) {
        return this.#request(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
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

    static #userHeader(userUuid) {
        return userUuid ? { 'X-User-UUID': userUuid } : {};
    }
}

export const api = new ApiClient(API_BASE);
