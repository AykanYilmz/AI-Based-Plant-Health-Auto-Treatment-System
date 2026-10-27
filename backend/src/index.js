require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { requireHttps, isHttpsRequired } = require('./middlewares/requireHttps');
const createRateLimiters = require('./middlewares/rateLimiters');
const logger = require('./utils/logger');
const createDiagnoseRoutes = require('./routes/diagnoseRoutes');
const createAuthRoutes = require('./routes/authRoutes');
const errorHandler = require('./middlewares/errorHandler');
const {
    db,
    aiClient,
    refreshTokenRepository,
    databaseInitializer,
    authenticate,
    authController,
    diagnoseController,
} = require('./container');

const PORT = process.env.PORT || 3000;

/**
 * CORS yalnızca tarayıcıları ilgilendirir; mobil uygulama Origin göndermediği için her zaman geçer.
 * Tarayıcıdan (Expo web) erişebilecek origin'ler CORS_ORIGINS ile virgülle ayrılarak verilir;
 * tanımlı değilse geliştirme için yalnızca localhost origin'lerine izin verilir.
 */
function createCorsOptions() {
    const allowed = (process.env.CORS_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
    const isLocalhost = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

    return {
        origin: (origin, callback) => {
            if (!origin || allowed.includes(origin) || (allowed.length === 0 && isLocalhost(origin))) {
                return callback(null, true);
            }
            callback(null, false); // CORS header'ı eklenmez; tarayıcı yanıtı engeller
        },
    };
}

/**
 * Express uygulamasını oluşturur ve tüm middleware ile route'ları bağlar.
 */
function createApp() {
    const app = express();
    const limiters = createRateLimiters();

    // Ters proxy (nginx vb.) arkasında gerçek istemci IP'sini görmek için (rate limit buna dayanır)
    if (process.env.TRUST_PROXY) {
        app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);
    }

    // ─── Güvenlik Middleware ─────────────────────────────────
    if (isHttpsRequired()) {
        app.use(requireHttps);
    }
    app.use(helmet({
        // Görseller Expo web (farklı port) tarafından da yüklenebilsin
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    }));
    app.use(cors(createCorsOptions()));
    app.use(express.json({ limit: '100kb' })); // Yalnızca küçük JSON gövdeleri (görseller multipart ile gelir)

    // ─── Routes ─────────────────────────────────────────────
    // Not: Teşhis görselleri herkese açık statik klasörden değil, sahiplik kontrolü yapan
    // GET /api/images/:filename uç noktasından servis edilir.
    app.use('/api', limiters.api);
    app.use('/api/auth', createAuthRoutes(authController, authenticate, limiters));
    app.use('/api', createDiagnoseRoutes(diagnoseController, authenticate, limiters));

    // ─── Sağlık Kontrolü (Fail-Safe Destekli) ────────────────
    app.get('/api/health', (req, res) => {
        res.json({
            durum: 'çalışıyor',
            sunucu: 'VerdantAI Backend',
            veritabani: db.isConnected ? 'online' : 'offline',
            ai_daemon: aiClient.isReady ? 'online' : 'offline',
            zaman: new Date().toISOString()
        });
    });

    // ─── Hata Yakalama ───────────────────────────────────────
    app.use(errorHandler);

    return app;
}

/**
 * TLS_CERT_PATH ve TLS_KEY_PATH verilmişse HTTPS, aksi halde HTTP sunucusu oluşturur.
 * Canlıda genellikle TLS'i Caddy/nginx gibi bir ters proxy sonlandırır; bu durumda HTTP yeterlidir.
 */
function createServer(app) {
    const { TLS_CERT_PATH, TLS_KEY_PATH } = process.env;
    if (TLS_CERT_PATH && TLS_KEY_PATH) {
        const server = https.createServer({
            cert: fs.readFileSync(TLS_CERT_PATH),
            key: fs.readFileSync(TLS_KEY_PATH),
        }, app);
        return { server, protocol: 'https' };
    }
    return { server: http.createServer(app), protocol: 'http' };
}

async function startServer() {
    logger.info('\n🌱 VerdantAI Backend başlatılıyor...\n');

    // 1. Veritabanını kontrol et ve otomatik kur (Fail-safe: hata durumunda sunucuyu çökertmez)
    if (await databaseInitializer.initialize()) {
        const removed = await refreshTokenRepository.deleteExpired();
        if (removed) logger.info(`🧹 Süresi dolmuş ${removed} oturum kaydı temizlendi.`);
    }

    // 2. AI modellerini önceden belleğe yükle (Python daemon başlatılır)
    if (!(await aiClient.start())) {
        logger.error('❌ AI Daemon yüklenemedi! Sunucu kısıtlı modda (offline/no-ai) başlatılıyor.');
    }

    // 3. Express sunucusunu başlat (sertifika verilmişse doğrudan HTTPS)
    const { server, protocol } = createServer(createApp());
    if (isHttpsRequired() && protocol === 'http' && !process.env.TRUST_PROXY) {
        logger.warn('⚠️ HTTPS zorunlu ama sunucu HTTP çalışıyor ve TRUST_PROXY ayarlı değil: tüm API istekleri reddedilecek. TLS_CERT_PATH/TLS_KEY_PATH verin veya HTTPS sonlandıran bir ters proxy arkasında TRUST_PROXY ayarlayın.');
    }
    server.listen(PORT, '0.0.0.0', () => {
        logger.success(`🚀 Sunucu ${protocol}://localhost:${PORT} adresinde başarıyla çalışıyor`);
        if (isHttpsRequired()) logger.info('🔐 HTTPS zorunlu: şifrelenmemiş istekler reddediliyor.');
        logger.info(`📡 API Endpoint'leri:`);
        logger.info(`   POST /api/auth/{register,login,guest,refresh,logout,upgrade} → Oturum işlemleri`);
        logger.info(`   DELETE /api/auth/account → Hesabı ve tüm verileri sil 🔒`);
        logger.info(`   POST /api/diagnose  → Fotoğraf yükle ve teşhis al 🔒`);
        logger.info(`   GET  /api/history   → Kullanıcının geçmiş teşhislerini getir 🔒`);
        logger.info(`   DELETE /api/history/:id → Belirli teşhis kaydını sil 🔒`);
        logger.info(`   GET  /api/images/:filename → Teşhis görseli 🔒`);
        logger.info(`   GET  /api/labels    → Desteklenen bitki/hastalık listesi`);
        logger.info(`   GET  /api/health    → Sunucu ve servis sağlık durumunu kontrol et`);
        logger.info(`   🔒 = Authorization: Bearer <accessToken> gerekli\n`);
    });
}

// ─── Graceful Shutdown (Güvenli Kapatma) ──────────────────
// Sunucu kapandığında Python AI Daemon sürecini de temiz kapatır.
// Bu mekanizma zombi Python süreçlerinin OS'ta kalmasını önler.
function gracefulShutdown(signal) {
    logger.info(`\n🛑 ${signal} sinyali alındı, sunucu kapatılıyor...`);
    aiClient.stop();
    process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('exit', () => aiClient.stop()); // Windows: Ctrl+C veya pencere kapatma

// Yakalanmamış hatalarda da daemon'u temizle
process.on('uncaughtException', (err) => {
    logger.error('Yakalanmamış Hata', err);
    gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
    logger.error('İşlenmeyen Promise Reddi', reason instanceof Error ? reason : new Error(String(reason)));
    gracefulShutdown('unhandledRejection');
});

startServer();
