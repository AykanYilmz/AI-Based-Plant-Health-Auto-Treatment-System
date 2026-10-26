const errorHandler = require('../middlewares/errorHandler');
const { NotFoundError } = require('../errors/AppError');

jest.mock('../utils/logger');

function createResponse() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

const req = { method: 'GET', originalUrl: '/api/test' };

describe('errorHandler', () => {
    it('returns AppError status, message and details', () => {
        const res = createResponse();
        errorHandler(new NotFoundError('Kayıt yok', { talep_edilen_id: '5' }), req, res, () => {});

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ basarili: false, hata: 'Kayıt yok', talep_edilen_id: '5' });
    });

    it('does not leak internal error messages', () => {
        const res = createResponse();
        errorHandler(new Error('password authentication failed for user "postgres"'), req, res, () => {});

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ basarili: false, hata: 'Beklenmeyen bir sunucu hatası oluştu.' });
    });
});
