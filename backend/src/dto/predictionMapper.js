const PlantCatalog = require('../domain/PlantCatalog');

const toPercent = (value) => parseFloat((value * 100).toFixed(1));

/**
 * Python daemon'ın ham çıktısını Türkçe isimler ve yüzde güven değerleri içeren
 * iç sonuç biçimine dönüştürür.
 */
function toPredictionResult(raw, elapsedMs) {
    if (!raw.basarili) {
        return {
            basarili: false,
            hata: raw.hata,
            katman: raw.katman || null,
            dusuk_confidence: raw.dusuk_confidence || false,
        };
    }

    const k1 = raw.katman1_yaprak;
    const k2 = raw.katman2_bitki;
    const k3 = raw.katman3_hastalik;
    const plantTr = PlantCatalog.plantDisplayName(k2.tur);
    // Hastalık modeli yoksa veya hata verdiyse "Sağlıklı" varsayılmaz
    const diseaseTr = k3.hastalik ? PlantCatalog.diseaseDisplayName(k3.hastalik) : null;

    return {
        basarili: true,
        tahmin: {
            bitki: plantTr,
            bitki_key: k2.tur,
            hastalik: diseaseTr,
            saglikli: k3.saglikli,
            hastalik_durumu: k3.durum,
        },
        katman1_yaprak: {
            tespit_edildi: k1.tespit_edildi,
            confidence: toPercent(k1.confidence),
            bbox: k1.bbox,
            toplam_tespit: k1.toplam_tespit,
            crop_base64: k1.crop_base64,
        },
        katman2_bitki: {
            tur: k2.tur,
            tur_tr: plantTr,
            confidence: toPercent(k2.confidence),
            top3: (k2.top3 || []).map(t => ({
                tur: t.tur,
                tur_tr: PlantCatalog.plantDisplayName(t.tur),
                confidence: toPercent(t.confidence),
            })),
        },
        katman3_hastalik: {
            durum: k3.durum,
            hastalik: k3.hastalik || null,
            hastalik_tr: diseaseTr,
            saglikli: k3.saglikli,
            confidence: k3.confidence ? toPercent(k3.confidence) : null,
            dusuk_confidence: k3.dusuk_confidence || false,
            mesaj: k3.mesaj || null,
            top3: (k3.top3 || []).map(t => ({
                hastalik: t.hastalik,
                hastalik_tr: PlantCatalog.diseaseDisplayName(t.hastalik),
                confidence: toPercent(t.confidence),
            })),
        },
        sure_ms: elapsedMs,
    };
}

module.exports = { toPredictionResult };
