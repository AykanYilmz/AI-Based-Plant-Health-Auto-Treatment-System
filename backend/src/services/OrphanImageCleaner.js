const logger = require('../utils/logger');

const DEFAULT_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

/**
 * Hiçbir teşhis kaydına bağlı olmayan ("yetim") teşhis görsellerini bulur ve isteğe bağlı siler.
 *
 * Yetim görseller iki yoldan oluşur: kullanıcı silindiğinde kayıtları cascade ile silinir ama
 * görselleri diskte kalır; veritabanı kapalıyken yapılan teşhislerin görseli kaydedilir ama
 * kaydı oluşmaz. Yeni kaydedilmiş görseller, o anda veritabanına yazılmakta olan bir teşhise
 * ait olabileceği için bekleme süresi dolana kadar dokunulmaz.
 */
class OrphanImageCleaner {
    #imageStorage;
    #diagnoses;
    #gracePeriodMs;

    constructor({ imageStorage, diagnosisRepository, gracePeriodMs = DEFAULT_GRACE_PERIOD_MS }) {
        this.#imageStorage = imageStorage;
        this.#diagnoses = diagnosisRepository;
        this.#gracePeriodMs = gracePeriodMs;
    }

    /** @returns {Promise<string[]>} Silinmeye aday yetim görsel dosya adları */
    async findOrphans(now = new Date()) {
        const [images, referenced] = await Promise.all([
            this.#imageStorage.listImages(),
            this.#diagnoses.findAllImageFilenames(),
        ]);
        const cutoff = now.getTime() - this.#gracePeriodMs;
        return images
            .filter(img => !referenced.has(img.filename) && img.modifiedAt.getTime() < cutoff)
            .map(img => img.filename)
            .sort();
    }

    /**
     * @param {{ dryRun?: boolean }} options - dryRun true ise yalnızca listeler, silmez
     * @returns {Promise<string[]>} Yetim (ve dryRun değilse silinen) dosya adları
     */
    async clean({ dryRun = true } = {}) {
        const orphans = await this.findOrphans();
        if (!dryRun) {
            await this.#imageStorage.removeAll(orphans);
            logger.success(`🧹 ${orphans.length} yetim görsel silindi.`);
        }
        return orphans;
    }
}

module.exports = OrphanImageCleaner;
