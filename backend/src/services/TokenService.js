const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { UnauthorizedError } = require('../errors/AppError');

const JWT_ALGORITHM = 'HS256';
const ACCESS_TOKEN_TYPE = 'access';

/**
 * Erişim (access) ve yenileme (refresh) token'larını üretir, doğrular ve döndürür.
 *
 * - Access token: kısa ömürlü, imzalı JWT. Her istekte `Authorization: Bearer` ile gönderilir.
 * - Refresh token: uzun ömürlü, rastgele ve opak bir değer. Veritabanında hash'i saklanır,
 *   her kullanımda yenisiyle değiştirilir (rotation). İptal edilmiş bir token tekrar kullanılırsa
 *   çalınmış kabul edilir ve kullanıcının tüm oturumları kapatılır.
 */
class TokenService {
    #secret;
    #accessTtlSeconds;
    #refreshTtlMs;
    #refreshTokens;

    constructor({ secret, refreshTokenRepository, accessTtlSeconds = 60 * 60, refreshTtlDays = 30 }) {
        if (!secret) throw new Error('TokenService için JWT secret gereklidir.');
        this.#secret = secret;
        this.#refreshTokens = refreshTokenRepository;
        this.#accessTtlSeconds = accessTtlSeconds;
        this.#refreshTtlMs = refreshTtlDays * 24 * 60 * 60 * 1000;
    }

    /**
     * Kullanıcı için yeni bir access + refresh token çifti üretir.
     * @param {{ id: number, uuid: string }} user
     */
    async issueTokens(user) {
        const accessToken = jwt.sign({ typ: ACCESS_TOKEN_TYPE }, this.#secret, {
            algorithm: JWT_ALGORITHM,
            subject: user.uuid,
            expiresIn: this.#accessTtlSeconds,
        });

        const refreshToken = crypto.randomBytes(48).toString('base64url');
        await this.#refreshTokens.create({
            userId: user.id,
            tokenHash: TokenService.#hash(refreshToken),
            expiresAt: new Date(Date.now() + this.#refreshTtlMs),
        });

        return { accessToken, refreshToken, expiresIn: this.#accessTtlSeconds };
    }

    /**
     * Access token'ı doğrular.
     * @returns {{ uuid: string }} Token sahibinin kimliği
     * @throws {UnauthorizedError}
     */
    verifyAccessToken(token) {
        try {
            const payload = jwt.verify(token, this.#secret, { algorithms: [JWT_ALGORITHM] });
            if (payload.typ !== ACCESS_TOKEN_TYPE || !payload.sub) {
                throw new Error('Geçersiz token türü');
            }
            return { uuid: payload.sub };
        } catch (err) {
            const expired = err.name === 'TokenExpiredError';
            throw new UnauthorizedError(
                expired ? 'Oturum süresi doldu.' : 'Geçersiz oturum. Lütfen tekrar giriş yapın.',
                { kod: expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID' }
            );
        }
    }

    /**
     * Refresh token'ı tüketir ve yerine yenisini üretir.
     * @returns {Promise<{ userId: number, userUuid: string }>} Token sahibi
     * @throws {UnauthorizedError} Token geçersiz, süresi dolmuş veya daha önce kullanılmışsa
     */
    async consumeRefreshToken(refreshToken) {
        const record = refreshToken ? await this.#refreshTokens.findByHash(TokenService.#hash(refreshToken)) : null;
        if (!record) {
            throw new UnauthorizedError('Oturum bulunamadı. Lütfen tekrar giriş yapın.', { kod: 'REFRESH_INVALID' });
        }

        if (record.revoked_at) {
            // Daha önce kullanılmış bir token tekrar geldiyse token çalınmış olabilir
            logger.warn(`🚨 İptal edilmiş refresh token tekrar kullanıldı; kullanıcının tüm oturumları kapatılıyor (user_id=${record.user_id})`);
            await this.#refreshTokens.revokeAllForUser(record.user_id);
            throw new UnauthorizedError('Oturum geçersiz. Lütfen tekrar giriş yapın.', { kod: 'REFRESH_REUSED' });
        }

        if (new Date(record.expires_at) <= new Date()) {
            throw new UnauthorizedError('Oturum süresi doldu. Lütfen tekrar giriş yapın.', { kod: 'REFRESH_EXPIRED' });
        }

        // Eşzamanlı iki yenileme isteğinden yalnızca biri token'ı tüketebilir
        if (!(await this.#refreshTokens.revoke(record.id))) {
            throw new UnauthorizedError('Oturum geçersiz. Lütfen tekrar giriş yapın.', { kod: 'REFRESH_REUSED' });
        }

        return { userId: record.user_id, userUuid: record.user_uuid };
    }

    /** Çıkış: refresh token'ı iptal eder (geçersiz token sessizce yok sayılır). */
    async revokeRefreshToken(refreshToken) {
        if (!refreshToken) return;
        const record = await this.#refreshTokens.findByHash(TokenService.#hash(refreshToken));
        if (record) await this.#refreshTokens.revoke(record.id);
    }

    static #hash(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }
}

module.exports = TokenService;
