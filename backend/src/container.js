const crypto = require('crypto');
const paths = require('./config/paths');
const db = require('./config/db');
const logger = require('./utils/logger');
const DatabaseInitializer = require('./database/DatabaseInitializer');
const Migrator = require('./database/Migrator');
const CatalogSeeder = require('./database/CatalogSeeder');
const UserRepository = require('./repositories/UserRepository');
const PlantRepository = require('./repositories/PlantRepository');
const DiagnosisRepository = require('./repositories/DiagnosisRepository');
const RefreshTokenRepository = require('./repositories/RefreshTokenRepository');
const AiDaemonClient = require('./services/AiDaemonClient');
const ImageStorage = require('./services/ImageStorage');
const TokenService = require('./services/TokenService');
const AuthService = require('./services/AuthService');
const DiagnosisService = require('./services/DiagnosisService');
const AuthController = require('./controllers/AuthController');
const DiagnoseController = require('./controllers/DiagnoseController');
const createAuthenticate = require('./middlewares/authenticate');

/**
 * JWT imzalama anahtarı. Canlı ortamda .env'de JWT_SECRET zorunludur; geliştirmede tanımlı değilse
 * geçici bir anahtar üretilir (sunucu her yeniden başladığında oturumlar düşer).
 */
function resolveJwtSecret() {
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET ortam değişkeni tanımlı değil. Canlı ortamda zorunludur.');
    }
    logger.warn('⚠️ JWT_SECRET tanımlı değil; geçici anahtar üretildi. Sunucu yeniden başladığında tüm oturumlar düşer. backend/.env dosyasına JWT_SECRET ekleyin.');
    return crypto.randomBytes(48).toString('hex');
}

/**
 * Composition root: uygulamanın tüm nesnelerini tek bir yerde oluşturur ve bağımlılıklarını
 * constructor üzerinden enjekte eder. Sınıflar birbirini doğrudan `require` etmediği için
 * testlerde sahte (fake) bağımlılıklarla kolayca değiştirilebilir.
 */
const userRepository = new UserRepository(db);
const plantRepository = new PlantRepository(db);
const diagnosisRepository = new DiagnosisRepository(db);
const refreshTokenRepository = new RefreshTokenRepository(db);

const aiClient = new AiDaemonClient({
    paths,
    pythonExecutable: process.env.PYTHON_PATH || 'python',
    port: parseInt(process.env.AI_DAEMON_PORT, 10) || 5005,
});
const imageStorage = new ImageStorage(paths.UPLOADS_DIR);
const tokenService = new TokenService({ secret: resolveJwtSecret(), refreshTokenRepository });

const authService = new AuthService({ db, userRepository, tokenService });
const diagnosisService = new DiagnosisService({
    db,
    aiClient,
    imageStorage,
    userRepository,
    plantRepository,
    diagnosisRepository,
});

module.exports = {
    db,
    aiClient,
    refreshTokenRepository,
    databaseInitializer: new DatabaseInitializer({ db, migrator: new Migrator(db), seeder: new CatalogSeeder(db) }),
    authenticate: createAuthenticate(tokenService),
    authController: new AuthController(authService),
    diagnoseController: new DiagnoseController(diagnosisService),
};
