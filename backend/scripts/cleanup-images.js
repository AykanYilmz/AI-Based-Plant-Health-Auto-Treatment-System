/**
 * Hiçbir teşhis kaydına bağlı olmayan teşhis görsellerini (img_*.jpg) bulur.
 *
 *   npm run cleanup:images            → Yalnızca listeler (hiçbir şey silinmez)
 *   npm run cleanup:images -- --apply → Listelenenleri siler
 *
 * Son 24 saatte oluşturulan görsellere dokunulmaz.
 */
require('dotenv').config({ quiet: true });
const db = require('../src/config/db');
const paths = require('../src/config/paths');
const ImageStorage = require('../src/services/ImageStorage');
const DiagnosisRepository = require('../src/repositories/DiagnosisRepository');
const OrphanImageCleaner = require('../src/services/OrphanImageCleaner');

async function main() {
    const apply = process.argv.includes('--apply');
    const cleaner = new OrphanImageCleaner({
        imageStorage: new ImageStorage(paths.UPLOADS_DIR),
        diagnosisRepository: new DiagnosisRepository(db),
    });

    const orphans = await cleaner.clean({ dryRun: !apply });
    if (orphans.length === 0) {
        console.log('✅ Yetim görsel yok.');
        return;
    }
    orphans.forEach(name => console.log(`  ${apply ? '🗑️' : '•'} ${name}`));
    console.log(apply
        ? `\n✅ ${orphans.length} yetim görsel silindi.`
        : `\n${orphans.length} yetim görsel bulundu. Silmek için: npm run cleanup:images -- --apply`);
}

main()
    .catch((error) => {
        console.error(`❌ ${error.message}`);
        process.exitCode = 1;
    })
    .finally(() => db.close());
