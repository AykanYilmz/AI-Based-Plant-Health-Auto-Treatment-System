/**
 * Ham AI pipeline sonuçlarını ve veritabanı kayıt detaylarını temiz, kararlı bir API sözleşmesine dönüştürür.
 * 
 * @param {Object} result - aiService.predict'ten dönen ham sonuç nesnesi
 * @param {number|null} dbId - PostgreSQL veritabanından dönen kayıt ID'si
 * @param {string|null} filename - Diske kaydedilen görsel dosya adı
 * @param {string} tedaviOnerisi - Teşhise özel Türkçe tedavi önerisi metni
 * @returns {Object} Kararlı frontend API veri transfer nesnesi (DTO)
 */
function toDiagnosisResponse(result, dbId, filename, tedaviOnerisi) {
    const k1 = result?.katman1_yaprak || {};
    const k2 = result?.katman2_bitki || {};
    const k3 = result?.katman3_hastalik || {};

    return {
        basarili: true,
        veritabani_kayitli: !!dbId,
        kayit_id: dbId || null,
        resim_yolu: filename || null,
        tedavi_onerisi: tedaviOnerisi || 'Tedavi önerisi oluşturulamadı.',
        leafDetection: {
            detected: k1.tespit_edildi || false,
            confidence: k1.confidence || 0,
            bbox: k1.bbox || null,
            totalCount: k1.toplam_tespit || 0
        },
        plantInfo: {
            name: k2.tur || 'unknown',
            displayName: k2.tur_tr || 'Bilinmeyen Bitki',
            confidence: k2.confidence || 0,
            top3: (k2.top3 || []).map(t => ({
                name: t.tur,
                displayName: t.tur_tr,
                confidence: t.confidence
            }))
        },
        healthStatus: {
            status: k3.durum || 'unknown',
            // Kesin teşhis yoksa (belirsiz, model yok, hata) "sağlıklı" varsayılmaz
            isHealthy: k3.saglikli ?? null,
            diseaseName: k3.hastalik || null,
            diseaseDisplayName: k3.hastalik_tr || null,
            confidence: k3.confidence || 0,
            lowConfidence: k3.dusuk_confidence || false,
            message: k3.mesaj || null,
            top3: (k3.top3 || []).map(t => ({
                diseaseName: t.hastalik,
                diseaseDisplayName: t.hastalik_tr,
                confidence: t.confidence
            }))
        }
    };
}

module.exports = {
    toDiagnosisResponse
};
