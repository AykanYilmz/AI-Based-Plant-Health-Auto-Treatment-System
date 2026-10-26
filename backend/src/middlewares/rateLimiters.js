const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const logger = require('../utils/logger');
const CredentialPolicy = require('../domain/CredentialPolicy');

const MINUTE = 60 * 1000;

/** Limit aşıldığında diğer hatalarla aynı `{ basarili, hata }` biçiminde 429 döner. */
function createLimiter({ name, message, ...options }) {
    return rateLimit({
        standardHeaders: 'draft-8', // RateLimit ve Retry-After header'ları
        legacyHeaders: false,
        ...options,
        handler: (req, res, next, opts) => {
            logger.warn(`🚦 Rate limit aşıldı (${name}): ${req.method} ${req.originalUrl} | IP: ${req.ip}`);
            res.status(opts.statusCode).json({
                basarili: false,
                hata: message,
                kod: 'RATE_LIMITED',
                tekrar_dene_saniye: Math.ceil(opts.windowMs / 1000),
            });
        },
    });
}

/**
 * Uygulamadaki istek sınırlayıcıları. Sayaçlar bellekte tutulur (tek sunucu süreci için yeterli).
 * Sunucu bir ters proxy (nginx vb.) arkasındaysa gerçek istemci IP'si için TRUST_PROXY ayarlanmalıdır.
 */
function createRateLimiters() {
    return {
        /** Tüm /api istekleri için genel üst sınır (IP başına) */
        api: createLimiter({
            name: 'api',
            windowMs: 15 * MINUTE,
            limit: 300,
            message: 'Çok fazla istek gönderildi. Lütfen biraz sonra tekrar deneyin.',
        }),

        /** Başarısız giriş denemeleri (IP + e-posta başına; başarılı girişler sayılmaz) — brute-force koruması */
        login: createLimiter({
            name: 'login',
            windowMs: 15 * MINUTE,
            limit: 10,
            skipSuccessfulRequests: true,
            keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${CredentialPolicy.normalizeEmail(req.body?.email)}`,
            message: 'Çok fazla başarısız giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.',
        }),

        /** Kayıt, misafir girişi, token yenileme ve hesap yükseltme (IP başına) */
        auth: createLimiter({
            name: 'auth',
            windowMs: 15 * MINUTE,
            limit: 30,
            message: 'Çok fazla oturum işlemi yapıldı. Lütfen biraz sonra tekrar deneyin.',
        }),

        /** AI teşhisi pahalı bir işlemdir; kullanıcı başına sınırlanır (authenticate'ten sonra kullanılmalı) */
        diagnose: createLimiter({
            name: 'diagnose',
            windowMs: MINUTE,
            limit: 10,
            keyGenerator: (req) => (req.user?.uuid ? `user:${req.user.uuid}` : ipKeyGenerator(req.ip)),
            message: 'Kısa sürede çok fazla analiz yapıldı. Lütfen bir dakika bekleyip tekrar deneyin.',
        }),
    };
}

module.exports = createRateLimiters;
