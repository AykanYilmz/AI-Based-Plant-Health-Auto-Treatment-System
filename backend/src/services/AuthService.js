const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const logger = require('../utils/logger');
const {
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ServiceUnavailableError,
} = require('../errors/AppError');

const BCRYPT_ROUNDS = 10;

/**
 * Kayıt, giriş, misafir oturumu ve misafir hesabın yükseltilmesi iş kurallarını yönetir.
 */
class AuthService {
    #db;
    #users;

    constructor({ db, userRepository }) {
        this.#db = db;
        this.#users = userRepository;
    }

    async register({ name, email, password }) {
        if (!name || !email || !password) {
            throw new ValidationError('Lütfen isim, e-posta ve şifre alanlarını doldurun.');
        }
        await this.#requireDatabase();

        if (await this.#users.emailExists(email)) {
            throw new ValidationError('Bu e-posta adresi zaten kullanımda.');
        }

        const user = await this.#users.createRegistered({
            uuid: crypto.randomUUID(),
            name,
            email,
            passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        });
        logger.success(`👤 Yeni kullanıcı kaydedildi: ${email}`);
        return user;
    }

    async login({ email, password }) {
        if (!email || !password) {
            throw new ValidationError('Lütfen e-posta ve şifre alanlarını doldurun.');
        }
        await this.#requireDatabase();

        const record = await this.#users.findRegisteredByEmailWithPassword(email);
        const isMatch = record && await bcrypt.compare(password, record.password_hash);
        if (!isMatch) {
            throw new UnauthorizedError('Hatalı e-posta veya şifre.');
        }

        logger.success(`👤 Kullanıcı giriş yaptı: ${email}`);
        const { password_hash: _omit, ...user } = record;
        return user;
    }

    /**
     * Cihaz UUID'si ile misafir oturumu açar; misafir yoksa oluşturur.
     * Kayıtlı bir hesaba ait UUID ile şifresiz giriş yapılmasına izin verilmez.
     * @returns {Promise<{user: Object, created: boolean}>}
     */
    async guestLogin(deviceUuid) {
        if (!deviceUuid) {
            throw new ValidationError('Cihaz UUID kodu gerekli.');
        }
        await this.#requireDatabase();

        const existing = await this.#users.findByUuid(deviceUuid);
        if (existing) {
            if (existing.user_type !== 'guest') {
                throw new ForbiddenError('Bu cihaz kimliği kayıtlı bir hesaba ait. Lütfen e-posta ve şifrenizle giriş yapın.');
            }
            logger.info(`👤 Mevcut misafir girişi: ${deviceUuid}`);
            return { user: existing, created: false };
        }

        const user = await this.#users.createGuest(deviceUuid);
        logger.success(`👤 Yeni misafir kaydedildi: ${deviceUuid}`);
        return { user, created: true };
    }

    /** Misafir hesabı kayıtlı üyeliğe yükseltir. Kayıtlı hesaplar yükseltilemez. */
    async upgrade({ deviceUuid, name, email, password }) {
        if (!deviceUuid || !name || !email || !password) {
            throw new ValidationError('Eksik parametreler.');
        }
        await this.#requireDatabase();

        const existing = await this.#users.findByUuid(deviceUuid);
        if (!existing || existing.user_type !== 'guest') {
            throw new NotFoundError('Yükseltilecek misafir oturumu bulunamadı.');
        }
        if (await this.#users.emailExists(email, deviceUuid)) {
            throw new ValidationError('Bu e-posta adresi başka bir kayıtlı kullanıcıya ait.');
        }

        const user = await this.#users.upgradeGuest(deviceUuid, {
            name,
            email,
            passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        });
        if (!user) {
            throw new NotFoundError('Yükseltilecek misafir oturumu bulunamadı.');
        }
        logger.success(`👤 Hesap yükseltildi (Misafir -> Kayıtlı): ${email}`);
        return user;
    }

    async #requireDatabase() {
        if (!(await this.#db.ensureConnected())) {
            throw new ServiceUnavailableError('Veritabanı şu anda çevrimdışı. Lütfen biraz sonra tekrar deneyin.');
        }
    }
}

module.exports = AuthService;
