/**
 * `diagnoses` tablosuna erişimi kapsüller.
 * Kayıt okuma ve silme işlemleri her zaman kullanıcı UUID'si ile sınırlandırılır,
 * böylece bir kullanıcı başkasının kayıtlarına erişemez.
 */
class DiagnosisRepository {
    #db;

    constructor(db) {
        this.#db = db;
    }

    async create(record) {
        const res = await this.#db.query(
            `INSERT INTO diagnoses (
                user_id, yaprak_guven, plant_id, bitki_guven,
                disease_id, hastalik_guven, hastalik_durum,
                resim_yolu, tedavi_onerisi
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id`,
            [
                record.userId,
                record.leafConfidence,
                record.plantId,
                record.plantConfidence,
                record.diseaseId,
                record.diseaseConfidence,
                record.diseaseStatus,
                record.imageFilename,
                record.treatment,
            ]
        );
        return res.rows[0].id;
    }

    async findAllByUserUuid(userUuid) {
        const res = await this.#db.query(
            `SELECT d.id, d.yaprak_guven, d.bitki_guven, d.hastalik_guven,
                    d.hastalik_durum, d.resim_yolu, d.tarih, d.tedavi_onerisi,
                    p.key AS bitki_adi, p.name_tr AS bitki_adi_tr,
                    dis.key AS hastalik_adi, dis.name_tr AS hastalik_adi_tr
             FROM diagnoses d
             JOIN users u ON d.user_id = u.id
             JOIN plants p ON d.plant_id = p.id
             LEFT JOIN diseases dis ON d.disease_id = dis.id
             WHERE u.uuid = $1
             ORDER BY d.tarih DESC`,
            [userUuid]
        );
        return res.rows;
    }

    /**
     * Kullanıcıya ait tek bir kaydı siler.
     * @returns {Promise<{resim_yolu: string|null}|null>} Silinen kayıt; bulunamazsa null
     */
    async deleteForUser(id, userUuid) {
        const res = await this.#db.query(
            `DELETE FROM diagnoses d
             USING users u
             WHERE d.user_id = u.id AND d.id = $1 AND u.uuid = $2
             RETURNING d.resim_yolu`,
            [id, userUuid]
        );
        return res.rows[0] || null;
    }

    /**
     * Kullanıcının tüm kayıtlarını siler.
     * @returns {Promise<string[]>} Silinen kayıtlara ait görsel dosya adları
     */
    async deleteAllForUser(userUuid) {
        const res = await this.#db.query(
            `DELETE FROM diagnoses d
             USING users u
             WHERE d.user_id = u.id AND u.uuid = $1
             RETURNING d.resim_yolu`,
            [userUuid]
        );
        return res.rows.map(r => r.resim_yolu).filter(Boolean);
    }
}

module.exports = DiagnosisRepository;
