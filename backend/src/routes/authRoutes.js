const express = require('express');

/**
 * Kimlik doğrulama route'larını verilen controller örneğine bağlar.
 * @param {import('../controllers/AuthController')} controller
 */
function createAuthRoutes(controller) {
    const router = express.Router();

    // /api/auth/register
    router.post('/register', controller.register);

    // /api/auth/login
    router.post('/login', controller.login);

    // /api/auth/guest
    router.post('/guest', controller.guest);

    // /api/auth/upgrade
    router.post('/upgrade', controller.upgrade);

    return router;
}

module.exports = createAuthRoutes;
