const logger = require('../utils/logger');
const { ValidationError } = require('../errors/AppError');

/**
 * Teşhis, teşhis geçmişi ve teşhis görselleri HTTP uç noktaları. İş mantığı DiagnosisService'tedir;
 * hatalar Express 5 tarafından global hata yakalayıcıya iletilir.
 * Kullanıcı kimliği her zaman doğrulanmış access token'dan (`req.user`) alınır.
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

        logger.info(`📸 Fotoğraf alındı: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB) | Kullanıcı UUID: ${req.user.uuid}`);
        res.json(await this.#service.diagnose(req.file.buffer, req.user.uuid));
    };

    /** GET /api/history */
    getHistory = async (req, res) => {
        const history = await this.#service.getHistory(req.user.uuid);
        res.json({ basarili: true, toplam: history.length, gecmis: history });
    };

    /** DELETE /api/history/:id */
    deleteHistory = async (req, res) => {
        const { id } = req.params;
        await this.#service.deleteOne(id, req.user.uuid);
        res.json({
            basarili: true,
            mesaj: 'Teşhis kaydı ve ilişkili görsel başarıyla silindi.',
            silinen_id: id,
        });
    };

    /** DELETE /api/history */
    deleteAllHistory = async (req, res) => {
        await this.#service.deleteAll(req.user.uuid);
        res.json({ basarili: true, mesaj: 'Tüm teşhis kayıtları ve ilişkili görseller başarıyla temizlendi.' });
    };

    /** GET /api/images/:filename — yalnızca görselin sahibi erişebilir */
    getImage = async (req, res) => {
        const filePath = await this.#service.getImagePath(req.params.filename, req.user.uuid);
        res.set('Cache-Control', 'private, max-age=86400');
        res.sendFile(filePath);
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
}

module.exports = DiagnoseController;
