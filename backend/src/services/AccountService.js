const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');
const UserRepository = require('../repositories/UserRepository');
const DiagnosisRepository = require('../repositories/DiagnosisRepository');
const { ValidationError, NotFoundError, ServiceUnavailableError } = require('../errors/AppError');

/**
 * Kullanıcı hesabının kalıcı olarak silinmesi (KVKK / Google Play hesap silme gereksinimi).
 *
 * Kullanıcı, teşhis kayıtları ve oturum token'ları tek transaction içinde silinir; teşhis
 * fotoğrafları da diskten kaldırılır. Kayıtlı hesaplarda yanlışlıkla veya çalınmış bir oturumla
 * silinmeyi önlemek için şifre onayı istenir.
 */
class AccountService {
    #db;
    #imageStorage;

    constructor({ db, imageStorage }) {
        this.#db = db;
        this.#imageStorage = imageStorage;
    }

    /**
     * @param {string} userUuid - Doğrulanmış access token'dan gelen kullanıcı kimliği
     * @param {{ password?: string }} input - Kayıtlı hesaplar için mevcut şifre
     */
    async deleteAccount(userUuid, { password } = {}) {
        if (!(await this.#db.ensureConnected())) {
            throw new ServiceUnavailableError('Veritabanı şu anda çevrimdışı. Lütfen biraz sonra tekrar deneyin.');
        }

        const user = await new UserRepository(this.#db).findByUuidWithPassword(userUuid);
        if (!user) {
            throw new NotFoundError('Hesap bulunamadı.');
        }

        if (user.user_type === 'registered') {
            if (!password) {
                throw new ValidationError('Hesabınızı silmek için şifrenizi girin.');
            }
            if (!(await bcrypt.compare(password, user.password_hash))) {
                // 401 değil: istemci 401'i "oturum süresi doldu" sayıp token yenilemeye çalışır
                throw new ValidationError('Şifre hatalı.');
            }
        }

        const imageFiles = await this.#db.transaction(async (tx) => {
            const files = await new DiagnosisRepository(tx).deleteAllForUser(userUuid);
            await new UserRepository(tx).deleteByUuid(userUuid);
            return files;
        });

        // Fotoğraflar ancak kayıtlar kalıcı olarak silindikten sonra kaldırılır
        await this.#imageStorage.removeAll(imageFiles);
        logger.success(`🗑️ Hesap silindi (${user.user_type}): ${user.email || userUuid} | ${imageFiles.length} fotoğraf`);
    }
}

module.exports = AccountService;
