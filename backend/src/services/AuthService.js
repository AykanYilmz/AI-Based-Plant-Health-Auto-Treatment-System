const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const logger = require('../utils/logger');
const CredentialPolicy = require('../domain/CredentialPolicy');
const {
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ServiceUnavailableError,
} = require('../errors/AppError');

const BCRYPT_ROUNDS = 10;

/**
 * Kayıt, giriş, misafir oturumu, hesap yükseltme ve oturum (token) yenileme iş kurallarını yönetir.
 * Başarılı her giriş `{ user, tokens }` döndürür.
 */
class AuthService {
    #db;
    #users;
    #tokens;

    constructor({ db, userRepository, tokenService }) {
        this.#db = db;
        this.#users = userRepository;
        this.#tokens = tokenService;
    }

    async register(input) {
        const { name, email, password } = CredentialPolicy.validateRegistration(input);
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
        return this.#startSession(user);
    }

    async login({ email: rawEmail, password }) {
        if (!rawEmail || !password) {
            throw new ValidationError('Lütfen e-posta ve şifre alanlarını doldurun.');
        }
        // Giriş sırasında şifre kuralları uygulanmaz (kurallardan önce açılmış hesaplar da girebilmeli)
        const email = CredentialPolicy.normalizeEmail(rawEmail);
        await this.#requireDatabase();

        const record = await this.#users.findRegisteredByEmailWithPassword(email);
        const isMatch = record && await bcrypt.compare(password, record.password_hash);
        if (!isMatch) {
            throw new UnauthorizedError('Hatalı e-posta veya şifre.');
        }

        logger.success(`👤 Kullanıcı giriş yaptı: ${email}`);
        const { password_hash: _omit, ...user } = record;
        return this.#startSession(user);
    }

    /**
     * Cihaz UUID'si ile misafir oturumu açar; misafir yoksa oluşturur.
     * Kayıtlı bir hesaba ait UUID ile şifresiz giriş yapılmasına izin verilmez.
     * @returns {Promise<{user: Object, tokens: Object, created: boolean}>}
     */
    async guestLogin(deviceUuid) {
        if (!deviceUuid) {
            throw new ValidationError('Cihaz UUID kodu gerekli.');
        }
        await this.#requireDatabase();

        let user = await this.#users.findByUuid(deviceUuid);
        const created = !user;
        if (user && user.user_type !== 'guest') {
            throw new ForbiddenError('Bu cihaz kimliği kayıtlı bir hesaba ait. Lütfen e-posta ve şifrenizle giriş yapın.');
        }

        if (created) {
            user = await this.#users.createGuest(deviceUuid);
            logger.success(`👤 Yeni misafir kaydedildi: ${deviceUuid}`);
        } else {
            logger.info(`👤 Mevcut misafir girişi: ${deviceUuid}`);
        }
        return { ...(await this.#startSession(user)), created };
    }

    /**
     * Oturumdaki misafir hesabı kayıtlı üyeliğe yükseltir. Kayıtlı hesaplar yükseltilemez.
     * @param {string} userUuid - Doğrulanmış access token'dan gelen kullanıcı kimliği
     */
    async upgrade(userUuid, input) {
        const { name, email, password } = CredentialPolicy.validateRegistration(input);
        await this.#requireDatabase();

        const existing = await this.#users.findByUuid(userUuid);
        if (!existing || existing.user_type !== 'guest') {
            throw new NotFoundError('Yükseltilecek misafir oturumu bulunamadı.');
        }
        if (await this.#users.emailExists(email, userUuid)) {
            throw new ValidationError('Bu e-posta adresi başka bir kayıtlı kullanıcıya ait.');
        }

        const user = await this.#users.upgradeGuest(userUuid, {
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

    /** Refresh token ile yeni bir token çifti üretir (eski refresh token geçersiz olur). */
    async refresh(refreshToken) {
        await this.#requireDatabase();
        const { userUuid } = await this.#tokens.consumeRefreshToken(refreshToken);

        const user = await this.#users.findByUuid(userUuid);
        if (!user) {
            throw new UnauthorizedError('Oturum bulunamadı. Lütfen tekrar giriş yapın.', { kod: 'REFRESH_INVALID' });
        }
        return this.#startSession(user);
    }

    async logout(refreshToken) {
        await this.#requireDatabase();
        await this.#tokens.revokeRefreshToken(refreshToken);
    }

    async #startSession(user) {
        return { user, tokens: await this.#tokens.issueTokens(user) };
    }

    async #requireDatabase() {
        if (!(await this.#db.ensureConnected())) {
            throw new ServiceUnavailableError('Veritabanı şu anda çevrimdışı. Lütfen biraz sonra tekrar deneyin.');
        }
    }
}

module.exports = AuthService;
