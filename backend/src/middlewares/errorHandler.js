const logger = require('../utils/logger');
const { AppError } = require('../errors/AppError');

/**
 * Global hata yakalayıcı. AppError'lar kendi durum kodu ve mesajıyla döner;
 * beklenmeyen hatalarda iç detaylar istemciye sızdırılmaz.
 */
// Express hata middleware'i olarak tanınması için 4 parametre (next dahil) zorunludur
function errorHandler(err, req, res, next) {
    if (err instanceof AppError) {
        if (err.statusCode >= 500) logger.warn(`${err.name}: ${err.message}`);
        return res.status(err.statusCode).json({ basarili: false, hata: err.message, ...err.details });
    }

    // Multer dosya boyutu hatası
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            basarili: false,
            hata: 'Dosya boyutu çok büyük. Maksimum 10 MB yükleyebilirsiniz.'
        });
    }

    // Bozuk JSON gövdesi
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ basarili: false, hata: 'İstek gövdesi geçerli bir JSON değil.' });
    }

    logger.error(`Sunucu Hatası (${req.method} ${req.originalUrl})`, err);
    return res.status(500).json({
        basarili: false,
        hata: 'Beklenmeyen bir sunucu hatası oluştu.'
    });
}

module.exports = errorHandler;
