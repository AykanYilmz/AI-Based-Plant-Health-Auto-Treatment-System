const { Client } = require('pg');
const logger = require('../utils/logger');
const PlantCatalog = require('../domain/PlantCatalog');

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

/**
 * Sunucu her başladığında yerel PostgreSQL üzerinde veritabanı ve tabloların varlığını kontrol eder,
 * yoksa otomatik oluşturur ve başlangıç verilerini (seed) yükler.
 * Veritabanı servisinin geç açılabilme ihtimaline karşı yeniden deneme (retry) mekanizması içerir.
 */
class DatabaseInitializer {
    #db;
    #plants;

    constructor({ db, plantRepository }) {
        this.#db = db;
        this.#plants = plantRepository;
    }

    /**
     * @returns {Promise<boolean>} Veritabanı kullanıma hazırsa true; aksi halde sunucu çevrimdışı modda devam eder
     */
    async initialize() {
        logger.info('🔄 Yerel PostgreSQL bağlantısı ve veritabanı yapısı doğrulanıyor...');

        if (!(await this.#ensureDatabaseExists())) {
            logger.error('❌ PostgreSQL servisine bağlanılamadı. Maksimum deneme sınırına ulaşıldı.');
            logger.warn('💡 Sunucu çevrimdışı modda (offline-mode) başlatılıyor. AI analizleri çalışacak ancak geçmiş kaydedilmeyecek.');
            return false;
        }

        try {
            logger.info('🔄 Tablo yapısı doğrulanıyor...');
            await this.#migrateLegacySchema();
            await this.#createTables();
            logger.success('✅ İlişkisel veritabanı tabloları hazır!');
            await this.#seed();
            return true;
        } catch (error) {
            logger.error('❌ Tablo oluşturma veya göç hatası:', error);
            return false;
        }
    }

    /** Sistem veritabanına bağlanarak uygulama veritabanının varlığını kontrol eder, yoksa oluşturur. */
    async #ensureDatabaseExists() {
        const { database: dbName, ...connection } = this.#db.config;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            const client = new Client({ ...connection, database: 'postgres', connectionTimeoutMillis: 3000 });
            try {
                await client.connect();
                logger.success(`📡 PostgreSQL servisine başarıyla bağlanıldı (Deneme ${attempt}/${MAX_RETRIES}).`);

                const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
                if (exists.rowCount === 0) {
                    logger.warn(`📡 '${dbName}' veritabanı bulunamadı. Otomatik oluşturuluyor...`);
                    // Veritabanı adı parametre olarak verilemediği için güvenli şekilde tırnaklanır
                    await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
                    logger.success(`✅ '${dbName}' veritabanı oluşturuldu.`);
                } else {
                    logger.info(`✅ '${dbName}' veritabanı zaten mevcut.`);
                }
                return true;
            } catch (error) {
                logger.warn(`⚠️ PostgreSQL bağlantı denemesi ${attempt}/${MAX_RETRIES} başarısız oldu: ${error.message}`);
                if (attempt < MAX_RETRIES) {
                    logger.info(`⏳ ${RETRY_DELAY_MS / 1000} saniye sonra tekrar denenecek...`);
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                }
            } finally {
                await client.end().catch(() => {});
            }
        }
        return false;
    }

    /** Göç (Migration) Kontrolü: Eski tek tabloluk yapı varsa temizle */
    async #migrateLegacySchema() {
        const res = await this.#db.query(
            `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users');`
        );
        if (res.rows[0].exists) return;

        logger.warn('🔄 Eski veri tabanı şeması tespit edildi. İlişkisel tablo yapısına geçiş yapılıyor (Migration)...');
        for (const table of ['refresh_tokens', 'diagnoses', 'diseases', 'plants', 'users']) {
            await this.#db.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
        }
    }

    async #createTables() {
        // 1. Kullanıcılar Tablosu
        await this.#db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                uuid VARCHAR(100) UNIQUE NOT NULL,
                name VARCHAR(100) NULL,
                email VARCHAR(100) UNIQUE NULL,
                password_hash VARCHAR(255) NULL,
                user_type VARCHAR(20) DEFAULT 'guest',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Bitkiler Tablosu
        await this.#db.query(`
            CREATE TABLE IF NOT EXISTS plants (
                id SERIAL PRIMARY KEY,
                key VARCHAR(50) UNIQUE NOT NULL,
                name_tr VARCHAR(100) NOT NULL,
                name_en VARCHAR(100) NOT NULL
            );
        `);

        // 3. Hastalıklar Tablosu
        await this.#db.query(`
            CREATE TABLE IF NOT EXISTS diseases (
                id SERIAL PRIMARY KEY,
                plant_id INT REFERENCES plants(id) ON DELETE CASCADE,
                key VARCHAR(100) NOT NULL,
                name_tr VARCHAR(150) NOT NULL,
                name_en VARCHAR(150) NOT NULL,
                treatment_recommendation TEXT NOT NULL,
                UNIQUE (plant_id, key)
            );
        `);

        // 4. Teşhisler Tablosu
        await this.#db.query(`
            CREATE TABLE IF NOT EXISTS diagnoses (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                yaprak_guven NUMERIC,
                plant_id INT REFERENCES plants(id),
                bitki_guven NUMERIC,
                disease_id INT REFERENCES diseases(id),
                hastalik_guven NUMERIC,
                hastalik_durum VARCHAR(50),
                resim_yolu VARCHAR(255),
                tedavi_onerisi TEXT,
                tarih TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Migration: Eğer tablo önceden oluşturulduysa ve 'tedavi_onerisi' kolonu yoksa otomatik ekle
        await this.#db.query(`ALTER TABLE diagnoses ADD COLUMN IF NOT EXISTS tedavi_onerisi TEXT;`);

        // 5. Oturum Yenileme (Refresh) Token'ları — token'ın kendisi değil SHA-256 hash'i saklanır
        await this.#db.query(`
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash CHAR(64) UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                revoked_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await this.#db.query('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);');

        // E-posta aramaları büyük/küçük harf duyarsız yapılır (LOWER(email))
        await this.#db.query('CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));');
    }

    /** Plants ve Diseases tablolarını PlantCatalog verileriyle doldurur. */
    async #seed() {
        try {
            if (await this.#plants.countPlants() > 0) {
                logger.info('✅ Veri tabanı seed işlemi zaten yapılmış.');
                return;
            }

            logger.info('🌱 Veri tabanı başlangıç verileri (Seed) yükleniyor...');
            let diseaseCount = 0;

            for (const plant of PlantCatalog.PLANTS) {
                const plantId = await this.#plants.insertPlant(plant);
                for (const diseaseKey of PlantCatalog.PLANT_DISEASES[plant.key] || []) {
                    await this.#plants.insertDisease({
                        plantId,
                        key: diseaseKey,
                        nameTr: PlantCatalog.diseaseDisplayName(diseaseKey),
                        nameEn: diseaseKey,
                        treatment: PlantCatalog.treatmentFor(diseaseKey),
                    });
                    diseaseCount++;
                }
            }

            logger.success(`✅ ${PlantCatalog.PLANTS.length} bitki türü eklendi.`);
            logger.success(`✅ ${diseaseCount} hastalık ve tedavi önerisi ilişkisel olarak eklendi.`);
        } catch (err) {
            logger.error('❌ Veri tabanı seed hatası:', err);
        }
    }
}

module.exports = DatabaseInitializer;
