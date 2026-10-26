import React, { useMemo, useState, useCallback } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    SafeAreaView, 
    Platform, 
    StatusBar, 
    FlatList, 
    Image, 
    TouchableOpacity, 
    ActivityIndicator
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

import { api } from '../services/ApiClient';
import { describeDiagnosis } from '../utils/diagnosisStatus';
import DiagnosisDetailModal from '../components/myplants/DiagnosisDetailModal';
import CustomAlert from '../components/CustomAlert';
import { useCustomAlert } from '../hooks/useCustomAlert';

export default function SearchScreen() {
    const { isDark, colors } = useTheme();
    const { user } = useAuth();
    const userUuid = user?.uuid;

    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);

    // Özel onay modalı
    const { showCustomAlert, showInfoAlert, hideCustomAlert, customAlertProps } = useCustomAlert();

    // Dinamik stiller
    const styles = useMemo(() => getDynamicStyles(colors), [colors]);

    // Geçmiş verilerini çek
    const fetchHistory = useCallback(async (showLoadingIndicator = true) => {
        if (!userUuid) return;
        if (showLoadingIndicator) setLoading(true);
        try {
            const data = await api.getHistory();
            if (data.basarili) {
                setHistory(data.gecmis || []);
            } else {
                console.warn('Geçmiş yüklenemedi:', data.hata);
            }
        } catch (error) {
            console.log('Geçmiş API hatası:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userUuid]);

    // Her sayfa odaklandığında (Logs sekmesine tıklandığında) verileri yenile (Gelişmiş UX)
    useFocusEffect(
        useCallback(() => {
            fetchHistory(true);
        }, [fetchHistory])
    );

    // Pull-to-refresh tetikleyicisi
    const handleRefresh = () => {
        setRefreshing(true);
        fetchHistory(false);
    };

    // Tüm geçmişi temizleme
    const handleDeleteAll = () => {
        if (history.length === 0) return;
        showCustomAlert(
            "Geçmişi Temizle",
            "Tüm teşhis geçmişinizi ve kayıtlı fotoğraflarınızı kalıcı olarak silmek istediğinizden emin misiniz?",
            async () => {
                hideCustomAlert();
                try {
                    const data = await api.deleteAllHistory();
                    if (data.basarili) {
                        setHistory([]);
                        // Başarılı uyarısı için CustomAlert'i tek butonlu olarak göster
                        setTimeout(() => {
                            showInfoAlert("Başarılı", "Tüm teşhis geçmişiniz başarıyla temizlendi.");
                        }, 500);
                    } else {
                        setTimeout(() => {
                            showInfoAlert("Hata", "Geçmiş temizlenemedi: " + data.hata);
                        }, 500);
                    }
                } catch (_error) {
                    setTimeout(() => {
                        showInfoAlert("Hata", "Sunucu bağlantı hatası oluştu.");
                    }, 500);
                }
            },
            true,
            "Evet, Tümünü Sil",
            "Vazgeç",
            true
        );
    };

    // Kayıt silme işlemi
    const handleDelete = (id) => {
        showCustomAlert(
            "Kaydı Sil",
            "Bu teşhis kaydını ve ilişkili fotoğrafı kalıcı olarak silmek istediğinizden emin misiniz?",
            async () => {
                hideCustomAlert();
                try {
                    const data = await api.deleteDiagnosis(id);
                    if (data.basarili) {
                        setModalVisible(false);
                        setSelectedItem(null);
                        setHistory(prev => prev.filter(item => item.id !== id));
                        setTimeout(() => {
                            showInfoAlert("Başarılı", "Teşhis kaydı başarıyla silindi.");
                        }, 500);
                    } else {
                        setTimeout(() => {
                            showInfoAlert("Hata", "Kayıt silinemedi: " + data.hata);
                        }, 500);
                    }
                } catch (_error) {
                    setTimeout(() => {
                        showInfoAlert("Hata", "Sunucu bağlantı hatası oluştu.");
                    }, 500);
                }
            },
            true,
            "Evet, Sil",
            "Vazgeç",
            true
        );
    };

    // Tarih formatlama
    const formatDate = (isoString) => {
        if (!isoString) return '—';
        const date = new Date(isoString);
        return date.toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Her bir geçmiş kartı render fonksiyonu
    const renderHistoryItem = ({ item }) => {
        const { color: statusColor, bg: statusBg, label: statusText } = describeDiagnosis(item);

        const imageSource = api.imageSource(item.resim_yolu);

        return (
            <TouchableOpacity 
                style={styles.card} 
                onPress={() => {
                    setSelectedItem(item);
                    setModalVisible(true);
                }}
                activeOpacity={0.8}
            >
                {/* Sol Yaprak Fotoğrafı */}
                <Image source={imageSource} style={styles.cardImage} />

                {/* Orta Metin Alanı */}
                <View style={styles.cardInfo}>
                    <Text style={styles.cardPlantName}>{item.bitki_adi_tr || item.bitki_adi}</Text>
                    
                    <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                    </View>
                    
                    <Text style={styles.cardDate}>{formatDate(item.tarih)}</Text>
                </View>

                {/* Sağ Oranlar & Silme Butonu */}
                <View style={styles.cardRight}>
                    <Text style={styles.accuracyText}>
                        %{parseFloat(item.hastalik_guven || item.bitki_guven || 0).toFixed(1)}
                    </Text>
                    <TouchableOpacity 
                        style={styles.deleteButton} 
                        onPress={() => handleDelete(item.id)}
                    >
                        <MaterialCommunityIcons name="trash-can-outline" size={24} color="#FF3B30" />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
            
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerContentRow}>
                    <View>
                        <Text style={styles.headerTitle}>Teşhis Geçmişi</Text>
                        <Text style={styles.headerSubtitle}>Kayıtlı Analizlerim</Text>
                    </View>
                    {history.length > 0 && (
                        <TouchableOpacity 
                            style={styles.deleteAllButton} 
                            onPress={handleDeleteAll}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.deleteAllText}>Hepsini Sil</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* İçerik */}
            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.loadingText}>Analiz geçmişi yükleniyor...</Text>
                </View>
            ) : history.length === 0 ? (
                <View style={styles.centerContainer}>
                    <View style={styles.emptyIconCircle}>
                        <MaterialCommunityIcons name="clipboard-text-outline" size={48} color={colors.accent} />
                    </View>
                    <Text style={styles.emptyText}>Henüz Kayıtlı Teşhis Yok</Text>
                    <Text style={styles.emptySubText}>Bitki yapraklarını taratarak sonuçları otomatik olarak buraya kaydedebilirsiniz.</Text>
                </View>
            ) : (
                <FlatList
                    data={history}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderHistoryItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                />
            )}

            {/* DETAY MODALI */}
            <DiagnosisDetailModal
                visible={modalVisible}
                selectedItem={selectedItem}
                onClose={() => { setModalVisible(false); setSelectedItem(null); }}
                onDelete={handleDelete}
                styles={styles}
                colors={colors}
            />

            {/* ÖZEL ONAY MODALI */}
            <CustomAlert {...customAlertProps} />
        </SafeAreaView>
    );
}

const getDynamicStyles = (colors) => StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.navInactive + '20',
    },
    headerContentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    deleteAllButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 59, 48, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    deleteAllText: {
        color: '#FF3B30',
        fontSize: 13,
        fontWeight: 'bold',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.textMain,
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 14,
        color: colors.textMuted,
        marginTop: 2,
    },
    listContent: {
        padding: 20,
        paddingBottom: 40,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    loadingText: {
        marginTop: 12,
        color: colors.textMuted,
        fontSize: 15,
        fontWeight: '500',
    },
    emptyIconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.accent + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.textMain,
        marginBottom: 8,
        textAlign: 'center',
    },
    emptySubText: {
        fontSize: 14,
        color: colors.textMuted,
        textAlign: 'center',
        lineHeight: 20,
    },
    card: {
        flexDirection: 'row',
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 12,
        alignItems: 'center',
        marginBottom: 14,
        shadowColor: colors.shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: colors.background === '#121212' ? 0.3 : 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    cardImage: {
        width: 70,
        height: 70,
        borderRadius: 14,
        backgroundColor: colors.background,
    },
    cardInfo: {
        flex: 1,
        marginLeft: 16,
        justifyContent: 'center',
    },
    cardPlantName: {
        fontSize: 17,
        fontWeight: 'bold',
        color: colors.textMain,
        marginBottom: 4,
    },
    statusBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        marginBottom: 6,
    },
    statusText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    cardDate: {
        fontSize: 11,
        color: colors.textMuted,
    },
    cardRight: {
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        height: 70,
        paddingVertical: 2,
    },
    accuracyText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: colors.accent,
    },
    deleteButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 59, 48, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Modal Stilleri
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.card,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        height: '85%',
        paddingTop: 16,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.navInactive + '20',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.textMain,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalScroll: {
        padding: 24,
        paddingBottom: 50,
    },
    dragHandle: {
        width: 48,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: colors.navInactive + '45',
        alignSelf: 'center',
        marginTop: 8,
        marginBottom: 2,
    },
    modalImageContainer: {
        position: 'relative',
        width: '100%',
        height: 300,
        borderRadius: 24,
        overflow: 'hidden',
        marginBottom: 20,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.navInactive + '15',
    },
    modalImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    imageFloatingBadge: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
    },
    imageFloatingBadgeText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: 'bold',
    },
    zoomIconBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalHeaderActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    deleteModalButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 59, 48, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    zoomOverlayAbsolute: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.98)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000,
    },
    zoomCloseButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        right: 24,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10010,
    },
    zoomImage: {
        width: '100%',
        height: '80%',
    },
    sectionCard: {
        backgroundColor: colors.card,
        borderRadius: 24,
        padding: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.navInactive + '15',
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.navInactive + '15',
        paddingBottom: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.textMain,
        letterSpacing: -0.2,
    },
    rowLabelGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.navInactive + '08',
    },
    detailLabel: {
        fontSize: 14,
        color: colors.textMuted,
        fontWeight: '500',
    },
    detailValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.textMain,
    },
    treatmentCard: {
        backgroundColor: colors.accent,
        padding: 20,
        borderRadius: 24,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 4,
    },
    treatmentTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    treatmentTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    treatmentText: {
        fontSize: 14,
        color: '#F4FBF4',
        lineHeight: 22,
        fontWeight: '500',
    },
});
