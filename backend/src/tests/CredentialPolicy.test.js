const CredentialPolicy = require('../domain/CredentialPolicy');
const AuthService = require('../services/AuthService');
const { ValidationError } = require('../errors/AppError');

jest.mock('../utils/logger');

const valid = { name: '  Ayşe   Yılmaz ', email: '  Ayse@Ornek.COM ', password: 'bahce2026' };

describe('CredentialPolicy', () => {
    it('normalizes name and email', () => {
        expect(CredentialPolicy.validateRegistration(valid)).toEqual({
            name: 'Ayşe Yılmaz',
            email: 'ayse@ornek.com',
            password: 'bahce2026',
        });
    });

    it.each([
        ['ali@site.info'],
        ['ali.veli+tarim@firma.online'],
        ['a@b.co'],
    ])('accepts valid email %s (including long TLDs)', (email) => {
        expect(CredentialPolicy.validateEmail(email)).toBe(email);
    });

    it.each([
        ['ali'], ['ali@'], ['ali@site'], ['ali @site.com'], ['ali@site.c'], [`${'a'.repeat(95)}@x.com`],
    ])('rejects invalid email %s', (email) => {
        expect(() => CredentialPolicy.validateEmail(email)).toThrow(ValidationError);
    });

    it.each([
        ['kisa1', /en az 8/],
        ['sadeceharf', /harf ve bir rakam/],
        ['12345678', /harf ve bir rakam/],
        ['a1'.repeat(40), /en fazla 72/],
    ])('rejects weak password %s', (password, message) => {
        expect(() => CredentialPolicy.validatePassword(password)).toThrow(message);
    });

    it('accepts Turkish letters in passwords', () => {
        expect(CredentialPolicy.validatePassword('çiçek2026')).toBe('çiçek2026');
    });

    it('rejects too short names', () => {
        expect(() => CredentialPolicy.validateRegistration({ ...valid, name: ' A ' })).toThrow(/İsim/);
    });
});

describe('AuthService credential rules', () => {
    function createService() {
        const userRepository = {
            emailExists: jest.fn().mockResolvedValue(false),
            createRegistered: jest.fn(async (u) => ({ id: 1, uuid: u.uuid, name: u.name, email: u.email, user_type: 'registered' })),
            findRegisteredByEmailWithPassword: jest.fn().mockResolvedValue(null),
        };
        const service = new AuthService({
            db: { ensureConnected: jest.fn().mockResolvedValue(true) },
            userRepository,
            tokenService: { issueTokens: jest.fn().mockResolvedValue({}) },
        });
        return { service, userRepository };
    }

    it('stores the normalized email on register', async () => {
        const { service, userRepository } = createService();
        const { user } = await service.register(valid);

        expect(user.email).toBe('ayse@ornek.com');
        expect(userRepository.emailExists).toHaveBeenCalledWith('ayse@ornek.com');
    });

    it('rejects a weak password before touching the database', async () => {
        const { service, userRepository } = createService();
        await expect(service.register({ ...valid, password: '123' })).rejects.toBeInstanceOf(ValidationError);
        expect(userRepository.createRegistered).not.toHaveBeenCalled();
    });

    it('looks up logins by normalized email', async () => {
        const { service, userRepository } = createService();
        await expect(service.login({ email: ' ALI@X.com ', password: 'whatever' })).rejects.toThrow();
        expect(userRepository.findRegisteredByEmailWithPassword).toHaveBeenCalledWith('ali@x.com');
    });
});
