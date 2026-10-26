import { useState, useCallback, useMemo } from 'react';

const INITIAL_CONFIG = {
    title: '',
    message: '',
    confirmText: '',
    cancelText: '',
    isDestructive: false,
    showCancel: true,
    onConfirm: () => {},
};

/**
 * useCustomAlert — CustomAlert bileşeninin görünürlük ve içerik durumunu yönetir.
 * Her ekranın aynı state ve yardımcı fonksiyonları tekrar yazmasını önler.
 *
 * Kullanım:
 *   const { showCustomAlert, hideCustomAlert, customAlertProps } = useCustomAlert();
 *   <CustomAlert {...customAlertProps} />
 */
export function useCustomAlert() {
    const [visible, setVisible] = useState(false);
    const [config, setConfig] = useState(INITIAL_CONFIG);

    const hideCustomAlert = useCallback(() => setVisible(false), []);

    const showCustomAlert = useCallback((
        title,
        message,
        onConfirm,
        isDestructive = false,
        confirmText = 'Onayla',
        cancelText = 'Vazgeç',
        showCancel = true,
    ) => {
        setConfig({ title, message, onConfirm, isDestructive, confirmText, cancelText, showCancel });
        setVisible(true);
    }, []);

    /** Tek butonlu bilgilendirme penceresi (Tamam'a basınca kapanır) */
    const showInfoAlert = useCallback((title, message, confirmText = 'Tamam') => {
        showCustomAlert(title, message, () => setVisible(false), false, confirmText, '', false);
    }, [showCustomAlert]);

    const customAlertProps = useMemo(() => ({
        ...config,
        visible,
        onCancel: hideCustomAlert,
    }), [config, visible, hideCustomAlert]);

    return { showCustomAlert, showInfoAlert, hideCustomAlert, customAlertProps };
}
