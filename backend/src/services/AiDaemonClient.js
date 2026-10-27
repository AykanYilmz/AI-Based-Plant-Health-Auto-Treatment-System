const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const logger = require('../utils/logger');
const PlantCatalog = require('../domain/PlantCatalog');
const { toPredictionResult } = require('../dto/predictionMapper');
const { ServiceUnavailableError } = require('../errors/AppError');

const STARTUP_TIMEOUT_MS = 120000;  // Model yükleme için 2 dakika limit
const HEALTH_POLL_INTERVAL_MS = 1000;
const REQUEST_TIMEOUT_MS = 60000;
const FORCE_KILL_DELAY_MS = 5000;
const CONNECTION_ERROR_CODES = ['ECONNREFUSED', 'EPIPE', 'ECONNRESET', 'ETIMEDOUT'];

/**
 * Modelleri RAM'de sıcak tutan Python AI daemon sürecini yönetir ve ona HTTP ile istek gönderir.
 * Daemon çökerse ilk başarısız istekte otomatik olarak yeniden başlatılır (self-healing).
 */
class AiDaemonClient {
    #paths;
    #pythonExecutable;
    #host;
    #port;
    #spawnProcess;
    #process = null;
    #ready = false;
    #classNames = [];
    #restartPromise = null;

    /**
     * @param {object} options
     * @param {Function} [options.spawnProcess] - Süreç başlatıcı (testlerde gerçek Python yerine sahtesi verilir)
     */
    constructor({ paths, pythonExecutable = 'python', host = '127.0.0.1', port = 5005, spawnProcess = spawn }) {
        this.#paths = paths;
        this.#pythonExecutable = pythonExecutable;
        this.#host = host;
        this.#port = port;
        this.#spawnProcess = spawnProcess;
    }

    get isReady() {
        return this.#ready && this.#process !== null;
    }

    /**
     * Model dosyalarını doğrular, sınıf isimlerini yükler ve daemon'u başlatır.
     * @returns {Promise<boolean>} Daemon hazır hale geldiyse true
     */
    async start() {
        try {
            if (!this.#verifyModelFiles()) return false;
            this.#loadClassNames();

            logger.info('🚀 AI Inference Daemon başlatılıyor...');
            const proc = this.#spawnDaemon();

            const ready = await this.#waitUntilReady(proc);
            if (!ready) {
                logger.error('❌ AI Daemon başlatılamadı! Timeout süresi doldu.');
                this.stop();
                return false;
            }

            this.#ready = true;
            logger.success('🌿 3 Katmanlı AI Pipeline (Daemon Modu) başarıyla çalışıyor!');
            logger.info(`   🔗 Daemon bağlantısı: http://${this.#host}:${this.#port}\n`);
            return true;
        } catch (error) {
            logger.error('Model yükleme hatası', error);
            return false;
        }
    }

    /**
     * Görüntüyü 3 katmanlı pipeline ile analiz eder.
     * @param {Buffer} imageBuffer - JPEG/PNG ham görüntü verisi
     * @returns {Promise<Object>} Pipeline sonucu ({ basarili, ... })
     * @throws {ServiceUnavailableError} Daemon çalışmıyor ve yeniden başlatılamıyorsa
     */
    async predict(imageBuffer) {
        if (!this.isReady && !(await this.#restart())) {
            throw new ServiceUnavailableError('Yapay zeka servisi şu anda çalışmıyor. Lütfen biraz sonra tekrar deneyin.');
        }

        try {
            return await this.#sendPredictRequest(imageBuffer);
        } catch (err) {
            if (!AiDaemonClient.#isConnectionError(err)) {
                logger.error('Çıkarım (Inference) Hatası:', err);
                return { basarili: false, hata: 'Tahmin işlemi sırasında bir hata oluştu: ' + err.message };
            }

            logger.error(`⚠️ AI Daemon ile iletişim kurulamadı (${err.code || err.message}). Otomatik kurtarma başlatılıyor...`);
            if (!(await this.#restart())) {
                logger.error('❌ AI Daemon otomatik kurtarma başarısız oldu.');
                return { basarili: false, hata: 'AI Daemon bağlantısı kesildi ve otomatik kurtarma mekanizması başarısız oldu.' };
            }

            logger.success('✅ AI Daemon başarıyla kurtarıldı! Teşhis isteği yeniden gönderiliyor...');
            try {
                return await this.#sendPredictRequest(imageBuffer);
            } catch (retryErr) {
                logger.error('❌ Kurtarma sonrasında da istek başarısız oldu:', retryErr);
                return { basarili: false, hata: 'AI Daemon kurtarıldı fakat analiz yine de gerçekleştirilemedi: ' + retryErr.message };
            }
        }
    }

    /** Desteklenen bitki türlerini döndürür */
    getLabels() {
        return this.#classNames.map((name, index) => ({
            index,
            key: name,
            isim: PlantCatalog.plantDisplayName(name),
        }));
    }

    /** Python daemon sürecini temiz bir şekilde kapatır. */
    stop() {
        const proc = this.#process;
        if (!proc) return;

        logger.info('🛑 AI Daemon durduruluyor...');
        this.#process = null;
        this.#ready = false;

        // Belirli süre içinde kapanmazsa zorla öldür
        const forceKillTimer = setTimeout(() => {
            logger.warn('⚠️ Daemon SIGTERM\'e yanıt vermedi, SIGKILL gönderiliyor...');
            proc.kill('SIGKILL');
        }, FORCE_KILL_DELAY_MS);
        forceKillTimer.unref();

        proc.once('exit', () => {
            clearTimeout(forceKillTimer);
            logger.success('✅ AI Daemon başarıyla kapatıldı.');
        });
        proc.kill('SIGTERM');
    }

    // ─── Özel yardımcılar ─────────────────────────────────────

    #verifyModelFiles() {
        const requiredFiles = [
            { path: this.#paths.YOLO_MODEL_PATH, name: 'YOLO Model (yolo_leaf_best.pt)' },
            { path: this.#paths.PLANT_MODEL_PATH, name: 'Bitki Sınıflandırma (plant_mobilenetv3large_best.keras)' },
            { path: this.#paths.CLASS_NAMES_PATH, name: 'Sınıf İsimleri (class_names.txt)' },
            { path: this.#paths.PIPELINE_SCRIPT, name: 'Pipeline Script (predict_pipeline.py)' },
        ];

        for (const file of requiredFiles) {
            if (!fs.existsSync(file.path)) {
                logger.error(`${file.name} bulunamadı: ${file.path}`);
                return false;
            }
            logger.info(`✅ ${file.name} (${AiDaemonClient.#sizeInMb(file.path)} MB)`);
        }

        const diseaseDir = this.#paths.DISEASE_MODELS_DIR;
        if (fs.existsSync(diseaseDir)) {
            const diseaseFiles = fs.readdirSync(diseaseDir).filter(f => f.endsWith('.keras'));
            logger.success(`Hastalık Modelleri: ${diseaseFiles.length} model bulundu`);
            diseaseFiles.forEach(f => {
                const plantName = PlantCatalog.plantDisplayName(f.replace('_disease_model.keras', ''));
                logger.info(`   🔬 ${plantName} hastalık modeli (${AiDaemonClient.#sizeInMb(path.join(diseaseDir, f))} MB)`);
            });
        } else {
            logger.warn('⚠️ Hastalık modelleri klasörü bulunamadı:', diseaseDir);
        }
        return true;
    }

    #loadClassNames() {
        const rawNames = fs.readFileSync(this.#paths.CLASS_NAMES_PATH, 'utf-8');
        this.#classNames = rawNames.split('\n').map(l => l.trim()).filter(Boolean);
        logger.success(`${this.#classNames.length} bitki türü başarıyla yüklendi: [${this.#classNames.join(', ')}]`);
    }

    #spawnDaemon() {
        const proc = this.#spawnProcess(this.#pythonExecutable, [
            this.#paths.PIPELINE_SCRIPT,
            '--server',
            this.#paths.YOLO_MODEL_PATH,
            this.#paths.PLANT_MODEL_PATH,
            this.#paths.CLASS_NAMES_PATH,
            this.#paths.DISEASE_MODELS_DIR,
            '--port', String(this.#port),
        ], { stdio: ['ignore', 'pipe', 'pipe'] });

        proc.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) logger.python(msg);
        });
        proc.stdout.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) logger.python(`[stdout] ${msg}`);
        });

        // Durum yalnızca hâlâ aktif süreç bu ise sıfırlanır; eski bir sürecin geç gelen
        // exit olayı yeniden başlatılmış yeni süreci etkilemez.
        const detach = () => {
            if (this.#process === proc) {
                this.#process = null;
                this.#ready = false;
            }
        };
        proc.on('error', (err) => {
            logger.error('Python daemon başlatma hatası', err);
            detach();
        });
        proc.on('exit', (code, signal) => {
            logger.warn(`⚠️ Python daemon sonlandı (code=${code}, signal=${signal})`);
            detach();
        });

        this.#process = proc;
        return proc;
    }

    /** Daemon'un hazır olmasını health endpoint üzerinden bekler. */
    #waitUntilReady(proc) {
        const healthUrl = `http://${this.#host}:${this.#port}/health`;
        const startTime = Date.now();

        return new Promise((resolve) => {
            const scheduleNext = () => {
                if (Date.now() - startTime > STARTUP_TIMEOUT_MS) return resolve(false);
                setTimeout(poll, HEALTH_POLL_INTERVAL_MS);
            };

            const poll = () => {
                if (this.#process !== proc) return resolve(false); // Süreç öldü veya değiştirildi

                const req = http.get(healthUrl, (res) => {
                    let body = '';
                    res.on('data', (chunk) => { body += chunk; });
                    res.on('end', () => {
                        try {
                            if (JSON.parse(body).status === 'ready') return resolve(true);
                        } catch { /* Henüz hazır değil */ }
                        scheduleNext();
                    });
                });
                req.on('error', scheduleNext);
                req.end();
            };

            poll();
        });
    }

    /**
     * Daemon'u yeniden başlatır (Self-Healing). Aynı anda gelen istekler tek bir
     * yeniden başlatma işlemini paylaşır; böylece birden fazla daemon başlatılmaz.
     */
    #restart() {
        if (!this.#restartPromise) {
            this.#restartPromise = (async () => {
                logger.warn('🔄 AI Daemon çökmesi tespit edildi. Kendi kendini iyileştirme (Self-Healing) başlatılıyor...');
                this.stop();
                // Sürecin temiz kapandığından ve portun boşaldığından emin olmak için kısa bir bekleme
                await new Promise(resolve => setTimeout(resolve, 1500));
                return this.start();
            })().finally(() => {
                this.#restartPromise = null;
            });
        }
        return this.#restartPromise;
    }

    /** Daemon'a ham HTTP isteği gönderir */
    #sendPredictRequest(imageBuffer) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const req = http.request({
                hostname: this.#host,
                port: this.#port,
                path: '/predict',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': imageBuffer.length,
                },
            }, (res) => {
                let body = '';
                res.on('data', (chunk) => { body += chunk; });
                res.on('end', () => {
                    const elapsed = Date.now() - startTime;
                    logger.info(`⚡ Daemon yanıt süresi: ${elapsed}ms`);
                    try {
                        const result = toPredictionResult(JSON.parse(body), elapsed);
                        AiDaemonClient.#logResult(result);
                        resolve(result);
                    } catch (err) {
                        logger.error('JSON Parse Hatası:', err);
                        resolve({ basarili: false, hata: 'Daemon çıktısı anlaşılamadı.' });
                    }
                });
            });

            // Bağlantı hataları reject edilir ki predict() self-healing tetikleyebilsin
            req.on('error', reject);
            req.setTimeout(REQUEST_TIMEOUT_MS, () => {
                req.destroy();
                reject(new Error(`Daemon yanıt zaman aşımı (${REQUEST_TIMEOUT_MS / 1000}s).`));
            });

            req.write(imageBuffer);
            req.end();
        });
    }

    static #logResult(result) {
        if (!result.basarili) return;
        const { katman1_yaprak: k1, katman2_bitki: k2, katman3_hastalik: k3 } = result;

        logger.success(`  📍 Katman 1: Yaprak bulundu (güven: %${k1.confidence})`);
        logger.success(`  🌿 Katman 2: ${k2.tur_tr} (güven: %${k2.confidence})`);
        if (k3.durum === 'tespit_edildi') {
            logger.success(`  🔬 Katman 3: ${k3.saglikli ? '✅' : '🔴'} ${k3.hastalik_tr} (güven: %${k3.confidence})`);
            if (k3.dusuk_confidence) logger.warn('  ⚠️ Katman 3: Düşük güven oranı!');
        } else {
            logger.info(`  🔬 Katman 3: ${k3.durum} - ${k3.mesaj || ''}`);
        }
    }

    static #isConnectionError(err) {
        return CONNECTION_ERROR_CODES.includes(err.code) || /socket/i.test(err.message);
    }

    static #sizeInMb(filePath) {
        return (fs.statSync(filePath).size / 1024 / 1024).toFixed(2);
    }
}

module.exports = AiDaemonClient;
