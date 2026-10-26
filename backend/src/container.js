const paths = require('./config/paths');
const db = require('./config/db');
const DatabaseInitializer = require('./config/DatabaseInitializer');
const UserRepository = require('./repositories/UserRepository');
const PlantRepository = require('./repositories/PlantRepository');
const DiagnosisRepository = require('./repositories/DiagnosisRepository');
const AiDaemonClient = require('./services/AiDaemonClient');
const ImageStorage = require('./services/ImageStorage');
const AuthService = require('./services/AuthService');
const DiagnosisService = require('./services/DiagnosisService');
const AuthController = require('./controllers/AuthController');
const DiagnoseController = require('./controllers/DiagnoseController');

/**
 * Composition root: uygulamanın tüm nesnelerini tek bir yerde oluşturur ve bağımlılıklarını
 * constructor üzerinden enjekte eder. Sınıflar birbirini doğrudan `require` etmediği için
 * testlerde sahte (fake) bağımlılıklarla kolayca değiştirilebilir.
 */
const userRepository = new UserRepository(db);
const plantRepository = new PlantRepository(db);
const diagnosisRepository = new DiagnosisRepository(db);

const aiClient = new AiDaemonClient({
    paths,
    pythonExecutable: process.env.PYTHON_PATH || 'python',
    port: parseInt(process.env.AI_DAEMON_PORT, 10) || 5005,
});
const imageStorage = new ImageStorage(paths.UPLOADS_DIR);

const authService = new AuthService({ db, userRepository });
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
    imageStorage,
    databaseInitializer: new DatabaseInitializer({ db, plantRepository }),
    authController: new AuthController(authService),
    diagnoseController: new DiagnoseController(diagnosisService),
};
