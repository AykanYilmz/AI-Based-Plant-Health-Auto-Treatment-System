import { isValidEmail, passwordError, registrationError, PASSWORD_MIN } from '../utils/credentialRules';

describe('credentialRules', () => {
    it.each(['ali@site.info', 'ali.veli+tarim@firma.online', 'a@b.co', '  ayse@ornek.com  '])(
        'accepts %s (including long TLDs)',
        (email) => expect(isValidEmail(email)).toBe(true)
    );

    it.each(['ali', 'ali@', 'ali@site', 'ali @site.com', 'ali@site.c'])('rejects %s', (email) => {
        expect(isValidEmail(email)).toBe(false);
    });

    it('enforces the same password rules as the backend', () => {
        expect(passwordError('kisa1')).toMatch(`en az ${PASSWORD_MIN}`);
        expect(passwordError('sadeceharf')).toMatch('harf ve bir rakam');
        expect(passwordError('12345678')).toMatch('harf ve bir rakam');
        expect(passwordError('çiçek2026')).toBeNull();
    });

    it('reports the first registration form error', () => {
        const valid = { name: 'Ayşe', email: 'ayse@ornek.com', password: 'bahce2026', confirmPassword: 'bahce2026' };

        expect(registrationError(valid)).toBeNull();
        expect(registrationError({ ...valid, name: '' })).toBe('Lütfen tüm alanları doldurun.');
        expect(registrationError({ ...valid, name: 'A' })).toMatch('İsim');
        expect(registrationError({ ...valid, email: 'ayse@' })).toBe('Geçerli bir e-posta adresi girin.');
        expect(registrationError({ ...valid, confirmPassword: 'baska2026' })).toBe('Şifreler uyuşmuyor.');
    });
});
