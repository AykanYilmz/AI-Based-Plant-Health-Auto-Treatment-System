const STATUS_STYLES = {
    healthy: { color: '#34C759', bg: 'rgba(52, 199, 89, 0.1)' },
    disease: { color: '#FF3B30', bg: 'rgba(255, 59, 48, 0.1)' },
    uncertain: { color: '#FF9500', bg: 'rgba(255, 149, 0, 0.1)' },
};

/**
 * Teşhis geçmişi kaydının durumunu tek yerden yorumlar.
 * Kesin teşhis olmayan kayıtlar (belirsiz, model yok, hata) asla "hastalık bulundu" olarak gösterilmez.
 *
 * @param {{ hastalik_durum: string, hastalik_adi?: string, hastalik_adi_tr?: string }} item
 * @returns {{ kind: 'healthy'|'disease'|'uncertain', isHealthy: boolean, label: string, color: string, bg: string }}
 */
export function describeDiagnosis(item) {
    const status = item?.hastalik_durum;
    let kind;
    let label;

    if (status === 'saglikli' || (status === 'tespit_edildi' && item.hastalik_adi === 'Healthy')) {
        kind = 'healthy';
        label = 'Sağlıklı';
    } else if (status === 'tespit_edildi') {
        kind = 'disease';
        label = item.hastalik_adi_tr || item.hastalik_adi || 'Hastalık Tespit Edildi';
    } else if (status === 'belirsiz') {
        kind = 'uncertain';
        label = 'Teşhis Belirsiz';
    } else {
        kind = 'uncertain';
        label = 'Hastalık Analizi Yapılamadı';
    }

    return { kind, isHealthy: kind === 'healthy', label, ...STATUS_STYLES[kind] };
}
