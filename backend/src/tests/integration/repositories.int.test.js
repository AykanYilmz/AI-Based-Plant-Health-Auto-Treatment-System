const crypto = require('crypto');
const TestDatabase = require('./testDatabase');
const UserRepository = require('../../repositories/UserRepository');
const PlantRepository = require('../../repositories/PlantRepository');
const DiagnosisRepository = require('../../repositories/DiagnosisRepository');
const RefreshTokenRepository = require('../../repositories/RefreshTokenRepository');
const Migrator = require('../../database/Migrator');
const CatalogSeeder = require('../../database/CatalogSeeder');
const PlantCatalog = require('../../domain/PlantCatalog');

jest.mock('../../utils/logger');

const testDb = new TestDatabase('repos');
let db, users, plants, diagnoses, tokens;

beforeAll(async () => {
    db = await testDb.setUp();
    users = new UserRepository(db);
    plants = new PlantRepository(db);
    diagnoses = new DiagnosisRepository(db);
    tokens = new RefreshTokenRepository(db);
}, 30000);

afterAll(() => testDb.tearDown());

const newUuid = () => crypto.randomUUID();

async function createDiagnosis(userUuid, imageFilename) {
    const userId = await users.findOrCreateGuestId(userUuid);
    const plant = await plants.findPlantByKey('tomato');
    const disease = await plants.findDisease(plant.id, 'Late Blight');
    return diagnoses.create({
        userId,
        leafConfidence: 90,
        plantId: plant.id,
        plantConfidence: 95,
        diseaseId: disease.id,
        diseaseConfidence: 88,
        diseaseStatus: 'tespit_edildi',
        imageFilename,
        treatment: disease.treatment_recommendation,
    });
}

describe('Migrator & CatalogSeeder', () => {
    it('applied every migration exactly once and is idempotent', async () => {
        const status = await new Migrator(db).status();
        expect(status.length).toBeGreaterThan(0);
        expect(status.every(m => m.applied)).toBe(true);
        await expect(new Migrator(db).migrate()).resolves.toEqual([]);
    });

    it('seeded the full catalog and only reports real changes', async () => {
        const res = await db.query('SELECT (SELECT count(*) FROM plants)::int AS p, (SELECT count(*) FROM diseases)::int AS d');
        const expectedDiseases = Object.values(PlantCatalog.PLANT_DISEASES).reduce((n, list) => n + list.length, 0);
        expect(res.rows[0]).toEqual({ p: PlantCatalog.PLANTS.length, d: expectedDiseases });

        await expect(new CatalogSeeder(db).sync()).resolves.toBe(0);

        await db.query("UPDATE diseases SET treatment_recommendation = 'eski' WHERE key = 'Late Blight'");
        await expect(new CatalogSeeder(db).sync()).resolves.toBe(2); // domates + patates
        const fixed = await db.query("SELECT DISTINCT treatment_recommendation AS t FROM diseases WHERE key = 'Late Blight'");
        expect(fixed.rows).toEqual([{ t: PlantCatalog.treatmentFor('Late Blight') }]);
    });
});

describe('UserRepository', () => {
    it('finds registered users by email case-insensitively and never exposes the hash by default', async () => {
        const uuid = newUuid();
        await users.createRegistered({ uuid, name: 'Ali', email: 'ali@ornek.com', passwordHash: 'hash' });

        expect(await users.emailExists('ALI@Ornek.com')).toBe(true);
        expect(await users.emailExists('ALI@Ornek.com', uuid)).toBe(false);
        expect((await users.findRegisteredByEmailWithPassword('Ali@ORNEK.com')).password_hash).toBe('hash');
        expect(await users.findByUuid(uuid)).not.toHaveProperty('password_hash');
    });

    it('upgrades only guest accounts', async () => {
        const guestUuid = newUuid();
        await users.createGuest(guestUuid);
        const upgraded = await users.upgradeGuest(guestUuid, { name: 'Ayşe', email: 'ayse@ornek.com', passwordHash: 'h' });
        expect(upgraded.user_type).toBe('registered');

        // Artık kayıtlı olduğu için ikinci yükseltme hiçbir şeyi değiştirmez
        await expect(users.upgradeGuest(guestUuid, { name: 'X', email: 'x@ornek.com', passwordHash: 'h' })).resolves.toBeNull();
        expect((await users.findByUuid(guestUuid)).email).toBe('ayse@ornek.com');
    });
});

describe('DiagnosisRepository', () => {
    it('isolates records and images per user', async () => {
        const owner = newUuid();
        const intruder = newUuid();
        await users.findOrCreateGuestId(intruder);
        const id = await createDiagnosis(owner, 'img_owner.jpg');

        expect(await diagnoses.findAllByUserUuid(intruder)).toEqual([]);
        expect(await diagnoses.userOwnsImage('img_owner.jpg', intruder)).toBe(false);
        expect(await diagnoses.deleteForUser(id, intruder)).toBeNull();

        const [record] = await diagnoses.findAllByUserUuid(owner);
        expect(record).toMatchObject({ id, bitki_adi: 'tomato', bitki_adi_tr: 'Domates', hastalik_adi: 'Late Blight' });
        expect(await diagnoses.userOwnsImage('img_owner.jpg', owner)).toBe(true);
        await expect(diagnoses.deleteForUser(id, owner)).resolves.toEqual({ resim_yolu: 'img_owner.jpg' });
    });

    it('deletes all of a user\'s records and returns their images', async () => {
        const owner = newUuid();
        await createDiagnosis(owner, 'img_a.jpg');
        await createDiagnosis(owner, 'img_b.jpg');

        const files = await diagnoses.deleteAllForUser(owner);
        expect(files.sort()).toEqual(['img_a.jpg', 'img_b.jpg']);
        expect(await diagnoses.findAllByUserUuid(owner)).toEqual([]);
    });
});

describe('RefreshTokenRepository', () => {
    it('revokes a token only once and cascades with the user', async () => {
        const uuid = newUuid();
        const userId = await users.findOrCreateGuestId(uuid);
        const hash = crypto.randomBytes(32).toString('hex');
        await tokens.create({ userId, tokenHash: hash, expiresAt: new Date(Date.now() + 60_000) });

        const record = await tokens.findByHash(hash);
        expect(record).toMatchObject({ user_id: userId, user_uuid: uuid, revoked_at: null });
        await expect(tokens.revoke(record.id)).resolves.toBe(true);
        await expect(tokens.revoke(record.id)).resolves.toBe(false);

        await db.query('DELETE FROM users WHERE id = $1', [userId]);
        await expect(tokens.findByHash(hash)).resolves.toBeNull();
    });

    it('deletes only tokens that expired more than a week ago', async () => {
        const userId = await users.findOrCreateGuestId(newUuid());
        const old = crypto.randomBytes(32).toString('hex');
        const recent = crypto.randomBytes(32).toString('hex');
        await tokens.create({ userId, tokenHash: old, expiresAt: new Date(Date.now() - 8 * 86400_000) });
        await tokens.create({ userId, tokenHash: recent, expiresAt: new Date(Date.now() - 86400_000) });

        await expect(tokens.deleteExpired()).resolves.toBe(1);
        expect(await tokens.findByHash(old)).toBeNull();
        expect(await tokens.findByHash(recent)).not.toBeNull();
    });
});
