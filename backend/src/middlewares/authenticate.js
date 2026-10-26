const { UnauthorizedError } = require('../errors/AppError');

/**
 * `Authorization: Bearer <access token>` header'ını doğrulayan middleware üretir.
 * Başarılı olursa `req.user = { uuid }` atanır; aksi halde 401 döner.
 * @param {import('../services/TokenService')} tokenService
 */
function createAuthenticate(tokenService) {
    return function authenticate(req, res, next) {
        const [scheme, token] = (req.get('authorization') || '').split(' ');
        if (scheme !== 'Bearer' || !token) {
            throw new UnauthorizedError('Bu işlem için giriş yapmanız gerekiyor.', { kod: 'TOKEN_MISSING' });
        }
        req.user = tokenService.verifyAccessToken(token);
        next();
    };
}

module.exports = createAuthenticate;
