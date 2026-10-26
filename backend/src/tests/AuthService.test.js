const bcrypt = require('bcryptjs');
const AuthService = require('../services/AuthService');
const { ForbiddenError, NotFoundError, UnauthorizedError, ServiceUnavailableError } = require('../errors/AppError');

jest.mock('../utils/logger');

const TOKENS = { accessToken: 'access', refreshToken: 'refresh', expiresIn: 3600 };

function createService({ connected = true } = {}) {
    const deps = {
        db: { ensureConnected: jest.fn().mockResolvedValue(connected) },
        userRepository: {
            findByUuid: jest.fn(),
            findRegisteredByEmailWithPassword: jest.fn(),
            emailExists: jest.fn().mockResolvedValue(false),
            createRegistered: jest.fn(),
            createGuest: jest.fn(),
            upgradeGuest: jest.fn(),
        },
        tokenService: {
            issueTokens: jest.fn().mockResolvedValue(TOKENS),
            consumeRefreshToken: jest.fn(),
            revokeRefreshToken: jest.fn(),
        },
    };
    return { service: new AuthService(deps), deps };
}

const registeredUser = { id: 1, uuid: 'reg-uuid', name: 'Ali', email: 'ali@x.com', user_type: 'registered' };
const guestUser = { id: 2, uuid: 'guest-uuid', name: 'Misafir', email: null, user_type: 'guest' };

describe('AuthService', () => {
    describe('guestLogin', () => {
        it('refuses a UUID that belongs to a registered account (no passwordless login)', async () => {
            const { service, deps } = createService();
            deps.userRepository.findByUuid.mockResolvedValue(registeredUser);

            await expect(service.guestLogin('reg-uuid')).rejects.toBeInstanceOf(ForbiddenError);
            expect(deps.tokenService.issueTokens).not.toHaveBeenCalled();
        });

        it('starts a session for the existing guest', async () => {
            const { service, deps } = createService();
            deps.userRepository.findByUuid.mockResolvedValue(guestUser);

            await expect(service.guestLogin('guest-uuid')).resolves.toEqual({ user: guestUser, tokens: TOKENS, created: false });
            expect(deps.tokenService.issueTokens).toHaveBeenCalledWith(guestUser);
        });

        it('creates a new guest for an unknown device', async () => {
            const { service, deps } = createService();
            deps.userRepository.findByUuid.mockResolvedValue(null);
            deps.userRepository.createGuest.mockResolvedValue(guestUser);

            await expect(service.guestLogin('new-uuid')).resolves.toEqual({ user: guestUser, tokens: TOKENS, created: true });
            expect(deps.userRepository.createGuest).toHaveBeenCalledWith('new-uuid');
        });
    });

    describe('upgrade', () => {
        it('refuses to take over a registered account', async () => {
            const { service, deps } = createService();
            deps.userRepository.findByUuid.mockResolvedValue(registeredUser);

            await expect(service.upgrade('reg-uuid', { name: 'X', email: 'x@x.com', password: 'p' }))
                .rejects.toBeInstanceOf(NotFoundError);
            expect(deps.userRepository.upgradeGuest).not.toHaveBeenCalled();
        });

        it('upgrades the authenticated guest account', async () => {
            const { service, deps } = createService();
            deps.userRepository.findByUuid.mockResolvedValue(guestUser);
            deps.userRepository.upgradeGuest.mockResolvedValue({ ...guestUser, user_type: 'registered' });

            const user = await service.upgrade('guest-uuid', { name: 'Ayşe', email: 'a@x.com', password: 'secret' });

            expect(user.user_type).toBe('registered');
            const [uuid, { passwordHash }] = deps.userRepository.upgradeGuest.mock.calls[0];
            expect(uuid).toBe('guest-uuid');
            await expect(bcrypt.compare('secret', passwordHash)).resolves.toBe(true);
        });
    });

    describe('login', () => {
        it('rejects a wrong password and never returns the hash', async () => {
            const { service, deps } = createService();
            deps.userRepository.findRegisteredByEmailWithPassword.mockResolvedValue({
                ...registeredUser,
                password_hash: await bcrypt.hash('correct', 4),
            });

            await expect(service.login({ email: 'ali@x.com', password: 'wrong' })).rejects.toBeInstanceOf(UnauthorizedError);
            const session = await service.login({ email: 'ali@x.com', password: 'correct' });
            expect(session).toEqual({ user: registeredUser, tokens: TOKENS });
        });

        it('throws ServiceUnavailableError when the database is offline', async () => {
            const { service } = createService({ connected: false });
            await expect(service.login({ email: 'a', password: 'b' })).rejects.toBeInstanceOf(ServiceUnavailableError);
        });
    });

    describe('refresh', () => {
        it('issues a new session for the refresh token owner', async () => {
            const { service, deps } = createService();
            deps.tokenService.consumeRefreshToken.mockResolvedValue({ userId: 2, userUuid: 'guest-uuid' });
            deps.userRepository.findByUuid.mockResolvedValue(guestUser);

            await expect(service.refresh('old-refresh')).resolves.toEqual({ user: guestUser, tokens: TOKENS });
            expect(deps.tokenService.consumeRefreshToken).toHaveBeenCalledWith('old-refresh');
        });
    });
});
