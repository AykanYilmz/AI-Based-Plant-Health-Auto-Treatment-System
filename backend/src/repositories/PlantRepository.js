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

    async countPlants() {
        const res = await this.#db.query('SELECT COUNT(*) FROM plants');
        return parseInt(res.rows[0].count, 10);
    }

    async insertPlant({ key, tr, en }) {
        const res = await this.#db.query(
            'INSERT INTO plants (key, name_tr, name_en) VALUES ($1, $2, $3) RETURNING id',
            [key, tr, en]
        );
        return res.rows[0].id;
    }

    async insertDisease({ plantId, key, nameTr, nameEn, treatment }) {
        await this.#db.query(
            `INSERT INTO diseases (plant_id, key, name_tr, name_en, treatment_recommendation)
             VALUES ($1, $2, $3, $4, $5)`,
            [plantId, key, nameTr, nameEn, treatment]
        );
    }
}

module.exports = PlantRepository;
