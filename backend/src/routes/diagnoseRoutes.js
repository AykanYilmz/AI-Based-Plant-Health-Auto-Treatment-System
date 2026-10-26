const express = require('express');
const upload = require('../middlewares/uploadMiddleware');

/**
 * Teşhis route'larını verilen controller örneğine bağlar.
 * @param {import('../controllers/DiagnoseController')} controller
 */
function createDiagnoseRoutes(controller) {
    const router = express.Router();

    // POST /api/diagnose - Fotoğraf yükle ve AI tahmin al
    router.post('/diagnose', upload.single('image'), controller.diagnose);

    // GET /api/labels - Desteklenen etiket listesi
    router.get('/labels', controller.getLabels);

    // GET /api/history - Teşhis geçmişini listele
    router.get('/history', controller.getHistory);

    // DELETE /api/history/:id - Teşhis kaydını sil
    router.delete('/history/:id', controller.deleteHistory);

    // DELETE /api/history - Tüm teşhis geçmişini sil
    router.delete('/history', controller.deleteAllHistory);

    return router;
}

module.exports = createDiagnoseRoutes;
