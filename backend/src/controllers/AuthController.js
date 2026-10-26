/**
 * Kimlik doğrulama HTTP uç noktaları. İş kuralları AuthService'tedir.
 */
class AuthController {
    #service;

    constructor(authService) {
        this.#service = authService;
    }

    /** POST /api/auth/register */
    register = async (req, res) => {
        const user = await this.#service.register(req.body || {});
        res.status(201).json({ basarili: true, user });
    };

    /** POST /api/auth/login */
    login = async (req, res) => {
        const user = await this.#service.login(req.body || {});
        res.json({ basarili: true, user });
    };

    /** POST /api/auth/guest */
    guest = async (req, res) => {
        const { user, created } = await this.#service.guestLogin(req.body?.deviceUuid);
        res.status(created ? 201 : 200).json({ basarili: true, user: { ...user, name: user.name || 'Misafir' } });
    };

    /** POST /api/auth/upgrade */
    upgrade = async (req, res) => {
        const user = await this.#service.upgrade(req.body || {});
        res.json({ basarili: true, user });
    };
}

module.exports = AuthController;
