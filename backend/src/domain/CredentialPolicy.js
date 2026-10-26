const { ValidationError } = require('../errors/AppError');

/**
 * Kullanıcı adı, e-posta ve şifre kuralları. Mobil uygulamadaki
 * `src/utils/credentialRules.js` ile aynı kuralları uygular (istemci kontrolü atlanabileceği için
 * asıl doğrulama burada yapılır).
 */
class CredentialPolicy {
    static NAME_MIN = 2;
    static NAME_MAX = 50;
    static EMAIL_MAX = 100;   // users.email kolonu VARCHAR(100)
    static PASSWORD_MIN = 8;
    static PASSWORD_MAX = 72; // bcrypt 72 bayttan sonrasını yok sayar

    // Pratik bir doğrulama: boşluksuz yerel kısım @ alan adı . en az 2 harfli uzantı
    static #EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    /** E-postayı karşılaştırma ve saklama için tek biçime getirir. */
    static normalizeEmail(email) {
        return String(email ?? '').trim().toLowerCase();
    }

    static normalizeName(name) {
        return String(name ?? '').trim().replace(/\s+/g, ' ');
    }

    /**
     * Kayıt ve hesap yükseltme verisini doğrular ve normalize eder.
     * @returns {{ name: string, email: string, password: string }}
     * @throws {ValidationError}
     */
    static validateRegistration({ name, email, password }) {
        if (!name || !email || !password) {
            throw new ValidationError('Lütfen isim, e-posta ve şifre alanlarını doldurun.');
        }

        const normalizedName = CredentialPolicy.normalizeName(name);
        if (normalizedName.length < CredentialPolicy.NAME_MIN || normalizedName.length > CredentialPolicy.NAME_MAX) {
            throw new ValidationError(`İsim ${CredentialPolicy.NAME_MIN}-${CredentialPolicy.NAME_MAX} karakter arasında olmalıdır.`);
        }

        return {
            name: normalizedName,
            email: CredentialPolicy.validateEmail(email),
            password: CredentialPolicy.validatePassword(password),
        };
    }

    /** @returns {string} Normalize edilmiş e-posta */
    static validateEmail(email) {
        const normalized = CredentialPolicy.normalizeEmail(email);
        if (normalized.length > CredentialPolicy.EMAIL_MAX || !CredentialPolicy.#EMAIL_PATTERN.test(normalized)) {
            throw new ValidationError('Geçerli bir e-posta adresi girin.');
        }
        return normalized;
    }

    /** @returns {string} Şifrenin kendisi (şifreler normalize edilmez) */
    static validatePassword(password) {
        if (typeof password !== 'string') {
            throw new ValidationError('Geçersiz şifre.');
        }
        if (password.length < CredentialPolicy.PASSWORD_MIN) {
            throw new ValidationError(`Şifreniz en az ${CredentialPolicy.PASSWORD_MIN} karakter olmalıdır.`);
        }
        if (Buffer.byteLength(password, 'utf8') > CredentialPolicy.PASSWORD_MAX) {
            throw new ValidationError(`Şifreniz en fazla ${CredentialPolicy.PASSWORD_MAX} karakter olabilir.`);
        }
        if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(password) || !/\d/.test(password)) {
            throw new ValidationError('Şifreniz en az bir harf ve bir rakam içermelidir.');
        }
        return password;
    }
}

module.exports = CredentialPolicy;
