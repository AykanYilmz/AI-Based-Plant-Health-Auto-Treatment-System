"""
3 Katmanlı AI Pipeline - Bitki Analiz Sistemi
==============================================
Katman 1: YOLO ile yaprak tespiti (bounding box → crop)
Katman 2: MobileNet (Keras) ile bitki türü sınıflandırma
Katman 3: Bitki türüne özel hastalık tespiti (Keras)

Kullanım:
    Daemon (Node.js tarafından başlatılır):
        python predict_pipeline.py --server <yolo_model> <plant_model> <class_names> <disease_models_dir> [--port 5005]
    Tek görüntü (hata ayıklama için):
        python predict_pipeline.py <yolo_model> <plant_model> <class_names> <image_path> <disease_models_dir>
"""

import sys
import json
import os
import io
import base64
import http.server
import threading

# Kritik: Tüm bilgi ve uyarı mesajlarını kapat (stdout/stderr kirletmesin)
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'  # oneDNN CPU optimizasyon uyarılarını gizler
os.environ['YOLO_VERBOSE'] = 'False'
os.environ['TF_USE_LEGACY_KERAS'] = '1'

import warnings
warnings.filterwarnings('ignore')

import numpy as np
from PIL import Image

# ─── YOLO Import ───────────────────────────────────────────
try:
    from ultralytics import YOLO
except ImportError:
    print(json.dumps({
        "basarili": False,
        "hata": "ultralytics paketi kurulu değil. Kurulum: pip install ultralytics"
    }))
    sys.exit(1)

# ─── Keras Import ─────────────────────────────────────────
try:
    import tf_keras as keras
except ImportError:
    try:
        import tensorflow.keras as keras
    except ImportError:
        print(json.dumps({"basarili": False, "hata": "Keras kurulu değil."}))
        sys.exit(1)


def read_class_names(path):
    with open(path, 'r', encoding='utf-8') as f:
        return [line.strip() for line in f if line.strip()]


def log(message):
    # stdout yerine stderr kullanılır; Node.js tarafı bunu [PYTHON] logu olarak gösterir
    sys.stderr.write(f"{message}\n")


class PipelineError(Exception):
    """Pipeline'ın belirli bir katmanında, kullanıcıya gösterilebilir bir nedenle durması."""

    def __init__(self, message, katman, **extra):
        super().__init__(message)
        self.katman = katman
        self.extra = extra

    def to_dict(self):
        return {"basarili": False, "hata": str(self), "katman": self.katman, **self.extra}


# ═══════════════════════════════════════════════════════════════════
#  KATMAN 1: YAPRAK TESPİTİ
# ═══════════════════════════════════════════════════════════════════

class LeafDetector:
    """YOLO ile görüntüdeki en güvenilir yaprağı bulur ve kenar payıyla kırpar."""

    CONFIDENCE_THRESHOLD = 0.55
    MIN_BOX_SIZE = 80      # piksel; daha küçük kutular uzaktan çekilmiş kabul edilir
    PADDING_RATIO = 0.15   # kırpıma eklenecek kenar payı

    def __init__(self, model_path):
        self._model = YOLO(model_path)

    def detect(self, image):
        """
        :param image: RGB PIL görüntüsü
        :return: {'crop', 'confidence', 'bbox', 'toplam_tespit'}
        :raises PipelineError: yaprak bulunamazsa
        """
        try:
            results = self._model.predict(source=image, conf=self.CONFIDENCE_THRESHOLD, verbose=False)
        except Exception as e:
            raise PipelineError(f"YOLO yaprak tespiti hatası: {e}", katman=1)

        if not results:
            raise PipelineError("YOLO sonuç döndürmedi.", katman=1)

        boxes = results[0].boxes
        if boxes is None or len(boxes) == 0:
            raise PipelineError("Fotoğrafta yaprak tespit edilemedi. Lütfen yaprağı daha net çekin.", katman=1)

        valid_boxes = [b for b in (self._to_box(box) for box in boxes)
                       if b['w'] >= self.MIN_BOX_SIZE and b['h'] >= self.MIN_BOX_SIZE]
        if not valid_boxes:
            raise PipelineError("Yeterli büyüklükte yaprak tespit edilemedi. Lütfen bitkiye biraz daha yaklaşın.", katman=1)

        best = max(valid_boxes, key=lambda b: b['conf'])
        bbox = self._padded_bbox(best, *image.size)

        return {
            'crop': image.crop(bbox),
            'confidence': best['conf'],
            'bbox': list(bbox),
            'toplam_tespit': len(valid_boxes),
        }

    @staticmethod
    def _to_box(box):
        x1, y1, x2, y2 = (float(v) for v in box.xyxy[0].cpu().numpy())
        return {'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2,
                'w': x2 - x1, 'h': y2 - y1,
                'conf': float(box.conf[0].cpu().numpy())}

    def _padded_bbox(self, box, img_w, img_h):
        pad_x = box['w'] * self.PADDING_RATIO
        pad_y = box['h'] * self.PADDING_RATIO
        return (
            int(max(0, box['x1'] - pad_x)),
            int(max(0, box['y1'] - pad_y)),
            int(min(img_w, box['x2'] + pad_x)),
            int(min(img_h, box['y2'] + pad_y)),
        )


# ═══════════════════════════════════════════════════════════════════
#  KATMAN 2 ve 3: KERAS SINIFLANDIRICILARI
# ═══════════════════════════════════════════════════════════════════

class KerasClassifier:
    """
    Keras görüntü sınıflandırıcıları için ortak taban sınıf.
    Modellerin içinde Rescaling(1/127.5, -1) katmanı olduğu için girdi ham 0-255 float32 olarak verilir.
    """

    INPUT_SIZE = (224, 224)

    def __init__(self, model, class_names):
        self._model = model
        self.class_names = class_names

    @classmethod
    def from_files(cls, model_path, class_names_path):
        return cls(keras.models.load_model(model_path), read_class_names(class_names_path))

    def warm_up(self):
        self._model.predict(np.zeros((1, *self.INPUT_SIZE, 3), dtype=np.float32), verbose=0)

    def _predict_probabilities(self, image):
        if image.mode != 'RGB':
            image = image.convert('RGB')
        resized = image.resize(self.INPUT_SIZE, Image.LANCZOS)
        batch = np.expand_dims(np.array(resized, dtype=np.float32), axis=0)
        return self._model.predict(batch, verbose=0)[0]

    def _name_of(self, index):
        return self.class_names[index] if index < len(self.class_names) else f"bilinmeyen_{index}"

    def _top_k(self, probabilities, k=3):
        return [(self._name_of(int(i)), float(probabilities[i])) for i in np.argsort(probabilities)[::-1][:k]]


class PlantClassifier(KerasClassifier):
    """Katman 2: Kırpılmış yapraktan bitki türünü tahmin eder."""

    MIN_CONFIDENCE = 0.50

    def classify(self, image):
        try:
            probabilities = self._predict_probabilities(image)
        except Exception as e:
            raise PipelineError(f"Bitki sınıflandırma hatası: {e}", katman=2)

        best_idx = int(np.argmax(probabilities))
        result = {
            'tur': self._name_of(best_idx),
            'confidence': float(probabilities[best_idx]),
            'sinif_index': best_idx,
            'top3': [{'tur': name, 'confidence': conf} for name, conf in self._top_k(probabilities)],
        }

        if result['confidence'] < self.MIN_CONFIDENCE:
            raise PipelineError("Bitki türü yeterince güvenilir tespit edilemedi.", katman=2,
                                confidence=result['confidence'], dusuk_confidence=True)
        return result


class DiseaseClassifier(KerasClassifier):
    """
    Katman 3: Belirli bir bitki türüne özel hastalık tespiti.

    Güven eşikleri (yanlış ilaç önerisini önlemek için):
      - MIN_CONFIDENCE altı      → 'belirsiz': kesin teşhis ve tedavi verilmez, olası sonuçlar listelenir
      - LOW_CONFIDENCE altı      → 'tespit_edildi' + dusuk_confidence uyarısı
    """

    MIN_CONFIDENCE = 0.60
    LOW_CONFIDENCE_THRESHOLD = 0.70

    def diagnose(self, image):
        probabilities = self._predict_probabilities(image)
        best_idx = int(np.argmax(probabilities))
        disease_name = self._name_of(best_idx)
        confidence = float(probabilities[best_idx])
        top3 = [{'hastalik': name, 'confidence': conf} for name, conf in self._top_k(probabilities)]

        if confidence < self.MIN_CONFIDENCE:
            return {
                'durum': 'belirsiz',
                'hastalik': None,
                'saglikli': None,
                'confidence': confidence,
                'dusuk_confidence': True,
                'mesaj': "Hastalık teşhisi kesin değil. Yaprağı daha yakından, iyi ışıkta ve net "
                         "çekip tekrar deneyin.",
                'top3': top3,
            }

        return {
            'durum': 'tespit_edildi',
            'hastalik': disease_name,
            'saglikli': disease_name.lower() == 'healthy',
            'confidence': confidence,
            'sinif_index': best_idx,
            'dusuk_confidence': confidence < self.LOW_CONFIDENCE_THRESHOLD,
            'top3': top3,
            'tum_sonuclar': {self._name_of(i): float(p) for i, p in enumerate(probabilities)},
        }


# ═══════════════════════════════════════════════════════════════════
#  PIPELINE
# ═══════════════════════════════════════════════════════════════════

class PlantDiagnosisPipeline:
    """Üç katmanı sırasıyla çalıştırır. Tüm modeller oluşturulurken bir kez belleğe yüklenir."""

    SUPPORTED_PLANTS = ['apple', 'bell_pepper', 'cherry', 'corn', 'grape', 'peach', 'potato', 'strawberry', 'tomato']

    def __init__(self, leaf_detector, plant_classifier, disease_classifiers):
        self._leaf_detector = leaf_detector
        self._plant_classifier = plant_classifier
        self._disease_classifiers = disease_classifiers

    @classmethod
    def from_paths(cls, yolo_model_path, plant_model_path, class_names_path, disease_models_dir):
        log("[Daemon] YOLO modeli yükleniyor...")
        leaf_detector = LeafDetector(yolo_model_path)

        log("[Daemon] Bitki sınıflandırma modeli yükleniyor...")
        plant_classifier = PlantClassifier.from_files(plant_model_path, class_names_path)

        disease_classifiers = {}
        for plant in cls.SUPPORTED_PLANTS:
            model_path = os.path.join(disease_models_dir, f"{plant}_disease_model.keras")
            class_path = os.path.join(disease_models_dir, f"{plant}_disease_classes.txt")
            if os.path.exists(model_path) and os.path.exists(class_path):
                log(f"[Daemon] {plant} hastalık modeli yükleniyor...")
                disease_classifiers[plant] = DiseaseClassifier.from_files(model_path, class_path)

        plant_classifier.warm_up()
        log("[Daemon] Warm-up tamamlandı.")
        return cls(leaf_detector, plant_classifier, disease_classifiers)

    def run(self, image_bytes):
        """Görüntüyü analiz eder; her durumda JSON'a çevrilebilir bir sözlük döndürür."""
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
            leaf = self._leaf_detector.detect(image)
            plant = self._plant_classifier.classify(leaf['crop'])
            disease = self._diagnose_disease(plant['tur'], leaf['crop'])
        except PipelineError as e:
            return e.to_dict()
        except Exception as e:
            return {"basarili": False, "hata": str(e)}

        return {
            "basarili": True,
            "katman1_yaprak": {
                "tespit_edildi": True,
                "confidence": leaf['confidence'],
                "bbox": leaf['bbox'],
                "toplam_tespit": leaf['toplam_tespit'],
                "crop_base64": self._to_base64_jpeg(leaf['crop']),
            },
            "katman2_bitki": plant,
            "katman3_hastalik": disease,
        }

    def _diagnose_disease(self, plant_type, crop):
        plant_key = plant_type.replace(" ", "_")
        classifier = self._disease_classifiers.get(plant_key)
        if classifier is None:
            return self._disease_status('model_yok', f"'{plant_key}' için henüz hastalık modeli bulunmuyor.")
        try:
            return classifier.diagnose(crop)
        except Exception as e:
            return self._disease_status('hata', f"Hastalık tespiti hatası: {e}")

    @staticmethod
    def _disease_status(durum, mesaj):
        return {'durum': durum, 'hastalik': None, 'saglikli': None, 'confidence': None, 'mesaj': mesaj}

    @staticmethod
    def _to_base64_jpeg(image):
        buffered = io.BytesIO()
        image.save(buffered, format="JPEG")
        return base64.b64encode(buffered.getvalue()).decode('utf-8')


# ═══════════════════════════════════════════════════════════════════
#  DAEMON (HTTP SUNUCU) MODU
# ═══════════════════════════════════════════════════════════════════

class InferenceServer:
    """Pipeline'ı localhost üzerinde HTTP ile sunar (POST /predict, GET /health)."""

    def __init__(self, pipeline, port, host='127.0.0.1'):
        self._address = (host, port)
        self._httpd = http.server.HTTPServer(self._address, self._make_handler(pipeline))

    def serve_forever(self):
        thread = threading.Thread(target=self._httpd.serve_forever, daemon=True)
        thread.start()
        log(f"\n🌿 Bitki Analiz Daemon Sunucusu HAZIR (Adres: http://{self._address[0]}:{self._address[1]})")
        try:
            thread.join()
        except KeyboardInterrupt:
            self._httpd.shutdown()

    @staticmethod
    def _make_handler(pipeline):
        class InferenceHandler(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                if self.path != '/predict':
                    self._json_response(404, {"basarili": False, "hata": "Endpoint bulunamadı"})
                    return
                try:
                    content_length = int(self.headers.get('Content-Length', 0))
                    if content_length == 0:
                        self._json_response(400, {"basarili": False, "hata": "Boş istek gövdesi"})
                        return
                    self._json_response(200, pipeline.run(self.rfile.read(content_length)))
                except Exception as e:
                    self._json_response(500, {"basarili": False, "hata": str(e)})

            def do_GET(self):
                if self.path == '/health':
                    self._json_response(200, {"status": "ready"})
                else:
                    self._json_response(404, {"basarili": False, "hata": "Endpoint bulunamadı"})

            def _json_response(self, status_code, data):
                body = json.dumps(data, ensure_ascii=False).encode('utf-8')
                self.send_response(status_code)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, format, *args):
                pass

        return InferenceHandler


def main(argv):
    if len(argv) >= 2 and argv[1] == '--server':
        if len(argv) < 6:
            sys.exit(1)
        yolo_path, plant_path, class_path, disease_dir = argv[2:6]
        port = 5005
        if '--port' in argv:
            port_idx = argv.index('--port')
            if port_idx + 1 < len(argv):
                port = int(argv[port_idx + 1])

        pipeline = PlantDiagnosisPipeline.from_paths(yolo_path, plant_path, class_path, disease_dir)
        InferenceServer(pipeline, port).serve_forever()
        return

    # Tek görüntü modu (hata ayıklama)
    if len(argv) < 6:
        print(json.dumps({"basarili": False, "hata": "Eksik argümanlar."}))
        sys.exit(1)
    yolo_path, plant_path, class_path, image_path, disease_dir = argv[1:6]
    for fpath in (yolo_path, plant_path, class_path, image_path):
        if not os.path.exists(fpath):
            print(json.dumps({"basarili": False, "hata": f"Dosya bulunamadı: {fpath}"}))
            sys.exit(1)

    pipeline = PlantDiagnosisPipeline.from_paths(yolo_path, plant_path, class_path, disease_dir)
    with open(image_path, 'rb') as f:
        result = pipeline.run(f.read())
    result.get('katman1_yaprak', {}).pop('crop_base64', None)  # Konsolu devasa base64 ile doldurma
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv)
