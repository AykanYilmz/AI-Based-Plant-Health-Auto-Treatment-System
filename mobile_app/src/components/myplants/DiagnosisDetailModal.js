import React, { useState } from 'react';
import { View, Text, Animated, ScrollView, Image, TouchableOpacity, Modal } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSwipeModal } from '../../hooks/useSwipeModal';
import { api } from '../../services/ApiClient';
import { describeDiagnosis } from '../../utils/diagnosisStatus';

/**
 * DiagnosisDetailModal — Teşhis geçmişindeki bir kaydın detaylarını
 * bottom-sheet modal olarak gösterir. Akıcı sürükleme jesti ile kapatılabilir.
 *
 * @param {{
 *   visible: boolean,
 *   selectedItem: object,
 *   onClose: () => void,
 *   onDelete: (id: number) => void,
 *   styles: object,
 *   colors: object
 * }} props
 */
export default function DiagnosisDetailModal({ visible, selectedItem, onClose, onDelete, styles, colors }) {
    const { swipePanResponder, closeModal, handleScrollEnd, animatedStyle } = useSwipeModal(onClose);
    const [zoomVisible, setZoomVisible] = useState(false);

    // Modal kapandığında zoom durumunu sıfırla (effect yerine render sırasında; ekstra render yok)
    const [wasVisible, setWasVisible] = useState(visible);
    if (visible !== wasVisible) {
        setWasVisible(visible);
        if (!visible) setZoomVisible(false);
    }

    const handleClose = () => {
        setZoomVisible(false);
        closeModal();
    };

    const formatDate = (isoString) => {
        if (!isoString) return '—';
        const date = new Date(isoString);
        return date.toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (!selectedItem) return null;

    const diagnosis = describeDiagnosis(selectedItem);

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={handleClose}
        >
            <View style={styles.modalOverlay}>
                <Animated.View style={[styles.modalContent, animatedStyle]}>

                    {/* Sürükleme çizgisi (drag handle) */}
                    <View style={styles.dragHandleWrapper} {...swipePanResponder.panHandlers}>
                        <View style={styles.dragHandle} />
                    </View>

                    {/* Header */}
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Teşhis Detayı</Text>
                        <View style={styles.modalHeaderActions}>
                            {/* Çöp Kutusu */}
                            <TouchableOpacity
                                style={[styles.deleteModalButton, { marginRight: 16 }]}
                                onPress={() => onDelete(selectedItem.id)}
                                activeOpacity={0.7}
                            >
                                <MaterialCommunityIcons name="trash-can-outline" size={22} color="#FF3B30" />
                            </TouchableOpacity>

                            {/* Kapat */}
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={handleClose}
                                activeOpacity={0.7}
                            >
                                <MaterialCommunityIcons name="close" size={20} color={colors.textMain} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.modalScroll}
                        onScrollEndDrag={handleScrollEnd}
                        scrollEventThrottle={16}
                        bounces={true}
                        alwaysBounceVertical={true}
                    >
                        {/* Fotoğraf Kartı */}
                        <TouchableOpacity 
                            style={styles.modalImageContainer} 
                            activeOpacity={0.9}
                            onPress={() => setZoomVisible(true)}
                        >
                            <Image
                                source={api.imageSource(selectedItem.resim_yolu)}
                                style={styles.modalImage}
                            />
                            <View style={styles.imageFloatingBadge}>
                                <MaterialCommunityIcons name="leaf" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                                <Text style={styles.imageFloatingBadgeText}>
                                    {selectedItem.bitki_adi_tr || selectedItem.bitki_adi}
                                </Text>
                            </View>
                            <View style={styles.zoomIconBadge}>
                                <MaterialCommunityIcons name="magnify-plus-outline" size={18} color="#FFFFFF" />
                            </View>
                        </TouchableOpacity>

                        {/* Bitki Bilgisi */}
                        <View style={styles.sectionCard}>
                            <View style={styles.sectionHeaderRow}>
                                <MaterialCommunityIcons name="information-outline" size={20} color={colors.accent} style={{ marginRight: 8 }} />
                                <Text style={styles.sectionTitle}>Bitki Bilgisi</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <View style={styles.rowLabelGroup}>
                                    <MaterialCommunityIcons name="leaf-maple" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
                                    <Text style={styles.detailLabel}>Bitki Türü</Text>
                                </View>
                                <Text style={styles.detailValue}>{selectedItem.bitki_adi_tr || selectedItem.bitki_adi}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <View style={styles.rowLabelGroup}>
                                    <MaterialCommunityIcons name="shield-check-outline" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
                                    <Text style={styles.detailLabel}>Analiz Güvenilirliği</Text>
                                </View>
                                <Text style={styles.detailValue}>%{parseFloat(selectedItem.bitki_guven).toFixed(1)}</Text>
                            </View>
                        </View>

                        {/* Hastalık Durumu */}
                        <View style={styles.sectionCard}>
                            <View style={styles.sectionHeaderRow}>
                                <MaterialCommunityIcons
                                    name="heart-pulse"
                                    size={20}
                                    color={diagnosis.color}
                                    style={{ marginRight: 8 }}
                                />
                                <Text style={styles.sectionTitle}>Hastalık Durumu</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <View style={styles.rowLabelGroup}>
                                    <MaterialCommunityIcons name="alert-decagram-outline" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
                                    <Text style={styles.detailLabel}>Durum</Text>
                                </View>
                                <Text style={[styles.detailValue, { color: diagnosis.color }]}>
                                    {diagnosis.isHealthy ? 'Sağlıklı Bitki' : diagnosis.label}
                                </Text>
                            </View>
                            {diagnosis.kind === 'disease' && (
                                <View style={styles.detailRow}>
                                    <View style={styles.rowLabelGroup}>
                                        <MaterialCommunityIcons name="target" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
                                        <Text style={styles.detailLabel}>Teşhis Kesinliği</Text>
                                    </View>
                                    <Text style={styles.detailValue}>%{parseFloat(selectedItem.hastalik_guven).toFixed(1)}</Text>
                                </View>
                            )}
                            <View style={styles.detailRow}>
                                <View style={styles.rowLabelGroup}>
                                    <MaterialCommunityIcons name="calendar-clock" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
                                    <Text style={styles.detailLabel}>Analiz Tarihi</Text>
                                </View>
                                <Text style={styles.detailValue}>{formatDate(selectedItem.tarih)}</Text>
                            </View>
                        </View>

                        {/* Tedavi Önerisi */}
                        <View style={[styles.sectionCard, styles.treatmentCard]}>
                            <View style={styles.treatmentTitleRow}>
                                <MaterialCommunityIcons name="shield-star" size={24} color="#FFFFFF" style={{ marginRight: 8 }} />
                                <Text style={styles.treatmentTitle}>Otonom Tedavi Önerisi</Text>
                            </View>
                            <Text style={styles.treatmentText}>{selectedItem.tedavi_onerisi}</Text>
                        </View>
                    </ScrollView>
                </Animated.View>

                {/* BÜYÜTÜLMÜŞ RESİM MODALI (100% Ekranı Kaplayan Zoom Overlay) */}
                {zoomVisible && (
                    <View style={styles.zoomOverlayAbsolute}>
                        <TouchableOpacity style={styles.zoomCloseButton} onPress={() => setZoomVisible(false)}>
                            <MaterialCommunityIcons name="close" size={28} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Image 
                            source={api.imageSource(selectedItem.resim_yolu)} 
                            style={styles.zoomImage} 
                            resizeMode="contain"
                        />
                    </View>
                )}
            </View>
        </Modal>
    );
}
