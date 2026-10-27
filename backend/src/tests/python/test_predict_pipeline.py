"""
predict_pipeline.py birim testleri.

Gerçek modeller yüklenmez; sahte (fake) modellerle eşik mantığı, hata durumları ve
yaprak kırpma hesabı test edilir. Çalıştırma: backend klasöründe `npm run test:python`.
"""
import io
import os
import sys

import numpy as np
import pytest
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'services'))
import predict_pipeline as pp  # noqa: E402


# ─── Sahte modeller ───────────────────────────────────────

class FakeKerasModel:
    """Her çağrıda verilen olasılık dağılımını döndüren sahte Keras modeli."""

    def __init__(self, probabilities):
        self.probabilities = np.array([probabilities], dtype=np.float32)
        self.calls = 0

    def predict(self, batch, verbose=0):
        self.calls += 1
        assert batch.shape == (1, 224, 224, 3)
        return self.probabilities


class FakeTensor:
    def __init__(self, values):
        self._values = np.array(values, dtype=np.float32)

    def cpu(self):
        return self

    def numpy(self):
        return self._values


class FakeBox:
    def __init__(self, xyxy, conf):
        # Ultralytics'te box.xyxy[0] 4 elemanlı, box.conf[0] ise sıfır boyutlu (skaler) tensördür
        self.xyxy = [FakeTensor(xyxy)]
        self.conf = [FakeTensor(conf)]


class FakeYoloResult:
    def __init__(self, boxes):
        self.boxes = boxes


class FakeYolo:
    def __init__(self, boxes):
        self._boxes = boxes

    def predict(self, source, conf, verbose):
        return [FakeYoloResult(self._boxes)]


def make_leaf_detector(boxes):
    detector = pp.LeafDetector.__new__(pp.LeafDetector)  # YOLO dosyası yüklemeden
    detector._model = FakeYolo(boxes)
    return detector


def image(width=400, height=300):
    return Image.new('RGB', (width, height), (40, 160, 60))


def jpeg_bytes(img):
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG')
    return buffer.getvalue()


# ─── Katman 3: hastalık güven eşikleri ────────────────────

DISEASES = ['Early Blight', 'Healthy', 'Late Blight']


def disease_classifier(probabilities):
    return pp.DiseaseClassifier(FakeKerasModel(probabilities), DISEASES)


def test_disease_below_min_confidence_is_uncertain_without_diagnosis():
    result = disease_classifier([0.20, 0.35, 0.45]).diagnose(image())

    assert result['durum'] == 'belirsiz'
    assert result['hastalik'] is None and result['saglikli'] is None
    assert result['dusuk_confidence'] is True
    assert [t['hastalik'] for t in result['top3']] == ['Late Blight', 'Healthy', 'Early Blight']


def test_disease_between_thresholds_is_diagnosed_with_low_confidence_warning():
    result = disease_classifier([0.05, 0.30, 0.65]).diagnose(image())

    assert result['durum'] == 'tespit_edildi'
    assert result['hastalik'] == 'Late Blight'
    assert result['saglikli'] is False
    assert result['dusuk_confidence'] is True


def test_confident_healthy_result():
    result = disease_classifier([0.02, 0.95, 0.03]).diagnose(image())

    assert result['durum'] == 'tespit_edildi'
    assert result['saglikli'] is True
    assert result['dusuk_confidence'] is False
    assert pytest.approx(sum(result['tum_sonuclar'].values()), rel=1e-5) == 1.0


# ─── Katman 2: bitki türü ─────────────────────────────────

PLANTS = ['apple', 'bell pepper', 'tomato']


def test_low_plant_confidence_stops_pipeline_with_uncertain_flag():
    classifier = pp.PlantClassifier(FakeKerasModel([0.40, 0.35, 0.25]), PLANTS)

    with pytest.raises(pp.PipelineError) as error:
        classifier.classify(image())

    payload = error.value.to_dict()
    assert payload['basarili'] is False and payload['katman'] == 2
    assert payload['dusuk_confidence'] is True
    assert payload['confidence'] == pytest.approx(0.40)


def test_confident_plant_result():
    result = pp.PlantClassifier(FakeKerasModel([0.05, 0.90, 0.05]), PLANTS).classify(image())

    assert result['tur'] == 'bell pepper'
    assert result['top3'][0] == {'tur': 'bell pepper', 'confidence': pytest.approx(0.90)}


# ─── Katman 1: yaprak tespiti ─────────────────────────────

def test_leaf_detector_picks_most_confident_large_box_with_padding():
    detector = make_leaf_detector([
        FakeBox([10, 10, 60, 60], 0.99),    # 50px: çok küçük, elenir
        FakeBox([100, 50, 300, 250], 0.80),  # 200x200
        FakeBox([0, 0, 120, 120], 0.70),
    ])

    result = detector.detect(image(400, 300))

    assert result['confidence'] == pytest.approx(0.80)
    assert result['toplam_tespit'] == 2
    # %15 kenar payı: 200 * 0.15 = 30 piksel, görüntü sınırlarına kırpılır
    assert result['bbox'] == [70, 20, 330, 280]
    assert result['crop'].size == (260, 260)


def test_leaf_detector_rejects_images_without_large_enough_leaf():
    with pytest.raises(pp.PipelineError) as error:
        make_leaf_detector([FakeBox([0, 0, 50, 50], 0.9)]).detect(image())
    assert error.value.katman == 1

    with pytest.raises(pp.PipelineError):
        make_leaf_detector([]).detect(image())


# ─── Pipeline ─────────────────────────────────────────────

class StubLeafDetector:
    def detect(self, img):
        return {'crop': img.crop((0, 0, 200, 200)), 'confidence': 0.9, 'bbox': [0, 0, 200, 200], 'toplam_tespit': 1}


def pipeline(disease_classifiers):
    plant = pp.PlantClassifier(FakeKerasModel([0.02, 0.03, 0.95]), PLANTS)
    return pp.PlantDiagnosisPipeline(StubLeafDetector(), plant, disease_classifiers)


def test_pipeline_returns_all_layers_and_crop():
    result = pipeline({'tomato': disease_classifier([0.9, 0.05, 0.05])}).run(jpeg_bytes(image()))

    assert result['basarili'] is True
    assert result['katman2_bitki']['tur'] == 'tomato'
    assert result['katman3_hastalik']['hastalik'] == 'Early Blight'
    crop = Image.open(io.BytesIO(__import__('base64').b64decode(result['katman1_yaprak']['crop_base64'])))
    assert crop.size == (200, 200)


def test_pipeline_reports_missing_disease_model():
    result = pipeline({}).run(jpeg_bytes(image()))

    assert result['basarili'] is True
    assert result['katman3_hastalik']['durum'] == 'model_yok'


def test_pipeline_reports_disease_model_errors_without_failing():
    class BrokenModel:
        def predict(self, batch, verbose=0):
            raise RuntimeError('model bozuk')

    result = pipeline({'tomato': pp.DiseaseClassifier(BrokenModel(), DISEASES)}).run(jpeg_bytes(image()))

    assert result['basarili'] is True
    assert result['katman3_hastalik']['durum'] == 'hata'
    assert 'model bozuk' in result['katman3_hastalik']['mesaj']


def test_pipeline_rejects_non_image_bytes():
    result = pipeline({}).run(b'bu bir resim degil')

    assert result['basarili'] is False
