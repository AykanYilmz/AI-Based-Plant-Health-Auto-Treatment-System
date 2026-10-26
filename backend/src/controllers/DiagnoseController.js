const logger = require('../utils/logger');
const { ValidationError } = require('../errors/AppError');

const DEFAULT_GUEST_UUID = 'default_guest_uuid';

/**
 * Teşhis ve teşhis geçmişi HTTP uç noktaları. İş mantığı DiagnosisService'tedir;
 * hatalar Express 5 tarafından global hata yakalayıcıya iletilir.
 * Metotlar route'lara doğrudan verilebilmesi için arrow function olarak tanımlıdır.
 */
class DiagnoseController {
    #service;

    constructor(diagnosisService) {
        this.#service = diagnosisService;
    }

    /** POST /api/diagnose */
    diagnose = async (req, res) => {
        if (!req.file) {
            throw new ValidationError('Lütfen bir fotoğraf yükleyin. Form alanı: "image"');
        }

        const userUuid = DiagnoseController.#userUuid(req) || DEFAULT_GUEST_UUID;
        logger.info(`📸 Fotoğraf alındı: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB) | Kullanıcı UUID: ${userUuid}`);

        res.json(await this.#service.diagnose(req.file.buffer, userUuid));
    };

    /** GET /api/history?uuid= */
    getHistory = async (req, res) => {
        const history = await this.#service.getHistory(req.query.uuid);
        res.json({ basarili: true, toplam: history.length, gecmis: history });
    };

    /** DELETE /api/history/:id (X-User-UUID header'ı zorunlu) */
    deleteHistory = async (req, res) => {
        const { id } = req.params;
        await this.#service.deleteOne(id, DiagnoseController.#userUuid(req));
        res.json({
            basarili: true,
            mesaj: 'Teşhis kaydı ve ilişkili görsel başarıyla silindi.',
            silinen_id: id,
        });
    };

    /** DELETE /api/history?uuid= */
    deleteAllHistory = async (req, res) => {
        await this.#service.deleteAll(req.query.uuid);
        res.json({ basarili: true, mesaj: 'Tüm teşhis kayıtları ve ilişkili görseller başarıyla temizlendi.' });
    };

    /** GET /api/labels */
    getLabels = (req, res) => {
        const labels = this.#service.getLabels();
        res.json({
            basarili: true,
            toplamTur: labels.length,
            bitkiTurleri: labels,
            not: 'Hastalık tespiti aktif: apple, bell pepper, cherry, corn, grape, peach, potato, strawberry, tomato',
        });
    };

    static #userUuid(req) {
        return req.get('x-user-uuid') || req.query.uuid || null;
    }
}

module.exports = DiagnoseController;
