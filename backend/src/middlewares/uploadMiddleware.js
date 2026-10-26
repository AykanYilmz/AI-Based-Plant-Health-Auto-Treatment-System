const multer = require('multer');
const { ValidationError } = require('../errors/AppError');

// Bellekte sakla (diske yazmadan doğrudan buffer olarak işle)
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // Maksimum 10 MB
    },
    fileFilter: (req, file, cb) => {
        // Sadece resim dosyalarına izin ver
        const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new ValidationError('Sadece JPEG, PNG ve WebP formatları kabul edilmektedir.'), false);
        }
    }
});

module.exports = upload;
