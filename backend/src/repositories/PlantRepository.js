/**
 * `plants` ve `diseases` tablolarına erişimi kapsüller.
 */
class PlantRepository {
    #db;

    constructor(db) {
        this.#db = db;
    }

    async findPlantByKey(key) {
        const res = await this.#db.query('SELECT id, key, name_tr FROM plants WHERE key = $1', [key]);
        return res.rows[0] || null;
    }

    async findDisease(plantId, diseaseKey) {
        const res = await this.#db.query(
            'SELECT id, name_tr, treatment_recommendation FROM diseases WHERE plant_id = $1 AND key = $2',
            [plantId, diseaseKey]
        );
        return res.rows[0] || null;
    }

    /**
     * Bitkiyi ekler; varsa isimlerini günceller.
     * @returns {Promise<{ id: number, changed: boolean }>} changed: kayıt eklendi veya bir alanı değişti
     */
    async upsertPlant({ key, tr, en }) {
        const res = await this.#db.query(
            `INSERT INTO plants (key, name_tr, name_en) VALUES ($1, $2, $3)
             ON CONFLICT (key) DO UPDATE SET name_tr = EXCLUDED.name_tr, name_en = EXCLUDED.name_en
                 WHERE (plants.name_tr, plants.name_en) IS DISTINCT FROM (EXCLUDED.name_tr, EXCLUDED.name_en)
             RETURNING id`,
            [key, tr, en]
        );
        if (res.rowCount > 0) return { id: res.rows[0].id, changed: true };

        // Değişiklik yoksa UPDATE atlanır ve RETURNING boş döner
        const existing = await this.findPlantByKey(key);
        return { id: existing.id, changed: false };
    }

    /**
     * Hastalığı ekler; varsa isimlerini ve tedavi önerisini günceller.
     * @returns {Promise<boolean>} Kayıt eklendi veya bir alanı değişti
     */
    async upsertDisease({ plantId, key, nameTr, nameEn, treatment }) {
        const res = await this.#db.query(
            `INSERT INTO diseases (plant_id, key, name_tr, name_en, treatment_recommendation)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (plant_id, key) DO UPDATE SET
                 name_tr = EXCLUDED.name_tr,
                 name_en = EXCLUDED.name_en,
                 treatment_recommendation = EXCLUDED.treatment_recommendation
                 WHERE (diseases.name_tr, diseases.name_en, diseases.treatment_recommendation)
                     IS DISTINCT FROM (EXCLUDED.name_tr, EXCLUDED.name_en, EXCLUDED.treatment_recommendation)`,
            [plantId, key, nameTr, nameEn, treatment]
        );
        return res.rowCount > 0;
    }
}

module.exports = PlantRepository;
