// Her iki temada aynı kalan durum ve marka renkleri
const SHARED = {
    // Durum renkleri (teşhis sonucu, rozetler, güven çubukları)
    success: '#34C759',
    successSoft: '#34C75920',
    danger: '#FF3B30',
    dangerSoft: '#FF3B3020',
    warning: '#FF9500',
    warningSoft: '#FF950020',
    info: '#007AFF',
    infoSoft: '#007AFF20',

    brand: '#2ECC71',    // "VerdantAI" logosu ve marka vurguları
    alert: '#E74C3C',    // Form hata mesajları, çıkış/sil butonları
    onAccent: '#FFFFFF', // Vurgu renkli zemin üstündeki yazı/ikon
};

export const Colors = {
    light: {
        ...SHARED,
        background: '#F5F5F7',
        card: '#FFFFFF',
        textMain: '#1A1A1D',
        textMuted: '#8E8E93',
        accent: '#648754',      // Botanical Olive
        navInactive: '#CFCFCF',
        shadowColor: '#000000',
        cardShadowOpacity: 0.05,
        statusBar: 'dark',

        // Yüzey ve çizgi tonları
        surfaceMuted: '#F0F0F0', // Güven çubuğu izi, ikincil kutular
        border: '#E5E5EA',
        divider: '#F0F0F0',
        controlBorder: '#E5E5EA', // Kamera deklanşörü çerçevesi
        warningBanner: '#FFF3E0',

        // Pastel / Earth tones for icons
        iconWaterBg: '#EEDCCB',
        iconWaterColor: '#B77353',
        iconAnalyzeBg: '#E1EAD8',
        iconAnalyzeColor: '#557245',
        iconNewBg: '#EFCFC3',
        iconNewColor: '#C28669',
        iconPauseBg: '#DCE9E9',
        iconPauseColor: '#4A757E',
    },
    dark: {
        ...SHARED,
        background: '#121212', // Pure dark / Deep gray
        card: '#1C1C1E',      // Apple Dark Mode surface
        textMain: '#FFFFFF',
        textMuted: '#A1A1AA', // Lighter gray for visibility
        accent: '#85B072',      // Brighter Olive to pop on dark mode
        navInactive: '#4B4B4D',
        shadowColor: '#000000',
        cardShadowOpacity: 0.3, // Karanlıkta daha belirgin gölge
        statusBar: 'light',

        // Yüzey ve çizgi tonları
        surfaceMuted: '#2C2C2E',
        border: '#333333',
        divider: '#333333',
        controlBorder: '#A1A1AA',
        warningBanner: '#3A2A0020',

        // Deepened dark mode equivalents for pastel colors
        iconWaterBg: '#3A2E28',
        iconWaterColor: '#E6B098',
        iconAnalyzeBg: '#2E382A',
        iconAnalyzeColor: '#A5C98F',
        iconNewBg: '#3D2D27',
        iconNewColor: '#F0A181',
        iconPauseBg: '#243436',
        iconPauseColor: '#8EBDC4',
    }
};
