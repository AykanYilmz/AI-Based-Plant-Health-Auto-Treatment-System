import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, StatusBar, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';


export default function DiagnosisResultScreen({ route, navigation }) {
    const { isDark, colors } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => getDynamicStyles(colors, isDark), [colors, isDark]);

    // Route'dan gelen veriler (Kararlı DTO formatı - Adapter Deseniyle Eşleştirme)
    const { result, photoUri } = route.params || {};
    
    const k1 = {
        tespit_edildi: result?.leafDetection?.detected || false,
        confidence: result?.leafDetection?.confidence || 0,
        bbox: result?.leafDetection?.bbox || null,
        toplam_tespit: result?.leafDetection?.totalCount || 0
    };
    
    const k2 = {
        tur: result?.plantInfo?.name || 'unknown',
        tur_tr: result?.plantInfo?.displayName || 'Bilinmeyen Bitki',
        confidence: result?.plantInfo?.confidence || 0,
        top3: (result?.plantInfo?.top3 || []).map(t => ({
            tur: t.name,
            tur_tr: t.displayName,
            confidence: t.confidence
        }))
    };
    
    const k3 = {
        durum: result?.healthStatus?.status || 'unknown',
        saglikli: result?.healthStatus?.isHealthy ?? null,
        hastalik: result?.healthStatus?.diseaseName || null,
        hastalik_tr: result?.healthStatus?.diseaseDisplayName || null,
        confidence: result?.healthStatus?.confidence || 0,
        dusuk_confidence: result?.healthStatus?.lowConfidence || false,
        mesaj: result?.healthStatus?.message || null,
        top3: (result?.healthStatus?.top3 || []).map(t => ({
            hastalik: t.diseaseName,
            hastalik_tr: t.diseaseDisplayName,
            confidence: t.confidence
        }))
    };
    
    const tahmin = {
        bitki: k2.tur_tr,
        hastalik: k3.hastalik_tr,
        saglikli: k3.saglikli,
        hastalik_durumu: k3.durum
    };


    return (
        <View style={[styles.container, { paddingTop: insets.top > 0 ? insets.top : (Platform.OS === 'android' ? StatusBar.currentHeight : 20) }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                
                {/* Üst Bar */}
                <View style={styles.topBar}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textMain} />
                    </TouchableOpacity>
                    <Text style={styles.topTitle}>Analiz Sonucu</Text>
                    <View style={{ width: 44 }} />
                </View>

                {/* Fotoğraf Kartı */}
                {photoUri && (
                    <View style={styles.photoCard}>
                        <Image source={{ uri: photoUri }} style={styles.photoImage} />
                    </View>
                )}

                {/* ═══ Pipeline Sonuç Kartları ═══ */}

                {/* Yaprak Tespiti Kartı */}
                <View style={styles.pipelineCard}>
                    <View style={styles.pipelineHeader}>
                        <View style={[styles.pipelineIconBox, { backgroundColor: colors.successSoft }]}>  
                            <MaterialCommunityIcons name="image-search-outline" size={22} color={colors.success} />
                        </View>
                        <View style={styles.pipelineHeaderText}>
                            <Text style={styles.pipelineTitle}>Yaprak Algılama</Text>
                            <Text style={styles.pipelineSubtitle}>Görsel üzerindeki yaprak taranıyor</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: k1.tespit_edildi ? colors.successSoft : colors.dangerSoft }]}>
                            <MaterialCommunityIcons 
                                name={k1.tespit_edildi ? "check-circle" : "close-circle"} 
                                size={16} 
                                color={k1.tespit_edildi ? colors.success : colors.danger} 
                            />
                            <Text style={[styles.statusBadgeText, { color: k1.tespit_edildi ? colors.success : colors.danger }]}>
                                {k1.tespit_edildi ? 'Başarılı' : 'Bulunamadı'}
                            </Text>
                        </View>
                    </View>
                    {k1.tespit_edildi && (
                        <View style={styles.pipelineDetails}>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Tarama Kalitesi</Text>
                                <Text style={styles.detailValue}>%{k1.confidence}</Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Bitki Türü Kartı */}
                <View style={styles.pipelineCard}>
                    <View style={styles.pipelineHeader}>
                        <View style={[styles.pipelineIconBox, { backgroundColor: colors.infoSoft }]}>
                            <MaterialCommunityIcons name="leaf" size={22} color={colors.info} />
                        </View>
                        <View style={styles.pipelineHeaderText}>
                            <Text style={styles.pipelineTitle}>Bitki Türü</Text>
                            <Text style={styles.pipelineSubtitle}>Yapay zeka bitki sınıfını teşhis ediyor</Text>
                        </View>
                    </View>
                    <View style={styles.bitkiSonuc}>
                        <Text style={styles.bitkiAdi}>{k2.tur_tr || tahmin.bitki || '—'}</Text>
                    </View>
                    {/* Tarama Güvenirliği */}
                    <View style={styles.confidenceBar}>
                        <View style={styles.confidenceTrack}>
                            <View style={[styles.confidenceFill, { 
                                width: `${Math.min(k2.confidence || 0, 100)}%`,
                                backgroundColor: (k2.confidence || 0) > 80 ? colors.success : (k2.confidence || 0) > 60 ? colors.warning : colors.danger
                            }]} />
                        </View>
                        <Text style={styles.confidenceText}>%{k2.confidence || 0}</Text>
                    </View>
                </View>

                         {/* Hastalık Tespiti Kartı */}
                <View style={[styles.pipelineCard, k3.durum === 'model_yok' && styles.pipelineCardInactive]}>
                    <View style={styles.pipelineHeader}>
                        <View style={[styles.pipelineIconBox, { backgroundColor: 
                            k3.durum === 'tespit_edildi' 
                                ? (k3.saglikli ? colors.successSoft : colors.dangerSoft)
                                : colors.warningSoft 
                        }]}>
                            <MaterialCommunityIcons 
                                name={
                                    k3.durum === 'tespit_edildi' 
                                        ? (k3.saglikli ? 'shield-check' : 'alert-circle')
                                        : 'flask-outline'
                                } 
                                size={22} 
                                color={
                                    k3.durum === 'tespit_edildi'
                                        ? (k3.saglikli ? colors.success : colors.danger)
                                        : colors.warning
                                } 
                            />
                        </View>
                        <View style={styles.pipelineHeaderText}>
                            <Text style={styles.pipelineTitle}>Sağlık Durumu Analizi</Text>
                            <Text style={styles.pipelineSubtitle}>Yapay zeka yaprak sağlığını inceliyor</Text>
                        </View>
                        {k3.durum === 'tespit_edildi' && (
                            <View style={[styles.statusBadge, { backgroundColor: k3.saglikli ? colors.successSoft : colors.dangerSoft }]}>
                                <MaterialCommunityIcons 
                                    name={k3.saglikli ? "check-circle" : "alert-circle"} 
                                    size={16} 
                                    color={k3.saglikli ? colors.success : colors.danger} 
                                />
                                <Text style={[styles.statusBadgeText, { color: k3.saglikli ? colors.success : colors.danger }]}>
                                    {k3.saglikli ? 'Sağlıklı' : 'Hastalık'}
                                </Text>
                            </View>
                        )}
                        {k3.durum === 'belirsiz' && (
                            <View style={[styles.statusBadge, { backgroundColor: colors.warningSoft }]}>
                                <MaterialCommunityIcons name="help-circle" size={16} color={colors.warning} />
                                <Text style={[styles.statusBadgeText, { color: colors.warning }]}>Belirsiz</Text>
                            </View>
                        )}
                    </View>

                    {k3.durum === 'tespit_edildi' ? (
                        <View>
                            <View style={styles.bitkiSonuc}>
                                <Text style={[styles.bitkiAdi, { color: k3.saglikli ? colors.success : colors.danger }]}>
                                    {k3.hastalik_tr || 'Bilinmiyor'}
                                </Text>
                            </View>
                            {k3.confidence != null && (
                                <View style={styles.confidenceBar}>
                                    <View style={styles.confidenceTrack}>
                                        <View style={[styles.confidenceFill, { 
                                            width: `${Math.min(k3.confidence || 0, 100)}%`,
                                            backgroundColor: k3.saglikli ? colors.success : colors.danger
                                        }]} />
                                    </View>
                                    <Text style={styles.confidenceText}>%{k3.confidence}</Text>
                                </View>
                            )}
                            {k3.dusuk_confidence && (
                                <View style={styles.warningBox}>
                                    <MaterialCommunityIcons name="alert-outline" size={16} color={colors.warning} />
                                    <Text style={styles.warningText}>
                                        Düşük güven oranı — sonuç kesin olmayabilir
                                    </Text>
                                </View>
                            )}
                        </View>
                    ) : k3.durum === 'belirsiz' ? (
                        <View>
                            <View style={styles.comingSoonBox}>
                                <MaterialCommunityIcons name="help-circle-outline" size={32} color={colors.warning} />
                                <Text style={styles.comingSoonText}>
                                    {k3.mesaj || 'Hastalık teşhisi kesin değil. Yaprağı daha yakından ve net çekip tekrar deneyin.'}
                                </Text>
                            </View>
                            {k3.top3.length > 0 && (
                                <View style={styles.pipelineDetails}>
                                    <Text style={styles.detailLabel}>Olası sonuçlar (kesin değil):</Text>
                                    {k3.top3.map((t) => (
                                        <View key={t.hastalik} style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>{t.hastalik_tr || t.hastalik}</Text>
                                            <Text style={styles.detailValue}>%{t.confidence}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    ) : k3.durum === 'model_yok' ? (
                        <View style={styles.comingSoonBox}>
                            <MaterialCommunityIcons name="information-outline" size={32} color={colors.warning} />
                            <Text style={styles.comingSoonText}>
                                {k3.mesaj || 'Bu bitki türü için henüz hastalık modeli bulunmuyor.'}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.comingSoonBox}>
                            <MaterialCommunityIcons name="alert-circle-outline" size={32} color={colors.danger} />
                            <Text style={styles.comingSoonText}>
                                {k3.mesaj || 'Hastalık tespiti sırasında bir hata oluştu.'}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Aksiyon Butonları */}
                <View style={styles.actionButtons}>
                    <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: colors.accent }]} 
                        onPress={() => navigation.goBack()}
                    >
                        <MaterialCommunityIcons name="camera-retake-outline" size={22} color="#FFF" />
                        <Text style={styles.actionBtnText}>Yeni Analiz</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.actionBtn, styles.actionBtnOutline, { borderColor: colors.accent }]} 
                        onPress={() => navigation.navigate('MainTabs')}
                    >
                        <MaterialCommunityIcons name="home-outline" size={22} color={colors.accent} />
                        <Text style={[styles.actionBtnText, { color: colors.accent }]}>Ana Sayfa</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: insets.bottom + 20 }} />
            </ScrollView>
        </View>
    );
}

const getDynamicStyles = (colors, isDark) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },

    // Üst Bar
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.surfaceMuted,
        justifyContent: 'center',
        alignItems: 'center',
    },
    topTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.textMain,
    },

    // Fotoğraf
    photoCard: {
        width: '100%',
        height: 220,
        borderRadius: 24,
        overflow: 'hidden',
        marginBottom: 16,
    },
    photoImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },

    // Pipeline Kart Stilleri
    pipelineCard: {
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 20,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    pipelineCardInactive: {
        opacity: 0.7,
        borderWidth: 1,
        borderColor: colors.border,
        borderStyle: 'dashed',
    },
    pipelineHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pipelineIconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    pipelineHeaderText: {
        flex: 1,
    },
    pipelineTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.textMain,
    },
    pipelineSubtitle: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 2,
    },

    // Status Badge
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        gap: 4,
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: 'bold',
    },

    // Pipeline Details
    pipelineDetails: {
        marginTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.divider,
        paddingTop: 12,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
    },
    detailLabel: {
        fontSize: 14,
        color: colors.textMuted,
    },
    detailValue: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textMain,
    },

    // Bitki Türü Sonucu
    bitkiSonuc: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.divider,
        alignItems: 'center',
    },
    bitkiAdi: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.textMain,
        letterSpacing: -0.5,
    },
    bitkiKey: {
        fontSize: 14,
        color: colors.textMuted,
        marginTop: 4,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },

    // Confidence Bar
    confidenceBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
        gap: 12,
    },
    confidenceTrack: {
        flex: 1,
        height: 8,
        backgroundColor: colors.surfaceMuted,
        borderRadius: 4,
        overflow: 'hidden',
    },
    confidenceFill: {
        height: '100%',
        borderRadius: 4,
    },
    confidenceText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.textMain,
        minWidth: 48,
        textAlign: 'right',
    },

    // Top 3 Sonuçlar
    top3Container: {
        marginTop: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: colors.divider,
        gap: 10,
    },
    top3Row: {
        gap: 6,
    },
    top3Label: {
        fontSize: 13,
        color: colors.textMuted,
    },
    top3LabelBold: {
        fontWeight: 'bold',
        color: colors.textMain,
        fontSize: 14,
    },
    top3BarWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    top3Percent: {
        fontSize: 13,
        color: colors.textMuted,
        minWidth: 44,
        textAlign: 'right',
    },
    top3PercentBold: {
        fontWeight: 'bold',
        color: colors.textMain,
        fontSize: 14,
    },

    // Coming Soon / Info
    comingSoonBox: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.divider,
        alignItems: 'center',
        paddingVertical: 20,
    },
    comingSoonText: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
        marginTop: 12,
        lineHeight: 20,
    },

    // Warning Box (düşük güven)
    warningBox: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        padding: 10,
        backgroundColor: colors.warningBanner,
        borderRadius: 10,
        gap: 8,
    },
    warningText: {
        flex: 1,
        fontSize: 12,
        color: colors.warning,
        lineHeight: 16,
    },

    // Aksiyon Butonları
    actionButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        gap: 8,
    },
    actionBtnOutline: {
        backgroundColor: 'transparent',
        borderWidth: 2,
    },
    actionBtnText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
});
