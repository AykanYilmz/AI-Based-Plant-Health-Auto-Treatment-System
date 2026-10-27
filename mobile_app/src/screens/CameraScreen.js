import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, StatusBar, Dimensions, Linking, ActivityIndicator, AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { api } from '../services/ApiClient';
import CustomAlert from '../components/CustomAlert';
import { useCustomAlert } from '../hooks/useCustomAlert';

const { width: screenWidth } = Dimensions.get('window');


export default function CameraScreen({ navigation }) {
    const { colors } = useTheme();

    const styles = useMemo(() => getDynamicStyles(colors), [colors]);

    const [permission, requestPermission, getPermission] = useCameraPermissions();
    const [facing, setFacing] = useState('back');
    const [flash, setFlash] = useState('off');
    const [hasAsked, setHasAsked] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analyzeStep, setAnalyzeStep] = useState(''); // Hangi katmanda olduğunu gösterir
    const insets = useSafeAreaInsets();

    // Özel onay modalı
    const { showInfoAlert, customAlertProps } = useCustomAlert();

    const cameraRef = useRef(null);
    const isMountedRef = useRef(true);
    const abortControllerRef = useRef(null);

    // Bileşen mount ve unmount takibi + AbortController temizliği
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    // İzin isteme fonksiyonu - tek seferlik deneyin ardından doğrudan uygulama ayarlarını aç
    const handlePermissionRequest = useCallback(async () => {
        if (hasAsked || (permission && !permission.canAskAgain)) {
            Linking.openSettings();
        } else {
            setHasAsked(true);
            await requestPermission();
        }
    }, [hasAsked, permission, requestPermission]);

    // Kullanıcı ayarlardan izin verip geri döndüğünde izin durumunu tazele
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') getPermission();
        });
        return () => subscription.remove();
    }, [getPermission]);

    const toggleCameraFacing = useCallback(() => {
        setFacing(current => (current === 'back' ? 'front' : 'back'));
    }, []);

    const toggleFlash = useCallback(() => {
        setFlash(current => (current === 'off' ? 'on' : 'off'));
    }, []);

    // Fotoğrafı backend'e gönder ve 3 katmanlı AI pipeline sonucu al
    const analyzePhoto = useCallback(async (uri, isFromGallery = false) => {
        // Varsa önceki yarım kalmış isteği iptal et
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        const { signal } = abortControllerRef.current;

        try {
            if (isMountedRef.current) {
                setIsAnalyzing(true);
                setAnalyzeStep('Görüntü hazırlanıyor...');
            }

            // [SAMSUNG FIX v2]: Android (özellikle Samsung) kameralar, vizörde gösterilen alandan
            // çok daha geniş bir açıyla fotoğraf çeker. Bu nedenle yaprak fotoğrafta küçük kalır
            // ve YOLO algılayamaz. Çözüm:
            //   1. Önce resize yapıyoruz — bu adımda expo-image-manipulator EXIF rotation'ı
            //      otomatik uygular, böylece boyutlar güvenilir hale gelir.
            //   2. Sadece Android'de, resize edilmiş görüntünün merkezinden %65'lik bir alan
            //      kırpılır. Bu, vizör çerçevesiyle eşleşen yakınlaştırılmış bir görüntü üretir.
            //   3. iOS'a dokunulmaz — iOS zaten vizörle aynı kadrajı kaydeder.
            let processed;

            if (Platform.OS === 'android' && !isFromGallery) {
                // ADIM 1: Resize — EXIF rotation otomatik uygulanır, boyutlar normalize olur
                const resized = await ImageManipulator.manipulateAsync(
                    uri,
                    [{ resize: { width: 1280 } }],
                    { format: ImageManipulator.SaveFormat.JPEG, compress: 0.9 }
                );

                // ADIM 2: Merkezden %50 kırpma (Android geniş açı telafisi — iOS kadrajına eşitleme)
                const CROP_RATIO = 0.40;
                const resizedW = resized.width;
                const resizedH = resized.height;
                const cropW = Math.round(resizedW * CROP_RATIO);
                const cropH = Math.round(resizedH * CROP_RATIO);
                const originX = Math.round((resizedW - cropW) / 2);
                // Dikey eksende kırpmayı biraz yukarı kaydır (%35 üst / %65 alt)
                // Samsung'da vizör üst bölgede, alt kısımda UI elemanları kalıyor
                const originY = Math.round((resizedH - cropH) * 0.35);

                processed = await ImageManipulator.manipulateAsync(
                    resized.uri,
                    [
                        {
                            crop: {
                                originX,
                                originY,
                                width: cropW,
                                height: cropH,
                            }
                        }
                    ],
                    { format: ImageManipulator.SaveFormat.JPEG, compress: 0.85 }
                );
            } else {
                // iOS veya Galeriden Seçilen Görsel: Sadece resize — kadraj zaten doğru
                processed = await ImageManipulator.manipulateAsync(
                    uri,
                    [{ resize: { width: 1024 } }],
                    { format: ImageManipulator.SaveFormat.JPEG, compress: 0.85 }
                );
            }


            if (isMountedRef.current) {
                setAnalyzeStep('Yaprak aranıyor...');
            }

            const formData = new FormData();

            if (Platform.OS === 'web') {
                const res = await fetch(processed.uri, { signal });
                const blob = await res.blob();
                formData.append('image', blob, 'plant_photo.jpg');
            } else {
                formData.append('image', {
                    uri: processed.uri,
                    type: 'image/jpeg',
                    name: 'plant_photo.jpg'
                });
            }

            const result = await api.diagnose(formData, signal);

            if (isMountedRef.current) {
                if (result.basarili) {
                    navigation.navigate('DiagnosisResult', {
                        result: result,
                        photoUri: uri
                    });
                } else {
                    if (result.dusuk_confidence) {
                        showInfoAlert("Emin Değilim", "Bitki türü yeterince güvenilir tespit edilemedi. Lütfen yaprağı daha yakından ve net bir şekilde çekin.", "Tekrar Dene");
                    } else {
                        showInfoAlert("Hata", result.hata || "Analiz yapılamadı.");
                    }
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log("Analiz işlemi kullanıcı tarafından iptal edildi.");
                return;
            }
            console.log("API Hatası:", error);
            if (isMountedRef.current) {
                showInfoAlert("Bağlantı Hatası", "Sunucuya bağlanılamadı. Lütfen backend sunucusunun çalıştığından emin olun.");
            }
        } finally {
            if (isMountedRef.current) {
                setIsAnalyzing(false);
                setAnalyzeStep('');
            }
        }
    }, [navigation, showInfoAlert]);

    // Galeriden fotoğraf seçimi
    const pickImage = useCallback(async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true, // Kullanıcı yaprağı kare içine alabilsin
            aspect: [1, 1],      // 1:1 kare kırpma oranı
            quality: 0.9,
        });

        if (!result.canceled) {
            await analyzePhoto(result.assets[0].uri, true);
        }
    }, [analyzePhoto]);

    // Kamera ile fotoğraf çekimi
    const takePicture = useCallback(async () => {
        if (cameraRef.current) {
            try {
                const photo = await cameraRef.current.takePictureAsync({
                    quality: 0.9,
                    base64: false
                });

                await analyzePhoto(photo.uri, false);
            } catch (error) {
                console.log("Fotoğraf çekilirken hata:", error);
            }
        }
    }, [analyzePhoto]);

    // [PERFORMANCE FIX]: Kamera vizörü memoize edildi. 
    // Böylece 'isAnalyzing' ve 'analyzeStep' güncellemelerinde native kamera katmanı gereksiz yere tekrar render edilmez, donma ve pil tüketimi önlenir.
    const memoizedCamera = useMemo(() => {
        return (
            <CameraView
                style={StyleSheet.absoluteFillObject}
                facing={facing}
                flash={flash}
                ref={cameraRef}
            />
        );
    }, [facing, flash]);

    // Analiz Loading Overlay (kamera ve izin ekranı ortak kullanır; galeriden seçim izin gerektirmez)
    const analyzingOverlay = isAnalyzing && (
        <View style={styles.analyzingOverlay}>
            <View style={styles.analyzingBox}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={styles.analyzingText}>Yapay Zeka Analizi Çalışıyor</Text>
                <Text style={styles.analyzingSubText}>{analyzeStep || 'Analiz gerçekleştiriliyor...'}</Text>

                {/* Yapay Zeka Adımları Göstergesi */}
                <View style={styles.pipelineSteps}>
                    <View style={styles.stepItem}>
                        <MaterialCommunityIcons name="image-search-outline" size={18} color={colors.accent} />
                        <Text style={styles.stepText}>Yaprak Algılama</Text>
                    </View>
                    <View style={styles.stepItem}>
                        <MaterialCommunityIcons name="leaf" size={18} color={colors.accent} />
                        <Text style={styles.stepText}>Bitki Türü Teşhisi</Text>
                    </View>
                    <View style={styles.stepItem}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.accent} />
                        <Text style={styles.stepText}>Hastalık Analizi</Text>
                    </View>
                </View>
            </View>
        </View>
    );

    // ÖZEL ONAY MODALI (galeri analizi hataları izin ekranında da gösterilebilsin)
    const customAlert = (
        <CustomAlert {...customAlertProps} />
    );

    // İzin henüz yüklenmedi
    if (!permission) {
        return <View style={styles.safeArea} />
    }

    // İzin verilmedi - Uygulama temasında izin isteme ekranı
    if (!permission.granted) {
        const showSettingsMode = hasAsked || !permission.canAskAgain;
        const benefits = [
            { icon: 'image-search-outline', bg: colors.iconAnalyzeBg, color: colors.iconAnalyzeColor, title: 'Yaprağı otomatik bulur', text: 'Vizöre aldığınız bitkideki yaprak kendiliğinden tespit edilir.' },
            { icon: 'leaf', bg: colors.iconWaterBg, color: colors.iconWaterColor, title: 'Türü ve hastalığı tanır', text: '3 katmanlı yapay zeka ile saniyeler içinde teşhis.' },
            { icon: 'shield-check-outline', bg: colors.iconPauseBg, color: colors.iconPauseColor, title: 'Gizliliğiniz korunur', text: 'Kamera yalnızca bu ekranda, tarama için kullanılır.' },
        ];

        return (
            <View style={[styles.permScreen, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
                {/* Geri dön butonu */}
                <TouchableOpacity style={styles.permBackButton} onPress={() => navigation.goBack()}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textMain} />
                </TouchableOpacity>

                <ScrollView contentContainerStyle={styles.permContent} showsVerticalScrollIndicator={false}>
                    <View style={[styles.permIconRing, { backgroundColor: colors.iconAnalyzeBg }]}>
                        <View style={[styles.permIconBox, { backgroundColor: colors.accent }]}>
                            <MaterialCommunityIcons
                                name={showSettingsMode ? 'camera-off-outline' : 'camera-outline'}
                                size={40}
                                color="#FFFFFF"
                            />
                        </View>
                    </View>

                    <Text style={styles.permTitle}>
                        {showSettingsMode ? 'Kamera İzni Kapalı' : 'Kamera İzni Gerekli'}
                    </Text>
                    <Text style={styles.permText}>
                        {showSettingsMode
                            ? 'Kamera erişimi reddedilmiş. Bitkilerinizi tarayabilmek için ayarlardan VerdantAI\'ın kamera iznini açın, sonra bu ekrana geri dönün.'
                            : 'Bitkinizi tanıyıp hastalıklarını teşhis edebilmemiz için kameranıza erişmemiz gerekiyor.'
                        }
                    </Text>

                    <View style={styles.permCard}>
                        {benefits.map((item, index) => (
                            <View key={item.icon} style={[styles.permRow, index > 0 && styles.permRowDivider]}>
                                <View style={[styles.permRowIcon, { backgroundColor: item.bg }]}>
                                    <MaterialCommunityIcons name={item.icon} size={22} color={item.color} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.permRowTitle}>{item.title}</Text>
                                    <Text style={styles.permRowText}>{item.text}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </ScrollView>

                {/* Aksiyonlar */}
                <TouchableOpacity style={styles.permPrimaryButton} onPress={handlePermissionRequest} activeOpacity={0.85}>
                    <MaterialCommunityIcons
                        name={showSettingsMode ? 'cog-outline' : 'camera'}
                        size={20}
                        color="#FFFFFF"
                        style={{ marginRight: 8 }}
                    />
                    <Text style={styles.permPrimaryText}>
                        {showSettingsMode ? 'Ayarlara Git' : 'Kameraya İzin Ver'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.permSecondaryButton} onPress={pickImage} activeOpacity={0.7}>
                    <MaterialCommunityIcons name="image-outline" size={20} color={colors.textMain} style={{ marginRight: 8 }} />
                    <Text style={styles.permSecondaryText}>Galeriden Fotoğraf Seç</Text>
                </TouchableOpacity>

                {analyzingOverlay}
                {customAlert}
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Memoize edilmiş Kamera Katmanı */}
            {memoizedCamera}

            <View style={[styles.cameraSafeArea, { paddingTop: insets.top > 0 ? insets.top : (Platform.OS === 'android' ? StatusBar.currentHeight : 0) }]}>
                {/* Üst İşlem Kontrolleri */}
                <View style={styles.topControls}>
                    <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
                        <MaterialCommunityIcons name="close" size={26} color="#FFFFFF" />
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row' }}>
                        <TouchableOpacity style={[styles.iconButton, { marginRight: 12 }]} onPress={toggleFlash}>
                            <MaterialCommunityIcons name={flash === 'on' ? 'flash' : 'flash-off'} size={24} color="#FFFFFF" />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.iconButton} onPress={toggleCameraFacing}>
                            <MaterialCommunityIcons name="camera-flip-outline" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Merkez Hedef Çerçevesi */}
                <View style={styles.focusFrameContainer} pointerEvents="none">
                    <View style={styles.focusFrameBorder} />
                </View>

                {/* Alt HUD Katmanı */}
                <View style={styles.bottomHudWrapper}>

                    {/* Yönerge */}
                    <View style={styles.instructionArea}>
                        <Text style={styles.instructionText}>
                            Bitkiyi vizör içine alın — yaprak otomatik bulunacak
                        </Text>
                    </View>

                    {/* Alt Menü */}
                    <View style={[styles.drawerContainer, {
                        backgroundColor: colors.card,
                        paddingBottom: Math.max(insets.bottom + 10, 30)
                    }]}>
                        {/* Pipeline Bilgi Bandı */}
                        <View style={styles.pipelineInfo}>
                            <View style={styles.pipelineStep}>
                                <MaterialCommunityIcons name="image-search-outline" size={16} color={colors.accent} />
                                <Text style={[styles.pipelineStepText, { color: colors.textMuted }]}>Yaprak Bul</Text>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textMuted} />
                            <View style={styles.pipelineStep}>
                                <MaterialCommunityIcons name="leaf" size={16} color={colors.accent} />
                                <Text style={[styles.pipelineStepText, { color: colors.textMuted }]}>Türü Tanı</Text>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textMuted} />
                            <View style={styles.pipelineStep}>
                                <MaterialCommunityIcons name="medical-bag" size={16} color={colors.accent} />
                                <Text style={[styles.pipelineStepText, { color: colors.textMuted }]}>Hastalığı Bul</Text>
                            </View>
                        </View>

                        {/* Alt Action Row: Galeri, Deklanşör, İpuçları */}
                        <View style={styles.actionRow}>
                            {/* Galeri Tuşu */}
                            <TouchableOpacity style={styles.actionSideItem} onPress={pickImage}>
                                <View style={styles.actionSubCircle}>
                                    <MaterialCommunityIcons name="image-outline" size={24} color={colors.textMain} />
                                </View>
                                <Text style={[styles.actionSubText, { color: colors.textMuted }]}>Galeri</Text>
                            </TouchableOpacity>

                            {/* Beyaz Dev Deklanşör */}
                            <TouchableOpacity
                                style={[styles.shutterOuter, { borderColor: colors.controlBorder }]}
                                onPress={takePicture}
                            >
                                <View style={[styles.shutterInner, { backgroundColor: '#FFFFFF' }]} />
                            </TouchableOpacity>

                            {/* İpuçları Tuşu */}
                            <TouchableOpacity style={styles.actionSideItem} onPress={() => {
                                showInfoAlert("İpucu", "Yaprak fotoğrafını çekerken:\n\n• Bitkiye çok yaklaşmayın\n• Işığın arkadan gelmemesine dikkat edin\n• Yaprağın tam görünmesini sağlayın\n\nYapay zeka yaprağı otomatik bulup analiz edecektir.", "Anladım");
                            }}>
                                <View style={styles.actionSubCircle}>
                                    <MaterialCommunityIcons name="help" size={24} color={colors.textMain} />
                                </View>
                                <Text style={[styles.actionSubText, { color: colors.textMuted }]}>İpuçları</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                </View>
            </View>

            {analyzingOverlay}
            {customAlert}
        </View>
    );
}

const getDynamicStyles = (colors) => StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    cameraSafeArea: {
        flex: 1,
        justifyContent: 'space-between',
    },

    // Üst Kontroller
    topControls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 16,
        zIndex: 10,
    },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Merkezi Odak Çerçevesi
    focusFrameContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
    },
    focusFrameBorder: {
        width: screenWidth - 100,
        height: screenWidth - 60,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.7)',
        borderRadius: 24,
    },

    // Alt UI
    bottomHudWrapper: {
        width: '100%',
        justifyContent: 'flex-end',
    },
    instructionArea: {
        paddingHorizontal: 30,
        paddingBottom: 8,
    },
    instructionText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 6,
        marginBottom: 12,
    },

    // Alt Drawer
    drawerContainer: {
        width: '100%',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        paddingTop: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },

    // Pipeline Info Band
    pipelineInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        marginBottom: 20,
        gap: 6,
    },
    pipelineStep: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    pipelineStepText: {
        fontSize: 12,
        fontWeight: '600',
    },

    // Fotoğraf / Deklanşör
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    actionSideItem: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 80,
    },
    actionSubCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(120, 120, 128, 0.16)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
    },
    actionSubText: {
        fontSize: 12,
        fontWeight: '500',
    },
    shutterOuter: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 3,
        justifyContent: 'center',
        alignItems: 'center',
    },
    shutterInner: {
        width: 66,
        height: 66,
        borderRadius: 33,
    },

    // İzin Sayfası Stilleri
    // İzin Ekranı
    permScreen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
    permBackButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.card,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    permContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 16 },
    permIconRing: { width: 116, height: 116, borderRadius: 58, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
    permIconBox: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    permTitle: { fontSize: 24, fontWeight: 'bold', color: colors.textMain, marginBottom: 10, textAlign: 'center', letterSpacing: -0.5 },
    permText: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 28, paddingHorizontal: 8 },
    permCard: {
        width: '100%',
        backgroundColor: colors.card,
        borderRadius: 24,
        paddingHorizontal: 16,
        shadowColor: colors.shadowColor,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 15,
        elevation: 5,
    },
    permRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
    permRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.navInactive },
    permRowIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    permRowTitle: { fontSize: 15, fontWeight: 'bold', color: colors.textMain },
    permRowText: { fontSize: 13, fontWeight: '500', color: colors.textMuted, marginTop: 2, lineHeight: 18 },
    permPrimaryButton: {
        flexDirection: 'row',
        height: 56,
        borderRadius: 18,
        backgroundColor: colors.accent,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    permPrimaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    permSecondaryButton: {
        flexDirection: 'row',
        height: 52,
        borderRadius: 18,
        marginTop: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: colors.navInactive,
    },
    permSecondaryText: { color: colors.textMain, fontSize: 15, fontWeight: '600' },

    // Analiz Overlay
    analyzingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.80)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    analyzingBox: {
        backgroundColor: colors.card,
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        width: 280,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 20,
    },
    analyzingText: {
        color: colors.textMain || '#FFF',
        fontSize: 17,
        fontWeight: 'bold',
        marginTop: 16,
    },
    analyzingSubText: {
        color: colors.textMuted,
        fontSize: 13,
        marginTop: 4,
        textAlign: 'center',
    },
    pipelineSteps: {
        marginTop: 20,
        width: '100%',
        gap: 10,
    },
    stepItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    stepText: {
        color: colors.textMuted,
        fontSize: 13,
        fontWeight: '500',
    },

});
