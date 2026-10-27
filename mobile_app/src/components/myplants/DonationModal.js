import React, { useState } from 'react';
import { View, Text, Animated, ScrollView, Modal, TouchableOpacity, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSwipeModal } from '../../hooks/useSwipeModal';

/**
 * DonationModal — Fidan bağışı bottom-sheet modali.
 * Dinamik fiyatlandırma, kredi kartı formu, validasyon ve
 * başarılı sertifika ekranını içerir.
 * Akıcı sürükleme jesti ile kapatılabilir.
 *
 * @param {{ visible: boolean, onClose: () => void, styles: object, colors: object }} props
 */
export default function DonationModal({ visible, onClose, styles, colors }) {
    const [donationName, setDonationName]   = useState('');
    const [saplingCount, setSaplingCount]   = useState(1);
    const [donationSuccess, setDonationSuccess] = useState(false);
    const [cardNumber, setCardNumber]       = useState('');
    const [cardExpiry, setCardExpiry]       = useState('');
    const [cardCvv, setCardCvv]             = useState('');

    const resetForm = () => {
        setDonationName('');
        setSaplingCount(1);
        setDonationSuccess(false);
        setCardNumber('');
        setCardExpiry('');
        setCardCvv('');
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const { swipePanResponder, closeModal, handleScrollEnd, animatedStyle } = useSwipeModal(handleClose);

    const isFormValid =
        donationName.trim() &&
        cardNumber.replace(/\s/g, '').length === 16 &&
        cardExpiry.length === 5 &&
        cardCvv.length === 3;

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={closeModal}
        >
            <View style={styles.modalOverlay}>
                <Animated.View style={[styles.modalContent, { height: '94%' }, animatedStyle]}>

                    {/* Drag Handle */}
                    <View style={styles.dragHandleWrapper} {...swipePanResponder.panHandlers}>
                        <View style={styles.dragHandle} />
                    </View>

                    {/* Header */}
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Doğaya Hayat Ver 🌲</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
                            <MaterialCommunityIcons name="close" size={20} color={colors.textMain} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.modalScroll}
                        onScrollEndDrag={handleScrollEnd}
                        scrollEventThrottle={16}
                        bounces={true}
                        alwaysBounceVertical={true}
                    >
                        {!donationSuccess ? (
                            <>
                                {/* Kampanya Banner */}
                                <View style={styles.donationBannerPremium}>
                                    <MaterialCommunityIcons name="sprout" size={48} color={colors.brand} style={{ marginBottom: 12 }} />
                                    <Text style={styles.donationBannerTitlePremium}>VerdantAI Fidan Fonu</Text>
                                    <Text style={styles.donationBannerTextPremium}>
                                        Sistemimizle bitkilerinizi iyileştirdiniz. Şimdi doğaya bir fidan armağan ederek VerdantAI otonom yeşillendirme projelerine doğrudan destek olun!
                                    </Text>
                                </View>

                                {/* Fidan Sayısı Seçici */}
                                <View style={styles.selectorCardPremium}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <Text style={styles.fieldLabelPremium}>Fidan Adeti</Text>
                                        <Text style={styles.unitPriceBadge}>50 TL / Fidan</Text>
                                    </View>
                                    <View style={styles.counterRowPremium}>
                                        <TouchableOpacity
                                            style={styles.counterBtnPremium}
                                            onPress={() => setSaplingCount(c => Math.max(1, c - 1))}
                                        >
                                            <MaterialCommunityIcons name="minus" size={22} color="#FFFFFF" />
                                        </TouchableOpacity>
                                        <Text style={styles.counterValuePremium}>{saplingCount}</Text>
                                        <TouchableOpacity
                                            style={styles.counterBtnPremium}
                                            onPress={() => setSaplingCount(c => c + 1)}
                                        >
                                            <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Fiyat Özeti */}
                                <View style={styles.checkoutSummaryCard}>
                                    <View style={styles.checkoutSummaryRow}>
                                        <View>
                                            <Text style={styles.checkoutSummaryLabel}>ÖDEME ÖZETİ</Text>
                                            <Text style={styles.checkoutSummarySubLabel}>{saplingCount} x Fidan Bağışı</Text>
                                        </View>
                                        <Text style={styles.checkoutSummaryTotal}>{saplingCount * 50} TL</Text>
                                    </View>
                                </View>

                                {/* Ödeme Formu */}
                                <Text style={styles.formSectionTitle}>KART VE SERTİFİKA BİLGİLERİ</Text>

                                <Text style={styles.fieldLabelPremium}>Sertifika & Kart Sahibi İsim Soyisim</Text>
                                <View style={styles.inputWrapperPremium}>
                                    <MaterialCommunityIcons name="account-outline" size={22} color={colors.textMuted} style={{ marginRight: 10 }} />
                                    <TextInput
                                        style={[styles.textInputPremium, { color: colors.textMain }]}
                                        placeholder="Örn: Batuhan Yılmaz"
                                        placeholderTextColor={colors.textMuted + '80'}
                                        value={donationName}
                                        onChangeText={setDonationName}
                                    />
                                </View>

                                <Text style={styles.fieldLabelPremium}>Kart Numarası</Text>
                                <View style={styles.inputWrapperPremium}>
                                    <MaterialCommunityIcons name="credit-card-outline" size={22} color={colors.textMuted} style={{ marginRight: 10 }} />
                                    <TextInput
                                        style={[styles.textInputPremium, { color: colors.textMain }]}
                                        placeholder="0000 0000 0000 0000"
                                        placeholderTextColor={colors.textMuted + '80'}
                                        keyboardType="numeric"
                                        maxLength={19}
                                        value={cardNumber}
                                        onChangeText={(text) => {
                                            const clean = text.replace(/\D/g, '');
                                            setCardNumber(clean.replace(/(.{4})/g, '$1 ').trim());
                                        }}
                                    />
                                </View>

                                {/* Son Kullanma & CVV */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 }}>
                                    <View style={{ width: '48%' }}>
                                        <Text style={styles.fieldLabelPremium}>Son Kullanma</Text>
                                        <View style={styles.inputWrapperPremiumHalf}>
                                            <MaterialCommunityIcons name="calendar-month-outline" size={20} color={colors.textMuted} style={{ marginRight: 8 }} />
                                            <TextInput
                                                style={[styles.textInputPremium, { color: colors.textMain }]}
                                                placeholder="AA/YY"
                                                placeholderTextColor={colors.textMuted + '80'}
                                                keyboardType="numeric"
                                                maxLength={5}
                                                value={cardExpiry}
                                                onChangeText={(text) => {
                                                    const clean = text.replace(/\D/g, '');
                                                    setCardExpiry(clean.length > 2
                                                        ? `${clean.slice(0, 2)}/${clean.slice(2, 4)}`
                                                        : clean
                                                    );
                                                }}
                                            />
                                        </View>
                                    </View>
                                    <View style={{ width: '48%' }}>
                                        <Text style={styles.fieldLabelPremium}>CVV</Text>
                                        <View style={styles.inputWrapperPremiumHalf}>
                                            <MaterialCommunityIcons name="shield-lock-outline" size={20} color={colors.textMuted} style={{ marginRight: 8 }} />
                                            <TextInput
                                                style={[styles.textInputPremium, { color: colors.textMain }]}
                                                placeholder="123"
                                                placeholderTextColor={colors.textMuted + '80'}
                                                keyboardType="numeric"
                                                secureTextEntry
                                                maxLength={3}
                                                value={cardCvv}
                                                onChangeText={(text) => setCardCvv(text.replace(/\D/g, ''))}
                                            />
                                        </View>
                                    </View>
                                </View>

                                {/* Bağış Butonu */}
                                <TouchableOpacity
                                    style={[
                                        styles.donateSubmitBtnPremium,
                                        !isFormValid && { opacity: 0.5 },
                                    ]}
                                    disabled={!isFormValid}
                                    onPress={() => setDonationSuccess(true)}
                                >
                                    <MaterialCommunityIcons name="heart-flash" size={24} color="#FFF" style={{ marginRight: 10 }} />
                                    <Text style={styles.donateSubmitBtnTextPremium}>
                                        Bağışı Gerçekleştir ({saplingCount * 50} TL)
                                    </Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            /* Başarı Ekranı */
                            <View style={styles.successContainerPremium}>
                                <View style={styles.successTreeCirclePremium}>
                                    <MaterialCommunityIcons name="shield-heart" size={76} color="#FFF" />
                                </View>
                                <Text style={styles.successTitlePremium}>Teşekkür Ederiz! 🎉</Text>
                                <Text style={styles.successSubTitlePremium}>Doğamıza Can Verdiniz</Text>

                                <View style={styles.certificateSummaryCardPremium}>
                                    <MaterialCommunityIcons name="decagram-outline" size={32} color={colors.brand} style={{ marginBottom: 12 }} />
                                    <Text style={styles.certSummaryLabelPremium}>DİJİTAL SERTİFİKA</Text>
                                    <Text style={styles.certSummaryNamePremium}>{donationName}</Text>
                                    <View style={styles.dividerPremium} />
                                    <Text style={styles.certSummaryDetailsPremium}>{saplingCount} Adet Fidan Bağışı</Text>
                                    <Text style={styles.certSummarySubDetailsPremium}>VerdantAI Fidan Fonu</Text>
                                    <View style={styles.certPaymentBadgePremium}>
                                        <MaterialCommunityIcons name="check-circle" size={14} color={colors.brand} style={{ marginRight: 6 }} />
                                        <Text style={styles.certPaymentBadgeTextPremium}>Ödenen Tutar: {saplingCount * 50} TL</Text>
                                    </View>
                                </View>

                                <Text style={styles.successTextPremium}>
                                    Fidan bağışınız başarıyla tamamlandı. Sertifikanız çevre dostu e-posta adresinize gönderildi! Desteğinizle daha yeşil bir dünya kuruyoruz. 💚
                                </Text>

                                <TouchableOpacity style={styles.successCloseBtnPremium} onPress={handleClose}>
                                    <Text style={styles.successCloseBtnTextPremium}>Ana Menüye Dön</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
}
