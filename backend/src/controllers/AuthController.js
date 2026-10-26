/**
 * Kimlik doğrulama HTTP uç noktaları. İş kuralları AuthService'tedir.
 * Oturum açan uç noktalar `{ basarili, user, accessToken, refreshToken, expiresIn }` döndürür.
 */
class AuthController {
    #service;

    constructor(authService) {
        this.#service = authService;
    }

    /** POST /api/auth/register */
    register = async (req, res) => {
        const session = await this.#service.register(req.body || {});
        res.status(201).json(AuthController.#sessionResponse(session));
    };

    /** POST /api/auth/login */
    login = async (req, res) => {
        const session = await this.#service.login(req.body || {});
        res.json(AuthController.#sessionResponse(session));
    };

    /** POST /api/auth/guest */
    guest = async (req, res) => {
        const session = await this.#service.guestLogin(req.body?.deviceUuid);
        res.status(session.created ? 201 : 200).json(AuthController.#sessionResponse(session));
    };

    /** POST /api/auth/refresh — { refreshToken } */
    refresh = async (req, res) => {
        const session = await this.#service.refresh(req.body?.refreshToken);
        res.json(AuthController.#sessionResponse(session));
    };

    /** POST /api/auth/logout — { refreshToken } */
    logout = async (req, res) => {
        await this.#service.logout(req.body?.refreshToken);
        res.json({ basarili: true });
    };

    /** POST /api/auth/upgrade (giriş gerekli) */
    upgrade = async (req, res) => {
        const user = await this.#service.upgrade(req.user.uuid, req.body || {});
        res.json({ basarili: true, user });
    };

    static #sessionResponse({ user, tokens }) {
        return {
            basarili: true,
            user: { ...user, name: user.name || 'Misafir' },
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
        };
    }
}

module.exports = AuthController;
