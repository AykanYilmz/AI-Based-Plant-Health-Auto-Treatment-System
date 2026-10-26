/**
 * `refresh_tokens` tablosuna erişimi kapsüller.
 * Token'ların kendisi değil yalnızca SHA-256 hash'leri saklanır; veritabanı sızsa bile token'lar kullanılamaz.
 */
class RefreshTokenRepository {
    #db;

    constructor(db) {
        this.#db = db;
    }

    async create({ userId, tokenHash, expiresAt }) {
        await this.#db.query(
            'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
            [userId, tokenHash, expiresAt]
        );
    }

    /** Token hash'ine ait kaydı sahibinin bilgileriyle getirir. */
    async findByHash(tokenHash) {
        const res = await this.#db.query(
            `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at, u.uuid AS user_uuid
             FROM refresh_tokens rt
             JOIN users u ON u.id = rt.user_id
             WHERE rt.token_hash = $1`,
            [tokenHash]
        );
        return res.rows[0] || null;
    }

    /**
     * Token'ı yalnızca henüz iptal edilmemişse iptal eder.
     * @returns {Promise<boolean>} Bu çağrı token'ı iptal ettiyse true (eşzamanlı kullanımda yalnızca biri kazanır)
     */
    async revoke(id) {
        const res = await this.#db.query(
            'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL',
            [id]
        );
        return res.rowCount > 0;
    }

    async revokeAllForUser(userId) {
        await this.#db.query(
            'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
            [userId]
        );
    }

    /** Süresi dolmuş ve iptal edilmiş eski kayıtları temizler. */
    async deleteExpired() {
        const res = await this.#db.query(
            `DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL '7 days'`
        );
        return res.rowCount;
    }
}

module.exports = RefreshTokenRepository;
