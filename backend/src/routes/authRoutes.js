const express = require('express');

/**
 * Kimlik doğrulama route'larını verilen controller örneğine bağlar.
 * @param {import('../controllers/AuthController')} controller
 * @param {import('express').RequestHandler} authenticate - Access token doğrulama middleware'i
 */
function createAuthRoutes(controller, authenticate) {
    const router = express.Router();

    // /api/auth/register
    router.post('/register', controller.register);

    // /api/auth/login
    router.post('/login', controller.login);

    // /api/auth/guest
    router.post('/guest', controller.guest);

    // /api/auth/refresh - Refresh token ile yeni token çifti al
    router.post('/refresh', controller.refresh);

    // /api/auth/logout - Refresh token'ı iptal et
    router.post('/logout', controller.logout);

    // /api/auth/upgrade - Oturumdaki misafir hesabı yükselt
    router.post('/upgrade', authenticate, controller.upgrade);

    return router;
}

module.exports = createAuthRoutes;
