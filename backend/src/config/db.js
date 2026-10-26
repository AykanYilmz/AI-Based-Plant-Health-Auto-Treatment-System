const { Pool } = require('pg');
const logger = require('../utils/logger');

/**
 * PostgreSQL bağlantı havuzunu ve bağlantı durumunu kapsülleyen sınıf.
 * Bağlantı durumu dışarıdan değiştirilemez; yalnızca sorgu sonuçlarına göre güncellenir.
 */
class Database {
    #pool;
    #connected = false;

    constructor(config) {
        this.config = Object.freeze({ ...config });
        this.#pool = new Pool({
            ...this.config,
            connectionTimeoutMillis: 5000, // Bağlantı zaman aşımı (5s)
            idleTimeoutMillis: 30000,      // Boştaki bağlantı zaman aşımı (30s)
        });

        // Havuz genelindeki bağlantı hatalarını dinle
        this.#pool.on('error', (err) => {
            logger.error('PostgreSQL Bağlantı Havuzu Hatası', err);
            this.#connected = false;
        });
    }

    get isConnected() {
        return this.#connected;
    }

    /** Veritabanına bağlanmayı dener ve bağlantı durumunu günceller. */
    async checkConnection() {
        try {
            const client = await this.#pool.connect();
            client.release();
            this.#connected = true;
        } catch {
            this.#connected = false;
        }
        return this.#connected;
    }

    /**
     * Bağlantı bilinen şekilde kopuksa önce yeniden bağlanmayı dener.
     * Böylece kısa bir kesintiden sonra sistem kendiliğinden çevrimiçi duruma döner.
     */
    async ensureConnected() {
        return this.#connected || this.checkConnection();
    }

    /** Güvenli ve loglanan veritabanı sorgusu */
    async query(text, params) {
        const start = Date.now();
        try {
            const res = await this.#pool.query(text, params);
            const duration = Date.now() - start;

            // Uzun süren sorguları uyar, normal sorguları info olarak geç
            const sqlSnippet = text.trim().replace(/\s+/g, ' ').substring(0, 100);
            if (duration > 1000) {
                logger.warn(`🐌 Yavaş SQL Sorgusu (${duration}ms): ${sqlSnippet}`);
            } else {
                logger.info(`💾 SQL Sorgusu yürütüldü: ${sqlSnippet} | Süre: ${duration}ms | Satır: ${res.rowCount}`);
            }

            this.#connected = true;
            return res;
        } catch (error) {
            logger.error(`SQL Sorgu Hatası (Sorgu: ${text.trim().substring(0, 150)})`, error);
            // Yalnızca bağlantı kaynaklı hatalar durumu offline'a çeker; SQL hataları bağlantıyı koparmaz
            if (Database.#isConnectionError(error)) {
                this.#connected = false;
            }
            throw error;
        }
    }

    /**
     * Havuzdan tek bir bağlantı alıp verilen fonksiyona verir (oturum düzeyinde kilit gibi
     * aynı bağlantıda yapılması gereken işlemler için). Bağlantı her durumda havuza iade edilir.
     * @template T
     * @param {(client: { query: Function }) => Promise<T>} fn
     * @returns {Promise<T>}
     */
    async withClient(fn) {
        const client = await this.#pool.connect();
        try {
            return await fn(client);
        } finally {
            client.release();
        }
    }

    /**
     * Fonksiyonu tek bir transaction içinde çalıştırır; hata olursa tüm değişiklikler geri alınır.
     * Fonksiyona verilen nesne repository'lere `db` yerine geçirilebilir (aynı `query` arayüzü).
     */
    async transaction(fn) {
        return this.withClient(async (client) => {
            await client.query('BEGIN');
            try {
                const result = await fn(client);
                await client.query('COMMIT');
                return result;
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            }
        });
    }

    async close() {
        await this.#pool.end();
        this.#connected = false;
    }

    static #isConnectionError(error) {
        return ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', '57P01', '57P03'].includes(error.code)
            || error instanceof AggregateError
            || /connection|terminat/i.test(error.message);
    }
}

module.exports = new Database({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_DATABASE || 'plant_health_db',
});
