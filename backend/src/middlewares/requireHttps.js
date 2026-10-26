const { ForbiddenError } = require('../errors/AppError');

/**
 * Şifrelenmemiş (HTTP) istekleri reddeder; şifreler ve oturum token'ları ağda açık gitmez.
 *
 * `req.secure`, sunucu doğrudan TLS ile çalışıyorsa veya `trust proxy` ayarlıyken ters proxy
 * `X-Forwarded-Proto: https` gönderiyorsa true olur. Sağlık kontrolü, yük dengeleyicilerin
 * iç ağdan HTTP ile yoklayabilmesi için muaf tutulur.
 */
function requireHttps(req, res, next) {
    if (req.secure || req.path === '/api/health') return next();
    throw new ForbiddenError('Güvenli bağlantı (HTTPS) gerekli.', { kod: 'HTTPS_REQUIRED' });
}

/** Canlı ortamda varsayılan olarak açıktır; geliştirmede REQUIRE_HTTPS=true ile denenebilir. */
function isHttpsRequired() {
    if (process.env.REQUIRE_HTTPS) return process.env.REQUIRE_HTTPS === 'true';
    return process.env.NODE_ENV === 'production';
}

module.exports = { requireHttps, isHttpsRequired };
