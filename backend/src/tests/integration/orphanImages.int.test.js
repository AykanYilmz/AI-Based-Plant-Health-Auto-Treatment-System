const fs = require('fs');
const os = require('os');
const path = require('path');
const TestDatabase = require('./testDatabase');
const ImageStorage = require('../../services/ImageStorage');
const OrphanImageCleaner = require('../../services/OrphanImageCleaner');
const UserRepository = require('../../repositories/UserRepository');
const PlantRepository = require('../../repositories/PlantRepository');
const DiagnosisRepository = require('../../repositories/DiagnosisRepository');

jest.mock('../../utils/logger');

const testDb = new TestDatabase('orphans');
let db, dir, storage, diagnoses;

beforeAll(async () => {
    db = await testDb.setUp();
    diagnoses = new DiagnosisRepository(db);
}, 30000);

afterAll(() => testDb.tearDown());

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verdant-uploads-'));
    storage = new ImageStorage(dir);
});

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

function writeImage(name, ageHours) {
    const file = path.join(dir, name);
    fs.writeFileSync(file, 'jpeg');
    const time = new Date(Date.now() - ageHours * 3600_000);
    fs.utimesSync(file, time, time);
}

async function recordDiagnosis(imageFilename) {
    const userId = await new UserRepository(db).findOrCreateGuestId(`user-${imageFilename}`);
    const plant = await new PlantRepository(db).findPlantByKey('apple');
    await diagnoses.create({
        userId, leafConfidence: 1, plantId: plant.id, plantConfidence: 1, diseaseId: null,
        diseaseConfidence: null, diseaseStatus: 'model_yok', imageFilename, treatment: 't',
    });
}

test('lists only old, unreferenced app images and deletes them only when applied', async () => {
    writeImage('img_1_referenced.jpg', 48);
    writeImage('img_2_orphan.jpg', 48);
    writeImage('img_3_fresh.jpg', 1);         // bekleme süresi dolmadı
    writeImage('debug_manual.jpg', 48);       // uygulamanın dosyası değil
    await recordDiagnosis('img_1_referenced.jpg');

    const cleaner = new OrphanImageCleaner({ imageStorage: storage, diagnosisRepository: diagnoses });

    await expect(cleaner.clean({ dryRun: true })).resolves.toEqual(['img_2_orphan.jpg']);
    expect(fs.existsSync(path.join(dir, 'img_2_orphan.jpg'))).toBe(true);

    await expect(cleaner.clean({ dryRun: false })).resolves.toEqual(['img_2_orphan.jpg']);
    expect(fs.readdirSync(dir).sort()).toEqual(['debug_manual.jpg', 'img_1_referenced.jpg', 'img_3_fresh.jpg']);
});
