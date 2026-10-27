// Dışarıya döndürülen kullanıcı alanları (password_hash asla dahil edilmez)
const PUBLIC_COLUMNS = 'id, uuid, name, email, user_type';

/**
 * `users` tablosuna erişimi kapsüller.
 */
class UserRepository {
    #db;

    constructor(db) {
        this.#db = db;
    }

    async findByUuid(uuid) {
        const res = await this.#db.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE uuid = $1`, [uuid]);
        return res.rows[0] || null;
    }

    /** Giriş doğrulaması için şifre hash'i ile birlikte kayıtlı kullanıcıyı getirir. */
    async findRegisteredByEmailWithPassword(email) {
        const res = await this.#db.query(
            `SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE LOWER(email) = LOWER($1) AND user_type = 'registered'`,
            [email]
        );
        return res.rows[0] || null;
    }

    /** Şifre doğrulaması için hash ile birlikte getirir (misafirlerde password_hash null'dır). */
    async findByUuidWithPassword(uuid) {
        const res = await this.#db.query(`SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE uuid = $1`, [uuid]);
        return res.rows[0] || null;
    }

    /**
     * Kullanıcıyı siler; teşhis kayıtları ve oturum token'ları ON DELETE CASCADE ile silinir.
     * @returns {Promise<boolean>} Kullanıcı bulunup silindiyse true
     */
    async deleteByUuid(uuid) {
        const res = await this.#db.query('DELETE FROM users WHERE uuid = $1', [uuid]);
        return res.rowCount > 0;
    }

    async emailExists(email, excludeUuid = null) {
        // Büyük/küçük harf farkı olan eski kayıtlar da çakışma sayılır
        const res = excludeUuid
            ? await this.#db.query('SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) AND uuid != $2', [email, excludeUuid])
            : await this.#db.query('SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)', [email]);
        return res.rowCount > 0;
    }

    async createRegistered({ uuid, name, email, passwordHash }) {
        const res = await this.#db.query(
            `INSERT INTO users (uuid, name, email, password_hash, user_type)
             VALUES ($1, $2, $3, $4, 'registered')
             RETURNING ${PUBLIC_COLUMNS}`,
            [uuid, name, email, passwordHash]
        );
        return res.rows[0];
    }

    async createGuest(uuid) {
        const res = await this.#db.query(
            `INSERT INTO users (uuid, name, user_type) VALUES ($1, 'Misafir', 'guest') RETURNING ${PUBLIC_COLUMNS}`,
            [uuid]
        );
        return res.rows[0];
    }

    /** Yalnızca misafir hesabı kayıtlı üyeliğe yükseltir; kayıtlı hesaplara dokunmaz. */
    async upgradeGuest(uuid, { name, email, passwordHash }) {
        const res = await this.#db.query(
            `UPDATE users
             SET name = $1, email = $2, password_hash = $3, user_type = 'registered'
             WHERE uuid = $4 AND user_type = 'guest'
             RETURNING ${PUBLIC_COLUMNS}`,
            [name, email, passwordHash, uuid]
        );
        return res.rows[0] || null;
    }

    /** UUID'ye ait kullanıcının ID'sini döndürür; yoksa misafir olarak oluşturur. */
    async findOrCreateGuestId(uuid) {
        const existing = await this.findByUuid(uuid);
        if (existing) return existing.id;
        const created = await this.createGuest(uuid);
        return created.id;
    }
}

module.exports = UserRepository;
