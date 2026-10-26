const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const MIGRATION_FILE_PATTERN = /^\d{3}_[a-z0-9_]+\.sql$/;
// Aynı anda iki sunucu süreci migration çalıştırmasın diye kullanılan PostgreSQL advisory lock anahtarı
const ADVISORY_LOCK_KEY = 72830001;

/**
 * Şema değişikliklerini numaralı SQL dosyalarıyla (ör. `002_add_column.sql`) yönetir.
 *
 * - Uygulanan migration'lar `schema_migrations` tablosuna yazılır; her dosya yalnızca bir kez çalışır.
 * - Her migration kendi transaction'ında çalışır; hata olursa o migration tamamen geri alınır.
 * - Uygulanmış bir dosya sonradan değiştirilirse (checksum farkı) uyarı verilir; yeni değişiklik
 *   için her zaman yeni bir dosya eklenmelidir.
 * - Hiçbir zaman otomatik tablo silmez.
 */
class Migrator {
    #db;
    #directory;

    constructor(db, directory = MIGRATIONS_DIR) {
        this.#db = db;
        this.#directory = directory;
    }

    /**
     * Bekleyen migration'ları sırayla uygular.
     * @returns {Promise<string[]>} Bu çalıştırmada uygulanan dosya adları
     */
    async migrate() {
        return this.#db.withClient(async (client) => {
            await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
            try {
                await Migrator.#ensureMigrationsTable(client);
                const applied = await Migrator.#appliedMigrations(client);
                const newlyApplied = [];

                for (const migration of this.#readMigrations()) {
                    const previous = applied.get(migration.name);
                    if (previous) {
                        if (previous !== migration.checksum) {
                            logger.warn(`⚠️ Uygulanmış migration dosyası değiştirilmiş: ${migration.name}. Değişiklikler için yeni bir migration dosyası ekleyin.`);
                        }
                        continue;
                    }
                    await Migrator.#apply(client, migration);
                    newlyApplied.push(migration.name);
                }

                if (newlyApplied.length) {
                    logger.success(`✅ ${newlyApplied.length} migration uygulandı: ${newlyApplied.join(', ')}`);
                } else {
                    logger.info('✅ Veritabanı şeması güncel (bekleyen migration yok).');
                }
                return newlyApplied;
            } finally {
                await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
            }
        });
    }

    /** @returns {Promise<{ name: string, applied: boolean, appliedAt: Date|null }[]>} */
    async status() {
        return this.#db.withClient(async (client) => {
            await Migrator.#ensureMigrationsTable(client);
            const res = await client.query('SELECT name, applied_at FROM schema_migrations');
            const appliedAt = new Map(res.rows.map(r => [r.name, r.applied_at]));
            return this.#readMigrations().map(m => ({
                name: m.name,
                applied: appliedAt.has(m.name),
                appliedAt: appliedAt.get(m.name) || null,
            }));
        });
    }

    #readMigrations() {
        return fs.readdirSync(this.#directory)
            .filter(name => MIGRATION_FILE_PATTERN.test(name))
            .sort()
            .map(name => {
                const sql = fs.readFileSync(path.join(this.#directory, name), 'utf8');
                return { name, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
            });
    }

    static async #apply(client, migration) {
        logger.info(`🔄 Migration uygulanıyor: ${migration.name}`);
        await client.query('BEGIN');
        try {
            await client.query(migration.sql);
            await client.query(
                'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)',
                [migration.name, migration.checksum]
            );
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw new Error(`Migration başarısız (${migration.name}): ${error.message}`);
        }
    }

    static async #ensureMigrationsTable(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                name VARCHAR(255) PRIMARY KEY,
                checksum CHAR(64) NOT NULL,
                applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);
    }

    static async #appliedMigrations(client) {
        const res = await client.query('SELECT name, checksum FROM schema_migrations');
        return new Map(res.rows.map(r => [r.name, r.checksum]));
    }
}

module.exports = Migrator;
