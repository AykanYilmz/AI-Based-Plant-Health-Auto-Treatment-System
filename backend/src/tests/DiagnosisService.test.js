const DiagnosisService = require('../services/DiagnosisService');
const { NotFoundError, ServiceUnavailableError, ValidationError } = require('../errors/AppError');

jest.mock('../utils/logger');

const successfulPrediction = (overrides = {}) => ({
    basarili: true,
    katman1_yaprak: { tespit_edildi: true, confidence: 91.2, bbox: [0, 0, 10, 10], toplam_tespit: 1, crop_base64: Buffer.from('crop').toString('base64') },
    katman2_bitki: { tur: 'bell pepper', tur_tr: 'Biber', confidence: 88.4, top3: [] },
    katman3_hastalik: { durum: 'tespit_edildi', hastalik: 'Bacterial Spot', hastalik_tr: 'Bakteriyel Leke', saglikli: false, confidence: 77.1, top3: [] },
    ...overrides,
});

function createService({ connected = true } = {}) {
    const deps = {
        db: { ensureConnected: jest.fn().mockResolvedValue(connected) },
        aiClient: { predict: jest.fn(), getLabels: jest.fn() },
        imageStorage: { save: jest.fn().mockResolvedValue('img_test.jpg'), remove: jest.fn(), removeAll: jest.fn() },
        userRepository: { findOrCreateGuestId: jest.fn().mockResolvedValue(7) },
        plantRepository: {
            findPlantByKey: jest.fn().mockResolvedValue({ id: 3, key: 'bell_pepper' }),
            findDisease: jest.fn().mockResolvedValue({ id: 11, treatment_recommendation: 'DB tedavi metni' }),
        },
        diagnosisRepository: {
            create: jest.fn().mockResolvedValue(42),
            findAllByUserUuid: jest.fn(),
            deleteForUser: jest.fn(),
            deleteAllForUser: jest.fn(),
        },
    };
    return { service: new DiagnosisService(deps), deps };
}

describe('DiagnosisService', () => {
    describe('diagnose', () => {
        it('saves the crop, persists the record and returns the DTO', async () => {
            const { service, deps } = createService();
            deps.aiClient.predict.mockResolvedValue(successfulPrediction());

            const result = await service.diagnose(Buffer.from('raw'), 'user-1');

            expect(deps.imageStorage.save).toHaveBeenCalledWith(Buffer.from('crop'), 'bell pepper');
            expect(deps.plantRepository.findPlantByKey).toHaveBeenCalledWith('bell_pepper');
            expect(deps.diagnosisRepository.create).toHaveBeenCalledWith(expect.objectContaining({
                userId: 7, plantId: 3, diseaseId: 11, imageFilename: 'img_test.jpg', treatment: 'DB tedavi metni',
            }));
            expect(result).toMatchObject({
                basarili: true,
                veritabani_kayitli: true,
                kayit_id: 42,
                resim_yolu: 'img_test.jpg',
                tedavi_onerisi: 'DB tedavi metni',
            });
        });

        it('returns the AI failure as-is without saving anything', async () => {
            const { service, deps } = createService();
            const failure = { basarili: false, hata: 'Yaprak yok', katman: 1, dusuk_confidence: false };
            deps.aiClient.predict.mockResolvedValue(failure);

            await expect(service.diagnose(Buffer.from('raw'), 'user-1')).resolves.toBe(failure);
            expect(deps.imageStorage.save).not.toHaveBeenCalled();
            expect(deps.diagnosisRepository.create).not.toHaveBeenCalled();
        });

        it('never recommends a treatment for an uncertain disease result', async () => {
            const { service, deps } = createService();
            deps.aiClient.predict.mockResolvedValue(successfulPrediction({
                katman3_hastalik: { durum: 'belirsiz', hastalik: null, saglikli: null, confidence: 48.2, top3: [] },
            }));

            const result = await service.diagnose(Buffer.from('raw'), 'user-1');

            expect(deps.plantRepository.findDisease).not.toHaveBeenCalled();
            expect(deps.diagnosisRepository.create).toHaveBeenCalledWith(expect.objectContaining({
                diseaseId: null, diseaseStatus: 'belirsiz',
            }));
            expect(result.tedavi_onerisi).toMatch(/kesin olmadığı için ilaç önerisi verilmedi/);
            expect(result.healthStatus).toMatchObject({ status: 'belirsiz', isHealthy: null, diseaseDisplayName: null });
        });

        it('falls back to the catalog treatment when the database is offline', async () => {
            const { service, deps } = createService({ connected: false });
            deps.aiClient.predict.mockResolvedValue(successfulPrediction());

            const result = await service.diagnose(Buffer.from('raw'), 'user-1');

            expect(deps.diagnosisRepository.create).not.toHaveBeenCalled();
            expect(result.veritabani_kayitli).toBe(false);
            expect(result.tedavi_onerisi).toMatch(/Bakteriyel Leke/);
        });
    });

    describe('deleteOne', () => {
        it('deletes only the requesting user\'s record and removes its image', async () => {
            const { service, deps } = createService();
            deps.diagnosisRepository.deleteForUser.mockResolvedValue({ resim_yolu: 'img_test.jpg' });

            await service.deleteOne('12', 'user-1');

            expect(deps.diagnosisRepository.deleteForUser).toHaveBeenCalledWith('12', 'user-1');
            expect(deps.imageStorage.remove).toHaveBeenCalledWith('img_test.jpg');
        });

        it('throws NotFoundError with the requested id when the record is missing or not owned', async () => {
            const { service, deps } = createService();
            deps.diagnosisRepository.deleteForUser.mockResolvedValue(null);

            const error = await service.deleteOne('999', 'user-1').catch(e => e);

            expect(error).toBeInstanceOf(NotFoundError);
            expect(error.details).toEqual({ talep_edilen_id: '999' });
            expect(deps.imageStorage.remove).not.toHaveBeenCalled();
        });

        it('requires the user identity', async () => {
            const { service } = createService();
            await expect(service.deleteOne('12', null)).rejects.toBeInstanceOf(ValidationError);
        });

        it('throws ServiceUnavailableError when the database is offline', async () => {
            const { service } = createService({ connected: false });
            await expect(service.deleteOne('12', 'user-1')).rejects.toBeInstanceOf(ServiceUnavailableError);
        });
    });

    describe('getImagePath', () => {
        it('returns the path only for the owner of the image', async () => {
            const { service, deps } = createService();
            deps.diagnosisRepository.userOwnsImage = jest.fn().mockResolvedValue(true);
            deps.imageStorage.pathFor = jest.fn().mockResolvedValue('/uploads/img_test.jpg');

            await expect(service.getImagePath('img_test.jpg', 'user-1')).resolves.toBe('/uploads/img_test.jpg');
            expect(deps.diagnosisRepository.userOwnsImage).toHaveBeenCalledWith('img_test.jpg', 'user-1');
        });

        it('hides images that belong to someone else', async () => {
            const { service, deps } = createService();
            deps.diagnosisRepository.userOwnsImage = jest.fn().mockResolvedValue(false);
            deps.imageStorage.pathFor = jest.fn();

            await expect(service.getImagePath('img_test.jpg', 'intruder')).rejects.toBeInstanceOf(NotFoundError);
            expect(deps.imageStorage.pathFor).not.toHaveBeenCalled();
        });
    });

    describe('getLabels', () => {
        it('delegates to the AI client', () => {
            const { service, deps } = createService();
            deps.aiClient.getLabels.mockReturnValue([{ key: 'apple' }]);
            expect(service.getLabels()).toEqual([{ key: 'apple' }]);
        });
    });
});
