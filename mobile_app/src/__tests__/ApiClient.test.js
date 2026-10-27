import { ApiClient } from '../services/ApiClient';

const BASE = 'http://backend.test';

/** fetch yerine geçen sahte sunucu: oturum token'ını doğrular, refresh token'ı bir kez kabul eder */
function createFakeServer() {
    const state = { validAccess: 'access-1', validRefresh: 'refresh-1', refreshCalls: 0 };
    const json = (status, body) => Promise.resolve({ status, json: () => Promise.resolve(body) });

    global.fetch = jest.fn((url, options = {}) => {
        const path = url.replace(BASE, '');
        if (path === '/api/auth/refresh') {
            state.refreshCalls++;
            const { refreshToken } = JSON.parse(options.body);
            if (refreshToken !== state.validRefresh) return json(401, { basarili: false, hata: 'Oturum geçersiz' });
            state.validAccess = `access-${state.refreshCalls + 1}`;
            state.validRefresh = `refresh-${state.refreshCalls + 1}`;
            return json(200, { basarili: true, accessToken: state.validAccess, refreshToken: state.validRefresh, user: {} });
        }
        const auth = options.headers?.Authorization;
        if (auth !== `Bearer ${state.validAccess}`) return json(401, { basarili: false, kod: 'TOKEN_EXPIRED' });
        return json(200, { basarili: true, gecmis: [], toplam: 0 });
    });
    return state;
}

describe('ApiClient', () => {
    let client;
    let onTokensRefreshed;
    let onSessionExpired;

    beforeEach(() => {
        client = new ApiClient(BASE);
        onTokensRefreshed = jest.fn();
        onSessionExpired = jest.fn();
        client.setSessionListeners({ onTokensRefreshed, onSessionExpired });
    });

    it('sends the access token and adds the HTTP status to the response', async () => {
        createFakeServer();
        client.setSession({ accessToken: 'access-1', refreshToken: 'refresh-1' });

        await expect(client.getHistory()).resolves.toMatchObject({ basarili: true, httpStatus: 200 });
        expect(global.fetch.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer access-1' });
    });

    it('refreshes an expired access token once and retries the request', async () => {
        const server = createFakeServer();
        client.setSession({ accessToken: 'eski-token', refreshToken: 'refresh-1' });

        await expect(client.getHistory()).resolves.toMatchObject({ basarili: true });
        expect(server.refreshCalls).toBe(1);
        expect(client.refreshToken).toBe('refresh-2');
        expect(onTokensRefreshed).toHaveBeenCalledWith('refresh-2');
    });

    it('shares a single refresh between concurrent requests', async () => {
        const server = createFakeServer();
        client.setSession({ accessToken: 'eski-token', refreshToken: 'refresh-1' });

        const results = await Promise.all([client.getHistory(), client.getHistory(), client.deleteAllHistory()]);

        expect(results.every(r => r.basarili)).toBe(true);
        expect(server.refreshCalls).toBe(1);
    });

    it('ends the session when the refresh token is rejected', async () => {
        createFakeServer();
        client.setSession({ accessToken: 'eski-token', refreshToken: 'calinti-token' });

        await expect(client.getHistory()).resolves.toMatchObject({ basarili: false, httpStatus: 401 });
        expect(onSessionExpired).toHaveBeenCalledTimes(1);
        expect(client.refreshToken).toBeNull();
    });

    it('keeps the session on network errors during refresh', async () => {
        createFakeServer();
        client.setSession({ accessToken: 'eski-token', refreshToken: 'refresh-1' });
        const realFetch = global.fetch;
        global.fetch = jest.fn((url, options) => (url.endsWith('/api/auth/refresh')
            ? Promise.reject(new TypeError('Network request failed'))
            : realFetch(url, options)));

        await expect(client.getHistory()).resolves.toMatchObject({ httpStatus: 401 });
        expect(onSessionExpired).not.toHaveBeenCalled();
        expect(client.refreshToken).toBe('refresh-1');
    });

    it('builds authenticated image sources', () => {
        client.setSession({ accessToken: 'access-1', refreshToken: 'refresh-1' });
        expect(client.imageSource('img 1.jpg')).toEqual({
            uri: `${BASE}/api/images/img%201.jpg`,
            headers: { Authorization: 'Bearer access-1' },
        });
    });
});
