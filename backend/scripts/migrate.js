/**
 * Veritabanı migration komutları (sunucuyu başlatmadan).
 *
 *   npm run migrate          → Bekleyen migration'ları uygular
 *   npm run migrate:status   → Hangi migration'ların uygulandığını listeler
 */
require('dotenv').config();
const db = require('../src/config/db');
const Migrator = require('../src/database/Migrator');

async function main() {
    const migrator = new Migrator(db);

    if (process.argv.includes('--status')) {
        for (const m of await migrator.status()) {
            const when = m.appliedAt ? new Date(m.appliedAt).toLocaleString('tr-TR') : '';
            console.log(`${m.applied ? '✅' : '⏳'} ${m.name} ${when}`);
        }
        return;
    }

    await migrator.migrate();
}

main()
    .catch((error) => {
        console.error(`❌ ${error.message}`);
        process.exitCode = 1;
    })
    .finally(() => db.close());
