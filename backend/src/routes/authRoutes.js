const express = require('express');

/**
 * Kimlik doğrulama route'larını verilen controller örneğine bağlar.
 * @param {import('../controllers/AuthController')} controller
 * @param {import('express').RequestHandler} authenticate - Access token doğrulama middleware'i
 * @param {ReturnType<import('../middlewares/rateLimiters')>} limiters
 */
function createAuthRoutes(controller, authenticate, limiters) {
    const router = express.Router();

    // /api/auth/login - Başarısız denemeler ayrıca IP + e-posta başına sınırlanır
    router.post('/login', limiters.login, controller.login);

    // Diğer oturum işlemleri IP başına sınırlanır
    router.use(limiters.auth);

    // /api/auth/register
    router.post('/register', controller.register);

    // /api/auth/guest
    router.post('/guest', controller.guest);

    // /api/auth/refresh - Refresh token ile yeni token çifti al
    router.post('/refresh', controller.refresh);

    // /api/auth/logout - Refresh token'ı iptal et
    router.post('/logout', controller.logout);

    // /api/auth/upgrade - Oturumdaki misafir hesabı yükselt
    router.post('/upgrade', authenticate, controller.upgrade);

    // /api/auth/account - Hesabı ve tüm verileri kalıcı olarak sil
    router.delete('/account', authenticate, controller.deleteAccount);

    return router;
}

module.exports = createAuthRoutes;
