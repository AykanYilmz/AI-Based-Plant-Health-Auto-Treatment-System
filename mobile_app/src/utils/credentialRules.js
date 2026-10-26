/**
 * Kayıt / hesap yükseltme formları için istemci tarafı kurallar.
 * Backend'deki `backend/src/domain/CredentialPolicy.js` ile aynı kuralları uygular;
 * asıl doğrulama sunucuda yapılır, burada yalnızca kullanıcıya erken geri bildirim verilir.
 */
export const PASSWORD_MIN = 8;
const NAME_MIN = 2;
const NAME_MAX = 50;
const EMAIL_MAX = 100;
const PASSWORD_MAX = 72;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email) {
    const normalized = String(email ?? '').trim();
    return normalized.length <= EMAIL_MAX && EMAIL_PATTERN.test(normalized);
}

/** @returns {string|null} Hata mesajı; şifre geçerliyse null */
export function passwordError(password) {
    if (!password || password.length < PASSWORD_MIN) {
        return `Şifreniz en az ${PASSWORD_MIN} karakter olmalıdır.`;
    }
    if (password.length > PASSWORD_MAX) {
        return `Şifreniz en fazla ${PASSWORD_MAX} karakter olabilir.`;
    }
    if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(password) || !/\d/.test(password)) {
        return 'Şifreniz en az bir harf ve bir rakam içermelidir.';
    }
    return null;
}

/**
 * Kayıt formunu doğrular.
 * @returns {string|null} İlk hata mesajı; form geçerliyse null
 */
export function registrationError({ name, email, password, confirmPassword }) {
    const trimmedName = String(name ?? '').trim();
    if (!trimmedName || !String(email ?? '').trim() || !password || !confirmPassword) {
        return 'Lütfen tüm alanları doldurun.';
    }
    if (trimmedName.length < NAME_MIN || trimmedName.length > NAME_MAX) {
        return `İsim ${NAME_MIN}-${NAME_MAX} karakter arasında olmalıdır.`;
    }
    if (!isValidEmail(email)) {
        return 'Geçerli bir e-posta adresi girin.';
    }
    const pwError = passwordError(password);
    if (pwError) return pwError;
    if (password !== confirmPassword) {
        return 'Şifreler uyuşmuyor.';
    }
    return null;
}
