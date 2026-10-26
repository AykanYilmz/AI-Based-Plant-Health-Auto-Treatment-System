require('dotenv').config();
const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');
const createDiagnoseRoutes = require('./routes/diagnoseRoutes');
const createAuthRoutes = require('./routes/authRoutes');
const errorHandler = require('./middlewares/errorHandler');
const {
    db,
    aiClient,
    imageStorage,
    databaseInitializer,
    authController,
    diagnoseController,
} = require('./container');

const PORT = process.env.PORT || 3000;

/**
 * Express uygulamasını oluşturur ve tüm middleware ile route'ları bağlar.
 */
function createApp() {
    const app = express();

    // ─── Middleware ──────────────────────────────────────────
    app.use(cors());                         // Tüm origin'lerden erişime izin ver
    app.use(express.json({ limit: '15mb' })); // JSON body parser (Base64 görseller için yüksek limit)

    // ─── Statik Görsel Klasörü ───────────────────────────────
    app.use('/uploads', express.static(imageStorage.directory));

    // ─── Routes ─────────────────────────────────────────────
    app.use('/api', createDiagnoseRoutes(diagnoseController));
    app.use('/api/auth', createAuthRoutes(authController));

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

async function startServer() {
    logger.info('\n🌱 VerdantAI Backend başlatılıyor...\n');

    // 1. Veritabanını kontrol et ve otomatik kur (Fail-safe: hata durumunda sunucuyu çökertmez)
    await databaseInitializer.initialize();

    // 2. AI modellerini önceden belleğe yükle (Python daemon başlatılır)
    if (!(await aiClient.start())) {
        logger.error('❌ AI Daemon yüklenemedi! Sunucu kısıtlı modda (offline/no-ai) başlatılıyor.');
    }

    // 3. Express sunucusunu başlat
    createApp().listen(PORT, '0.0.0.0', () => {
        logger.success(`🚀 Sunucu http://localhost:${PORT} adresinde başarıyla çalışıyor`);
        logger.info(`📡 API Endpoint'leri:`);
        logger.info(`   POST /api/diagnose  → Fotoğraf yükle ve teşhis al`);
        logger.info(`   GET  /api/history   → Kullanıcının geçmiş teşhislerini getir`);
        logger.info(`   DELETE /api/history/:id → Belirli teşhis kaydını sil`);
        logger.info(`   GET  /api/labels    → Desteklenen bitki/hastalık listesi`);
        logger.info(`   GET  /api/health    → Sunucu ve servis sağlık durumunu kontrol et\n`);
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
