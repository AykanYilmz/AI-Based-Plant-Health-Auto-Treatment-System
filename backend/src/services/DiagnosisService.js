const logger = require('../utils/logger');
const PlantCatalog = require('../domain/PlantCatalog');
const { toDiagnosisResponse } = require('../dto/diagnosisDto');
const { NotFoundError, ServiceUnavailableError, ValidationError } = require('../errors/AppError');

const DEFAULT_TREATMENT = 'Bitki veya hastalık tam tespit edilemediği için tedavi önerisi oluşturulamadı.';

/**
 * Teşhis iş akışını yönetir: AI analizi, görselin saklanması, kaydın veritabanına yazılması
 * ve kullanıcının teşhis geçmişi. Veritabanı kesintisinde analiz sonucu yine de döndürülür
 * (graceful degradation).
 */
class DiagnosisService {
    #db;
    #aiClient;
    #imageStorage;
    #users;
    #plants;
    #diagnoses;

    constructor({ db, aiClient, imageStorage, userRepository, plantRepository, diagnosisRepository }) {
        this.#db = db;
        this.#aiClient = aiClient;
        this.#imageStorage = imageStorage;
        this.#users = userRepository;
        this.#plants = plantRepository;
        this.#diagnoses = diagnosisRepository;
    }

    /**
     * Fotoğrafı analiz eder, kırpılmış yaprağı saklar ve sonucu kullanıcının geçmişine kaydeder.
     * @returns {Promise<Object>} AI başarısızsa ham hata sonucu, başarılıysa teşhis DTO'su
     */
    async diagnose(imageBuffer, userUuid) {
        logger.info('🔄 3 Katmanlı AI Pipeline başlatılıyor...');
        const prediction = await this.#aiClient.predict(imageBuffer);

        if (!prediction.basarili) {
            logger.warn(`⚠️ AI Çıkarım Pipeline Başarısız: ${prediction.hata}`);
            return prediction;
        }
        logger.success('✅ Pipeline başarıyla tamamlandı!');

        const filename = await this.#saveImage(prediction, imageBuffer);
        const { recordId, treatment } = await this.#persist(prediction, userUuid, filename);

        return toDiagnosisResponse(prediction, recordId, filename, treatment);
    }

    async getHistory(userUuid) {
        if (!userUuid) {
            throw new ValidationError('Geçmişi sorgulamak için kullanıcı UUID kodu (uuid) parametre olarak gönderilmelidir.');
        }
        await this.#requireDatabase('Veritabanı şu anda çevrimdışı. Teşhis geçmişi görüntülenemiyor.');
        return this.#diagnoses.findAllByUserUuid(userUuid);
    }

    /** Kullanıcıya ait tek bir teşhis kaydını ve görselini siler. */
    async deleteOne(id, userUuid) {
        if (!userUuid) {
            throw new ValidationError('Kayıt silmek için kullanıcı kimliği (X-User-UUID) gönderilmelidir.');
        }
        await this.#requireDatabase('Veritabanı şu anda çevrimdışı. Kayıt silme işlemi gerçekleştirilemiyor.');

        const deleted = await this.#diagnoses.deleteForUser(id, userUuid);
        if (!deleted) {
            throw new NotFoundError('Silinmek istenen kayıt bulunamadı.', { talep_edilen_id: id });
        }
        logger.success(`❌ Teşhis kaydı veritabanından silindi. ID: ${id}`);
        await this.#imageStorage.remove(deleted.resim_yolu);
    }

    /** Kullanıcının tüm teşhis kayıtlarını ve görsellerini siler. */
    async deleteAll(userUuid) {
        if (!userUuid) {
            throw new ValidationError('Geçmişi silmek için kullanıcı UUID kodu (uuid) parametre olarak gönderilmelidir.');
        }
        await this.#requireDatabase('Veritabanı şu anda çevrimdışı. Kayıt silme işlemi gerçekleştirilemiyor.');

        const filenames = await this.#diagnoses.deleteAllForUser(userUuid);
        logger.success(`❌ Tüm teşhis kayıtları veritabanından silindi. Kullanıcı: ${userUuid}`);
        await this.#imageStorage.removeAll(filenames);
    }

    /**
     * Kullanıcının kendi teşhis görselinin disk yolunu döndürür.
     * Görsel başka bir kullanıcıya aitse varlığı da gizlenir (404).
     */
    async getImagePath(filename, userUuid) {
        await this.#requireDatabase('Veritabanı şu anda çevrimdışı. Görsel görüntülenemiyor.');

        const owned = await this.#diagnoses.userOwnsImage(filename, userUuid);
        const filePath = owned ? await this.#imageStorage.pathFor(filename) : null;
        if (!filePath) {
            throw new NotFoundError('Görsel bulunamadı.');
        }
        return filePath;
    }

    getLabels() {
        return this.#aiClient.getLabels();
    }

    // ─── Özel yardımcılar ─────────────────────────────────────

    /** YOLO kırpımı varsa onu, yoksa orijinal görseli kaydeder. Disk hatası analizi engellemez. */
    async #saveImage(prediction, originalBuffer) {
        const crop = prediction.katman1_yaprak?.crop_base64;
        try {
            const buffer = crop ? Buffer.from(crop, 'base64') : originalBuffer;
            const filename = await this.#imageStorage.save(buffer, prediction.katman2_bitki.tur);
            logger.info(`💾 ${crop ? 'YOLO yaprak kesimi' : 'Orijinal görüntü'} kaydedildi: ${filename}`);
            return filename;
        } catch (err) {
            logger.error('❌ Resim yazma hatası (Disk I/O)', err);
            return null;
        }
    }

    /**
     * Teşhisi veritabanına kaydeder. Veritabanı yoksa tedavi önerisini katalogdan üretir
     * ve kayıt olmadan devam eder.
     */
    async #persist(prediction, userUuid, filename) {
        const plantKey = PlantCatalog.normalizePlantKey(prediction.katman2_bitki.tur);
        const disease = prediction.katman3_hastalik;
        const diseaseKey = disease.durum === 'tespit_edildi' ? disease.hastalik : null;

        try {
            if (!(await this.#db.ensureConnected())) {
                throw new Error('Veritabanı bağlantısı aktif değil (Offline Mode).');
            }

            const userId = await this.#users.findOrCreateGuestId(userUuid);
            const plant = await this.#plants.findPlantByKey(plantKey);
            if (!plant) {
                throw new Error(`Bitki veri tabanında tanımlı değil: ${plantKey}`);
            }

            const diseaseRow = diseaseKey ? await this.#plants.findDisease(plant.id, diseaseKey) : null;
            const treatment = diseaseRow?.treatment_recommendation || DEFAULT_TREATMENT;

            const recordId = await this.#diagnoses.create({
                userId,
                leafConfidence: prediction.katman1_yaprak.confidence,
                plantId: plant.id,
                plantConfidence: prediction.katman2_bitki.confidence,
                diseaseId: diseaseRow?.id || null,
                diseaseConfidence: disease.confidence,
                diseaseStatus: disease.durum,
                imageFilename: filename,
                treatment,
            });
            logger.success(`📝 Teşhis veritabanına başarıyla kaydedildi. Kayıt ID: ${recordId}`);
            return { recordId, treatment };
        } catch (dbError) {
            logger.warn(`⚠️ Veritabanı kaydı yapılamadı, teşhis çevrimdışı modda tamamlanıyor. Hata: ${dbError.message}`);
            const treatment = diseaseKey ? PlantCatalog.treatmentFor(diseaseKey) : DEFAULT_TREATMENT;
            return { recordId: null, treatment };
        }
    }

    async #requireDatabase(message) {
        if (!(await this.#db.ensureConnected())) {
            throw new ServiceUnavailableError(message);
        }
    }
}

module.exports = DiagnosisService;
