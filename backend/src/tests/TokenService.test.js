const jwt = require('jsonwebtoken');
const TokenService = require('../services/TokenService');
const createAuthenticate = require('../middlewares/authenticate');
const { UnauthorizedError } = require('../errors/AppError');

jest.mock('../utils/logger');

const SECRET = 'test-secret';
const user = { id: 7, uuid: 'user-uuid' };

/** Bellekte çalışan sahte refresh token deposu */
function createRepository() {
    const rows = [];
    return {
        rows,
        create: jest.fn(async ({ userId, tokenHash, expiresAt }) => {
            rows.push({ id: rows.length + 1, user_id: userId, user_uuid: user.uuid, token_hash: tokenHash, expires_at: expiresAt, revoked_at: null });
        }),
        findByHash: jest.fn(async (hash) => rows.find(r => r.token_hash === hash) || null),
        revoke: jest.fn(async (id) => {
            const row = rows.find(r => r.id === id);
            if (!row || row.revoked_at) return false;
            row.revoked_at = new Date();
            return true;
        }),
        revokeAllForUser: jest.fn(async (userId) => {
            rows.filter(r => r.user_id === userId).forEach(r => { r.revoked_at = r.revoked_at || new Date(); });
        }),
    };
}

function createService(options = {}) {
    const repository = createRepository();
    return { service: new TokenService({ secret: SECRET, refreshTokenRepository: repository, ...options }), repository };
}

describe('TokenService', () => {
    it('issues an access token that verifies to the user uuid and stores only the refresh token hash', async () => {
        const { service, repository } = createService();
        const { accessToken, refreshToken } = await service.issueTokens(user);

        expect(service.verifyAccessToken(accessToken)).toEqual({ uuid: 'user-uuid' });
        expect(repository.rows[0].token_hash).toHaveLength(64);
        expect(repository.rows[0].token_hash).not.toContain(refreshToken);
    });

    it('rejects tokens signed with another secret or of another type', () => {
        const { service } = createService();
        const forged = jwt.sign({ typ: 'access' }, 'other-secret', { subject: 'user-uuid' });
        const wrongType = jwt.sign({ typ: 'refresh' }, SECRET, { subject: 'user-uuid' });

        expect(() => service.verifyAccessToken(forged)).toThrow(UnauthorizedError);
        expect(() => service.verifyAccessToken(wrongType)).toThrow(UnauthorizedError);
    });

    it('marks expired access tokens with TOKEN_EXPIRED', () => {
        const { service } = createService();
        const expired = jwt.sign({ typ: 'access', exp: Math.floor(Date.now() / 1000) - 10 }, SECRET, { subject: 'user-uuid' });

        try {
            service.verifyAccessToken(expired);
            throw new Error('should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(UnauthorizedError);
            expect(err.details.kod).toBe('TOKEN_EXPIRED');
        }
    });

    it('rotates a refresh token exactly once', async () => {
        const { service } = createService();
        const { refreshToken } = await service.issueTokens(user);

        await expect(service.consumeRefreshToken(refreshToken)).resolves.toEqual({ userId: 7, userUuid: 'user-uuid' });
        await expect(service.consumeRefreshToken(refreshToken)).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('revokes every session of the user when a used refresh token is replayed', async () => {
        const { service, repository } = createService();
        const first = await service.issueTokens(user);
        const second = await service.issueTokens(user);

        await service.consumeRefreshToken(first.refreshToken);
        await expect(service.consumeRefreshToken(first.refreshToken)).rejects.toMatchObject({ details: { kod: 'REFRESH_REUSED' } });

        expect(repository.revokeAllForUser).toHaveBeenCalledWith(7);
        await expect(service.consumeRefreshToken(second.refreshToken)).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('rejects expired and unknown refresh tokens', async () => {
        const { service } = createService({ refreshTtlDays: -1 });
        const { refreshToken } = await service.issueTokens(user);

        await expect(service.consumeRefreshToken(refreshToken)).rejects.toMatchObject({ details: { kod: 'REFRESH_EXPIRED' } });
        await expect(service.consumeRefreshToken('unknown')).rejects.toMatchObject({ details: { kod: 'REFRESH_INVALID' } });
        await expect(service.consumeRefreshToken(undefined)).rejects.toBeInstanceOf(UnauthorizedError);
    });
});

describe('authenticate middleware', () => {
    const header = (value) => ({ get: (name) => (name.toLowerCase() === 'authorization' ? value : undefined) });

    it('sets req.user for a valid bearer token', async () => {
        const { service } = createService();
        const { accessToken } = await service.issueTokens(user);
        const req = header(`Bearer ${accessToken}`);
        const next = jest.fn();

        createAuthenticate(service)(req, {}, next);

        expect(req.user).toEqual({ uuid: 'user-uuid' });
        expect(next).toHaveBeenCalled();
    });

    it('rejects missing or malformed headers', () => {
        const { service } = createService();
        const authenticate = createAuthenticate(service);

        expect(() => authenticate(header(undefined), {}, jest.fn())).toThrow(UnauthorizedError);
        expect(() => authenticate(header('Basic abc'), {}, jest.fn())).toThrow(UnauthorizedError);
        expect(() => authenticate(header('Bearer not-a-jwt'), {}, jest.fn())).toThrow(UnauthorizedError);
    });
});
