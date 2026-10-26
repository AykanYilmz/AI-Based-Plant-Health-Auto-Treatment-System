const logger = require('../utils/logger');
const PlantCatalog = require('../domain/PlantCatalog');
const PlantRepository = require('../repositories/PlantRepository');

/**
 * `plants` ve `diseases` tablolarını PlantCatalog ile senkronize eder.
 *
 * Her açılışta çalışır ve idempotent'tir: eksik kayıtları ekler, katalogda değişen isim ve
 * tedavi metinlerini günceller, değişmeyenlere dokunmaz. Teşhis kayıtları bu tablolara bağlı
 * olduğu için katalogdan çıkarılan kayıtlar silinmez.
 */
class CatalogSeeder {
    #db;

    constructor(db) {
        this.#db = db;
    }

    /** @returns {Promise<number>} Eklenen veya güncellenen kayıt sayısı */
    async sync() {
        const changes = await this.#db.transaction(async (tx) => {
            const plants = new PlantRepository(tx);
            let count = 0;

            for (const plant of PlantCatalog.PLANTS) {
                const { id: plantId, changed } = await plants.upsertPlant(plant);
                if (changed) count++;

                for (const diseaseKey of PlantCatalog.PLANT_DISEASES[plant.key] || []) {
                    const diseaseChanged = await plants.upsertDisease({
                        plantId,
                        key: diseaseKey,
                        nameTr: PlantCatalog.diseaseDisplayName(diseaseKey),
                        nameEn: diseaseKey,
                        treatment: PlantCatalog.treatmentFor(diseaseKey),
                    });
                    if (diseaseChanged) count++;
                }
            }
            return count;
        });

        if (changes) {
            logger.success(`🌱 Bitki/hastalık kataloğu güncellendi: ${changes} kayıt eklendi veya değişti.`);
        } else {
            logger.info('✅ Bitki/hastalık kataloğu güncel.');
        }
        return changes;
    }
}

module.exports = CatalogSeeder;
