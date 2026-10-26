const path = require('path');

// Proje genelinde kullanılan dosya yolları için tek kaynak
const BACKEND_ROOT = path.join(__dirname, '..', '..');
const PROJECT_ROOT = path.join(BACKEND_ROOT, '..');
const ACTIVE_MODELS_DIR = path.join(PROJECT_ROOT, 'ai_model', 'active_models');

module.exports = Object.freeze({
    BACKEND_ROOT,
    UPLOADS_DIR: path.join(BACKEND_ROOT, 'uploads'),
    LOGS_DIR: path.join(BACKEND_ROOT, 'logs'),
    PIPELINE_SCRIPT: path.join(__dirname, '..', 'services', 'predict_pipeline.py'),
    YOLO_MODEL_PATH: path.join(ACTIVE_MODELS_DIR, 'yolo_leaf_best.pt'),
    PLANT_MODEL_PATH: path.join(ACTIVE_MODELS_DIR, 'plant_mobilenetv3large_best.keras'),
    CLASS_NAMES_PATH: path.join(ACTIVE_MODELS_DIR, 'class_names.txt'),
    DISEASE_MODELS_DIR: path.join(ACTIVE_MODELS_DIR, 'disease_models'),
});
