require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const { Database, connectionConfigFromEnv } = require('../../config/db');
const Migrator = require('../../database/Migrator');
const CatalogSeeder = require('../../database/CatalogSeeder');

/**
 * Entegrasyon testleri için geçici, boş bir PostgreSQL veritabanı.
 * Her test dosyası kendi veritabanını oluşturur (gerçek migration + katalog ile) ve sonunda siler;
 * geliştirme veritabanına (plant_health_db) asla dokunulmaz.
 */
class TestDatabase {
    #name;
    #db = null;

    constructor(suffix) {
        this.#name = `verdant_test_${suffix}_${process.pid}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    }

    get db() {
        return this.#db;
    }

    async setUp() {
        await this.#admin(`DROP DATABASE IF EXISTS "${this.#name}"`);
        await this.#admin(`CREATE DATABASE "${this.#name}"`);
        this.#db = new Database(connectionConfigFromEnv({ database: this.#name }));
        await new Migrator(this.#db).migrate();
        await new CatalogSeeder(this.#db).sync();
        return this.#db;
    }

    async tearDown() {
        if (this.#db) await this.#db.close();
        await this.#admin(`DROP DATABASE IF EXISTS "${this.#name}"`);
    }

    async #admin(sql) {
        const client = new Client(connectionConfigFromEnv({ database: 'postgres' }));
        await client.connect();
        try {
            await client.query(sql);
        } finally {
            await client.end();
        }
    }
}

module.exports = TestDatabase;
