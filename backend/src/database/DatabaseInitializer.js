const { Client } = require('pg');
const logger = require('../utils/logger');

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;
const DATABASE_DOES_NOT_EXIST = '3D000';

/**
 * Sunucu açılışında veritabanını kullanıma hazırlar:
 *   1. PostgreSQL'e bağlanır (servis geç açılabileceği için yeniden denemeli); veritabanı yoksa oluşturur
 *   2. Bekleyen şema migration'larını uygular (Migrator)
 *   3. Bitki/hastalık kataloğunu senkronize eder (CatalogSeeder)
 */
class DatabaseInitializer {
    #db;
    #migrator;
    #seeder;

    constructor({ db, migrator, seeder }) {
        this.#db = db;
        this.#migrator = migrator;
        this.#seeder = seeder;
    }

    /**
     * @returns {Promise<boolean>} Veritabanı kullanıma hazırsa true; aksi halde sunucu çevrimdışı modda devam eder
     */
    async initialize() {
        logger.info('🔄 PostgreSQL bağlantısı ve veritabanı yapısı doğrulanıyor...');

        if (!(await this.#connectWithRetry())) {
            logger.error('❌ PostgreSQL servisine bağlanılamadı. Maksimum deneme sınırına ulaşıldı.');
            logger.warn('💡 Sunucu çevrimdışı modda (offline-mode) başlatılıyor. AI analizleri çalışacak ancak geçmiş kaydedilmeyecek.');
            return false;
        }

        try {
            await this.#migrator.migrate();
            await this.#seeder.sync();
            return true;
        } catch (error) {
            logger.error('❌ Veritabanı migration veya katalog senkronizasyonu başarısız:', error);
            return false;
        }
    }

    async #connectWithRetry() {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                await this.#connectOrCreateDatabase();
                logger.success(`📡 PostgreSQL'e bağlanıldı (Deneme ${attempt}/${MAX_RETRIES}).`);
                return true;
            } catch (error) {
                logger.warn(`⚠️ PostgreSQL bağlantı denemesi ${attempt}/${MAX_RETRIES} başarısız oldu: ${error.message}`);
                if (attempt < MAX_RETRIES) {
                    logger.info(`⏳ ${RETRY_DELAY_MS / 1000} saniye sonra tekrar denenecek...`);
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                }
            }
        }
        return false;
    }

    /**
     * Önce doğrudan uygulama veritabanına bağlanır. Yalnızca veritabanı yoksa sistem veritabanı
     * üzerinden oluşturur (yönetilen PostgreSQL servislerinde genelde bu yetki olmadığından
     * gereksiz yere denenmez).
     */
    async #connectOrCreateDatabase() {
        const { database: dbName, ...connection } = this.#db.config;
        const appClient = new Client({ ...this.#db.config, connectionTimeoutMillis: 3000 });
        try {
            await appClient.connect();
            return;
        } catch (error) {
            if (error.code !== DATABASE_DOES_NOT_EXIST) throw error;
        } finally {
            await appClient.end().catch(() => {});
        }

        logger.warn(`📡 '${dbName}' veritabanı bulunamadı. Otomatik oluşturuluyor...`);
        const adminClient = new Client({ ...connection, database: 'postgres', connectionTimeoutMillis: 3000 });
        try {
            await adminClient.connect();
            // Veritabanı adı parametre olarak verilemediği için güvenli şekilde tırnaklanır
            await adminClient.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
            logger.success(`✅ '${dbName}' veritabanı oluşturuldu.`);
        } finally {
            await adminClient.end().catch(() => {});
        }
    }
}

module.exports = DatabaseInitializer;
