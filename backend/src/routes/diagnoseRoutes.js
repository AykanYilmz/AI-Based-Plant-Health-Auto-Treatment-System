const express = require('express');
const upload = require('../middlewares/uploadMiddleware');

/**
 * Teşhis route'larını verilen controller örneğine bağlar.
 * @param {import('../controllers/DiagnoseController')} controller
 * @param {import('express').RequestHandler} authenticate - Access token doğrulama middleware'i
 * @param {ReturnType<import('../middlewares/rateLimiters')>} limiters
 */
function createDiagnoseRoutes(controller, authenticate, limiters) {
    const router = express.Router();

    // GET /api/labels - Desteklenen etiket listesi (herkese açık)
    router.get('/labels', controller.getLabels);

    // POST /api/diagnose - Fotoğraf yükle ve AI tahmin al
    // (Kimlik doğrulama ve kullanıcı başına sınır, büyük dosya belleğe alınmadan önce uygulanır)
    router.post('/diagnose', authenticate, limiters.diagnose, upload.single('image'), controller.diagnose);

    // GET /api/history - Kullanıcının teşhis geçmişini listele
    router.get('/history', authenticate, controller.getHistory);

    // DELETE /api/history/:id - Kullanıcının teşhis kaydını sil
    router.delete('/history/:id', authenticate, controller.deleteHistory);

    // DELETE /api/history - Kullanıcının tüm teşhis geçmişini sil
    router.delete('/history', authenticate, controller.deleteAllHistory);

    // GET /api/images/:filename - Kullanıcının kendi teşhis görseli
    router.get('/images/:filename', authenticate, controller.getImage);

    return router;
}

module.exports = createDiagnoseRoutes;
