import { describeDiagnosis } from '../utils/diagnosisStatus';
import { Colors } from '../theme/colors';

describe('describeDiagnosis', () => {
    it('recognizes healthy results', () => {
        expect(describeDiagnosis({ hastalik_durum: 'tespit_edildi', hastalik_adi: 'Healthy' }))
            .toMatchObject({ kind: 'healthy', isHealthy: true, label: 'Sağlıklı', color: Colors.light.success });
    });

    it('labels detected diseases with their Turkish name', () => {
        expect(describeDiagnosis({ hastalik_durum: 'tespit_edildi', hastalik_adi: 'Late Blight', hastalik_adi_tr: 'Geç Yanıklık' }))
            .toMatchObject({ kind: 'disease', isHealthy: false, label: 'Geç Yanıklık', color: Colors.light.danger });
    });

    it.each([
        [{ hastalik_durum: 'belirsiz' }, 'Teşhis Belirsiz'],
        [{ hastalik_durum: 'model_yok' }, 'Hastalık Analizi Yapılamadı'],
        [{ hastalik_durum: 'hata' }, 'Hastalık Analizi Yapılamadı'],
    ])('never reports a disease without a definite diagnosis (%o)', (item, label) => {
        expect(describeDiagnosis(item)).toMatchObject({ kind: 'uncertain', isHealthy: false, label, color: Colors.light.warning });
    });
});
