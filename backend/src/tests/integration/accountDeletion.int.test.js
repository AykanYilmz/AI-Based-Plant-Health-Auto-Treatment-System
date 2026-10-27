const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const TestDatabase = require('./testDatabase');
const ImageStorage = require('../../services/ImageStorage');
const AccountService = require('../../services/AccountService');
const UserRepository = require('../../repositories/UserRepository');
const PlantRepository = require('../../repositories/PlantRepository');
const DiagnosisRepository = require('../../repositories/DiagnosisRepository');
const RefreshTokenRepository = require('../../repositories/RefreshTokenRepository');
const { ValidationError } = require('../../errors/AppError');

jest.mock('../../utils/logger');

const testDb = new TestDatabase('account');
let db, dir, storage, accounts, users, diagnoses, tokens;

beforeAll(async () => {
    db = await testDb.setUp();
    users = new UserRepository(db);
    diagnoses = new DiagnosisRepository(db);
    tokens = new RefreshTokenRepository(db);
}, 30000);

afterAll(() => testDb.tearDown());

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verdant-account-'));
    storage = new ImageStorage(dir);
    accounts = new AccountService({ db, imageStorage: storage });
});

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

/** Kullanıcıya bir teşhis kaydı, fotoğrafı ve refresh token'ı ekler */
async function seedUserData(uuid) {
    const userId = await users.findOrCreateGuestId(uuid);
    const plant = await new PlantRepository(db).findPlantByKey('apple');
    const image = await storage.save(Buffer.from('jpeg'), 'apple');
    await diagnoses.create({
        userId, leafConfidence: 1, plantId: plant.id, plantConfidence: 1, diseaseId: null,
        diseaseConfidence: null, diseaseStatus: 'model_yok', imageFilename: image, treatment: 't',
    });
    const tokenHash = crypto.randomBytes(32).toString('hex');
    await tokens.create({ userId, tokenHash, expiresAt: new Date(Date.now() + 60_000) });
    return { image, tokenHash };
}

test('registered account: requires the correct password, then deletes user, records, tokens and photos', async () => {
    const uuid = crypto.randomUUID();
    await users.createRegistered({ uuid, name: 'Ali', email: `ali-${uuid}@x.com`, passwordHash: await bcrypt.hash('bahce2026', 4) });
    const { image, tokenHash } = await seedUserData(uuid);

    // Başka bir kullanıcının verisi etkilenmemeli
    const otherUuid = crypto.randomUUID();
    const other = await seedUserData(otherUuid);

    await expect(accounts.deleteAccount(uuid, {})).rejects.toBeInstanceOf(ValidationError);
    await expect(accounts.deleteAccount(uuid, { password: 'yanlis123' })).rejects.toThrow('Şifre hatalı.');
    expect(await users.findByUuid(uuid)).not.toBeNull();

    await accounts.deleteAccount(uuid, { password: 'bahce2026' });

    expect(await users.findByUuid(uuid)).toBeNull();
    expect(await diagnoses.findAllByUserUuid(uuid)).toEqual([]);
    expect(await tokens.findByHash(tokenHash)).toBeNull();
    expect(fs.existsSync(path.join(dir, image))).toBe(false);

    expect(await users.findByUuid(otherUuid)).not.toBeNull();
    expect(await diagnoses.findAllByUserUuid(otherUuid)).toHaveLength(1);
    expect(fs.existsSync(path.join(dir, other.image))).toBe(true);
});

test('guest account: deleted without a password', async () => {
    const uuid = crypto.randomUUID();
    const { image } = await seedUserData(uuid);

    await accounts.deleteAccount(uuid);

    expect(await users.findByUuid(uuid)).toBeNull();
    expect(fs.existsSync(path.join(dir, image))).toBe(false);
});
