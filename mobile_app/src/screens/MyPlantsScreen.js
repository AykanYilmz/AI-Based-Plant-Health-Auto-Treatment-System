import React, { useMemo, useState, useCallback } from 'react';
import {
    View, Text, SafeAreaView, ScrollView, TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../theme/ThemeContext';
import { api } from '../services/ApiClient';
import { useWeather } from '../hooks/useWeather';
import getDynamicStyles, { SCROLL_WIDTH, GAP } from '../styles/myPlantsStyles';
import { useAuth } from '../context/AuthContext';

// Alt bileşenler
import ActionIcon from '../components/myplants/ActionIcon';
import PlantItem from '../components/myplants/PlantItem';
import DiagnosisDetailModal from '../components/myplants/DiagnosisDetailModal';
import DonationModal from '../components/myplants/DonationModal';
import WeatherBackgroundVideo from '../components/myplants/WeatherBackgroundVideo';
import CustomAlert from '../components/CustomAlert';
import { useCustomAlert } from '../hooks/useCustomAlert';

export default function MyPlantsScreen({ navigation }) {
    const { isDark, colors, toggleTheme } = useTheme();
    const { user } = useAuth();
    const userUuid = user?.uuid;
    const styles = useMemo(() => getDynamicStyles(colors), [colors]);

    // Hava durumu (ayrı hook)
    const {
        weather, city,
        needsLocationPermission, requestLocationPermission, declineLocationPermission,
    } = useWeather();

    // Carousel
    const [activeCardIndex, setActiveCardIndex] = useState(0);

    // Teşhis geçmişi
    const [history, setHistory]               = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    // Modallar
    const [selectedItem, setSelectedItem]     = useState(null);
    const [modalVisible, setModalVisible]     = useState(false);
    const [donationVisible, setDonationVisible] = useState(false);

    // Özel onay modalı
    const { showCustomAlert, showInfoAlert, hideCustomAlert, customAlertProps } = useCustomAlert();

    useFocusEffect(
        useCallback(() => {
            let isActive = true;
            const fetchHistory = async () => {
                if (!userUuid) return;
                try {
                    const data = await api.getHistory();
                    if (data.basarili && isActive) {
                        setHistory(data.gecmis || []);
                    }
                } catch (_err) {
                    console.log('MyPlantsScreen geçmiş yükleme hatası:', _err);
                } finally {
                    if (isActive) setLoadingHistory(false);
                }
            };
            fetchHistory();
            return () => { isActive = false; };
        }, [userUuid])
    );

    // Kayıt silme
    const handleDelete = (id) => {
        showCustomAlert(
            'Kaydı Sil',
            'Bu teşhis kaydını ve ilişkili fotoğrafı kalıcı olarak silmek istediğinizden emin misiniz?',
            async () => {
                hideCustomAlert();
                try {
                    const data = await api.deleteDiagnosis(id);
                    if (data.basarili) {
                        setModalVisible(false);
                        setSelectedItem(null);
                        setHistory(prev => prev.filter(item => item.id !== id));
                        // Başarılı uyarısı için CustomAlert'i tek butonlu olarak göster
                        setTimeout(() => {
                            showInfoAlert("Başarılı", "Teşhis kaydı başarıyla silindi.");
                        }, 500);
                    } else {
                        setTimeout(() => {
                            showInfoAlert("Hata", "Kayıt silinemedi: " + data.hata);
                        }, 500);
                    }
                } catch (_err) {
                    setTimeout(() => {
                        showInfoAlert("Hata", "Sunucu bağlantı hatası oluştu.");
                    }, 500);
                }
            },
            true,
            'Evet, Sil',
            'Vazgeç',
            true
        );
    };

    // Aksiyon handler'ları
    const handleSmartIrrigation = () => {
        showInfoAlert('Akıllı Sulama & Tedavi', 'Otonom tedavi cihazınızla bağlantı kuruluyor...\nSulama ve organik tedavi döngüsü başarıyla başlatıldı! 💦🌿', 'Harika!');
    };

    const handlePlantGuide = () => {
        showCustomAlert(
            'Bitki Bakım Rehberi',
            'Desteklenen bitkilerin (Domates, Patates, Mısır, Kiraz, Elma, Üzüm) bakım tüyoları ve hastalık mücadele yöntemleri yükleniyor...',
            () => {
                hideCustomAlert();
                navigation.navigate('Logs');
            },
            false,
            'Geçmiş Teşhislere Git',
            'Kapat',
            true
        );
    };

    const handleAIBotanist = () => {
        showInfoAlert('AI Botanist Chatbot', 'Yapay zeka tarım danışmanınız hazır! Sormak istediğiniz soruları buraya iletebilirsiniz.', 'Sohbete Başla');
    };

    const handleScroll = (event) => {
        const scrollPosition = event.nativeEvent.contentOffset.x;
        setActiveCardIndex(Math.round(scrollPosition / SCROLL_WIDTH));
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* ── HEADER ──────────────────────────────── */}
                <View style={[styles.paddedSection, styles.header]}>
                    <View style={styles.headerLogoContainer}>
                        <MaterialCommunityIcons name="leaf" size={26} color="#2ECC71" style={{ marginRight: 6 }} />
                        <Text style={styles.headerTitleMain}>
                            Verdant<Text style={styles.headerTitleAI}>AI</Text>
                        </Text>
                    </View>
                    <View style={styles.headerIconsRow}>
                        <TouchableOpacity style={styles.themeToggleContainer} onPress={toggleTheme}>
                            <MaterialCommunityIcons
                                name={isDark ? 'weather-night' : 'weather-sunny'}
                                size={28}
                                color={colors.textMain}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.bellIconContainer}>
                            <MaterialCommunityIcons name="bell-ring-outline" size={26} color={colors.textMain} />
                            <View style={styles.notificationDot} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── HAVA DURUMU KAROUSELİ ───────────────── */}
                <View style={styles.carouselContainer}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        pagingEnabled={true}
                        decelerationRate="fast"
                        style={{ width: SCROLL_WIDTH, alignSelf: 'center' }}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                    >
                        {/* KART 1: Hava Durumu */}
                        <View style={[styles.card, { marginHorizontal: GAP / 2 }]}>
                            {weather && (
                                <>
                                    <WeatherBackgroundVideo
                                        key={weather.videoUrl}
                                        source={weather.videoUrl}
                                        style={styles.weatherBgVideo}
                                    />
                                    <View style={styles.weatherOverlay} />
                                </>
                            )}
                            <View style={[styles.cardHeader, { zIndex: 2 }]}>
                                <Text style={[styles.cardHeaderTitle, weather && styles.weatherTextWhite]}>
                                    CANLI HAVA DURUMU
                                </Text>
                                <MaterialCommunityIcons name="map-marker-outline" size={22} color={weather ? '#FFF' : colors.accent} />
                            </View>
                            <Text style={[styles.cardMainText, weather && styles.weatherTextWhite, { zIndex: 2 }]} numberOfLines={1} adjustsFontSizeToFit>
                                {city}
                            </Text>
                            <View style={[styles.cardFooter, { zIndex: 2 }]}>
                                {weather ? (
                                    <View style={styles.weatherDataContainer}>
                                        <View style={styles.weatherDataRow}>
                                            <MaterialCommunityIcons name={weather.icon} size={42} color="#FFF" style={{ marginRight: 10 }} />
                                            <Text style={[styles.weatherTempText, styles.weatherTextWhite]}>{weather.temp}°C</Text>
                                        </View>
                                        <Text style={styles.weatherDescText}>{weather.description}</Text>
                                    </View>
                                ) : (
                                    <View style={styles.weatherDataRow}>
                                        <MaterialCommunityIcons name="cloud-search-outline" size={28} color={colors.textMuted} style={{ marginRight: 8 }} />
                                        <Text style={styles.weatherLoadingText}>Yükleniyor...</Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* KART 2 */}
                        <View style={[styles.card, { marginHorizontal: GAP / 2 }]}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardHeaderTitle}>KART 2</Text>
                            </View>
                            <Text style={styles.cardMainText}>Yakında Eklenecek</Text>
                            <View style={styles.cardFooter}>
                                <Text style={styles.cardFooterMuted}>Ayrılmış Alan</Text>
                            </View>
                        </View>

                        {/* KART 3 */}
                        <View style={[styles.card, { marginHorizontal: GAP / 2 }]}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardHeaderTitle}>KART 3</Text>
                            </View>
                            <Text style={styles.cardMainText}>Yakında Eklenecek</Text>
                            <View style={styles.cardFooter}>
                                <Text style={styles.cardFooterMuted}>Ayrılmış Alan</Text>
                            </View>
                        </View>
                    </ScrollView>
                </View>

                {/* ── PAGINATION DOTS ─────────────────────── */}
                <View style={styles.dotsContainer}>
                    {[0, 1, 2].map((i) => (
                        <View key={i} style={activeCardIndex === i ? styles.dotActive : styles.dotInactive} />
                    ))}
                </View>

                {/* ── AKSİYON BUTONLARI & BİTKİ LİSTESİ ─── */}
                <View style={styles.paddedSection}>
                    <View style={styles.actionsRow}>
                        <ActionIcon icon="tree"                    color="#2ECC71" bg="rgba(46, 204, 113, 0.1)"  label={"Fidan\nBağışı"}    styles={styles} onPress={() => setDonationVisible(true)} />
                        <ActionIcon icon="water-pump"              color="#3498DB" bg="rgba(52, 152, 219, 0.1)"  label={"Akıllı\nSulama"}   styles={styles} onPress={handleSmartIrrigation} />
                        <ActionIcon icon="book-open-page-variant"  color="#F39C12" bg="rgba(243, 156, 18, 0.1)"  label={"Bitki\nRehberi"}   styles={styles} onPress={handlePlantGuide} />
                        <ActionIcon icon="robot-concept"           color="#9B59B6" bg="rgba(155, 89, 182, 0.1)"  label={"AI\nBotanist"}     styles={styles} onPress={handleAIBotanist} />
                    </View>

                    {/* Liste başlığı */}
                    <View style={styles.logHeaderContainer}>
                        <Text style={styles.logHeaderTitle}>Kayıtlı Bitkilerim</Text>
                        {history.length > 0 && (
                            <TouchableOpacity onPress={() => navigation.navigate('Logs')}>
                                <Text style={styles.seeAllText}>Tümünü Gör</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Bitki Listesi */}
                    <View style={styles.logList}>
                        {loadingHistory ? (
                            <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 20 }} />
                        ) : history.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <MaterialCommunityIcons name="flower-tulip-outline" size={32} color={colors.accent} style={{ marginBottom: 8 }} />
                                <Text style={styles.emptyText}>Henüz Kayıtlı Teşhis Yok</Text>
                                <Text style={styles.emptySubText}>Yeni bir yaprak taratarak analize başlayabilirsiniz.</Text>
                            </View>
                        ) : (
                            history.slice(0, 5).map((item) => {
                                const isHealthy = item.hastalik_durum === 'saglikli' || (item.hastalik_durum === 'tespit_edildi' && item.hastalik_adi === 'Healthy');
                                return (
                                    <PlantItem
                                        key={item.id}
                                        name={item.bitki_adi_tr || item.bitki_adi}
                                        status={isHealthy ? 'Sağlıklı (Bakım gerekmiyor)' : (item.hastalik_adi_tr || 'Teşhis Edildi')}
                                        imageSource={api.imageSource(item.resim_yolu)}
                                        needs={isHealthy ? [] : ['fertilizer']}
                                        styles={styles}
                                        colors={colors}
                                        onPress={() => {
                                            setSelectedItem(item);
                                            setModalVisible(true);
                                        }}
                                    />
                                );
                            })
                        )}
                    </View>
                </View>

            </ScrollView>

            {/* ── MODALLAR ────────────────────────────── */}
            <DiagnosisDetailModal
                visible={modalVisible}
                selectedItem={selectedItem}
                onClose={() => { setModalVisible(false); setSelectedItem(null); }}
                onDelete={handleDelete}
                styles={styles}
                colors={colors}
            />

            <DonationModal
                visible={donationVisible}
                onClose={() => setDonationVisible(false)}
                styles={styles}
                colors={colors}
            />

            {/* ÖZEL ONAY MODALI */}
            <CustomAlert {...customAlertProps} />

            {/* KONUM İZNİ AÇIKLAMA MODALI (Sistem penceresinden önce gösterilir) */}
            <CustomAlert
                visible={needsLocationPermission}
                title="Konum İzni"
                message="Bulunduğunuz bölgenin canlı hava durumunu gösterebilmemiz için yaklaşık konumunuza erişmemiz gerekiyor. Konumunuz hiçbir yerde saklanmaz."
                confirmText="İzin Ver"
                cancelText="Şimdi Değil"
                onConfirm={requestLocationPermission}
                onCancel={declineLocationPermission}
            />
        </SafeAreaView>
    );
}
