import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    Platform,
    StatusBar,
    TouchableOpacity,
    Modal,
    TextInput,
    ActivityIndicator,
    ScrollView,
    KeyboardAvoidingView,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CustomAlert from '../components/CustomAlert';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { registrationError } from '../utils/credentialRules';

export default function MenuScreen() {
    const { isDark, colors, toggleTheme } = useTheme();
    const { user, upgrade, logout } = useAuth();

    // Özel onay modalı
    const { showCustomAlert, showInfoAlert, hideCustomAlert, customAlertProps } = useCustomAlert();

    // Modalların state'leri
    const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Dinamik stiller
    const styles = useMemo(() => getDynamicStyles(colors, isDark), [colors, isDark]);

    const isGuest = user?.user_type === 'guest';

    // Şifre görünürlüğü
    const [showPassword, setShowPassword] = useState(false);

    const handleUpgradeSubmit = async () => {
        const formError = registrationError({ name, email, password, confirmPassword });
        if (formError) {
            setErrorMsg(formError);
            return;
        }

        setLoading(true);
        setErrorMsg('');
        const res = await upgrade(name.trim(), email.trim(), password);
        setLoading(false);

        if (res.basarili) {
            setUpgradeModalVisible(false);
            // Formu sıfırla
            setName('');
            setEmail('');
            setPassword('');
            setConfirmPassword('');
            
            setTimeout(() => {
                showInfoAlert('Başarılı', 'Hesabınız başarıyla yükseltildi! Artık şifrenizle giriş yapabilirsiniz.');
            }, 500);
        } else {
            setErrorMsg(res.hata);
        }
    };

    const handleLogout = () => {
        showCustomAlert(
            'Çıkış Yap',
            'Oturumunuzu sonlandırmak istediğinizden emin misiniz?',
            async () => {
                hideCustomAlert();
                await logout();
            },
            true,
            'Çıkış Yap',
            'İptal'
        );
    };

    const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'M';

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                
                {/* ── PROFİL KARTI ────────────────────────── */}
                <View style={styles.profileCard}>
                    <View style={styles.avatarContainer}>
                        <Text style={styles.avatarText}>{userInitial}</Text>
                    </View>
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>{user?.name || 'Misafir Kullanıcı'}</Text>
                        <Text style={styles.userEmail}>
                            {isGuest ? 'Oturum Türü: Misafir' : user?.email}
                        </Text>
                        <View style={[styles.badge, isGuest ? styles.badgeGuest : styles.badgeRegistered]}>
                            <Text style={styles.badgeText}>
                                {isGuest ? 'MİSAFİR HESAP' : 'KAYITLI ÜYE'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ── HESAP YÜKSELTME BANNER'I (SADECE MİSAFİR) ── */}
                {isGuest && (
                    <View style={styles.upgradeBanner}>
                        <View style={styles.upgradeHeader}>
                            <MaterialCommunityIcons name="star-outline" size={24} color="#F39C12" />
                            <Text style={styles.upgradeTitle}>Hesabını Tam Üyeliğe Yükselt!</Text>
                        </View>
                        <Text style={styles.upgradeDesc}>
                            Cihazınızdaki teşhis ve sulama geçmişinizi kaybetmeden, e-posta ve şifrenizle her yerden erişebileceğiniz kalıcı bir hesap oluşturun.
                        </Text>
                        <TouchableOpacity
                            style={styles.upgradeButton}
                            onPress={() => setUpgradeModalVisible(true)}
                            activeOpacity={0.9}
                        >
                            <Text style={styles.upgradeButtonText}>Hemen Yükselt</Text>
                            <MaterialCommunityIcons name="rocket-launch" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── AYARLAR LİSTESİ ─────────────────────── */}
                <View style={styles.menuGroup}>
                    <Text style={styles.menuGroupTitle}>Uygulama Ayarları</Text>

                    {/* Tema Değiştir */}
                    <TouchableOpacity style={styles.menuItem} onPress={toggleTheme} activeOpacity={0.7}>
                        <View style={styles.menuItemLeft}>
                            <MaterialCommunityIcons
                                name={isDark ? 'weather-night' : 'weather-sunny'}
                                size={22}
                                color={colors.accent}
                                style={styles.menuIcon}
                            />
                            <Text style={styles.menuText}>Tema Değiştir</Text>
                        </View>
                        <Text style={styles.menuValue}>{isDark ? 'Karanlık' : 'Aydınlık'}</Text>
                    </TouchableOpacity>

                    {/* Dil */}
                    <View style={styles.menuItem}>
                        <View style={styles.menuItemLeft}>
                            <MaterialCommunityIcons name="translate" size={22} color={colors.accent} style={styles.menuIcon} />
                            <Text style={styles.menuText}>Uygulama Dili</Text>
                        </View>
                        <Text style={styles.menuValue}>Türkçe</Text>
                    </View>

                    {/* Sürüm */}
                    <View style={styles.menuItem}>
                        <View style={styles.menuItemLeft}>
                            <MaterialCommunityIcons name="information-outline" size={22} color={colors.accent} style={styles.menuIcon} />
                            <Text style={styles.menuText}>Sürüm</Text>
                        </View>
                        <Text style={styles.menuValue}>v1.0.0</Text>
                    </View>
                </View>

                {/* ── ÇIKIŞ YAP ───────────────────────────── */}
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
                    <MaterialCommunityIcons name="logout-variant" size={22} color="#E74C3C" style={styles.logoutIcon} />
                    <Text style={styles.logoutText}>Oturumu Kapat</Text>
                </TouchableOpacity>

            </ScrollView>

            {/* ── HESAP YÜKSELTME MODALI ──────────────── */}
            <Modal
                visible={upgradeModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setUpgradeModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Hesabını Yükselt</Text>
                            <TouchableOpacity onPress={() => setUpgradeModalVisible(false)} style={styles.modalCloseButton}>
                                <MaterialCommunityIcons name="close" size={24} color={colors.textMain} />
                            </TouchableOpacity>
                        </View>

                        {!!errorMsg && (
                            <View style={styles.errorContainer}>
                                <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#E74C3C" />
                                <Text style={styles.errorText}>{errorMsg}</Text>
                            </View>
                        )}

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* İsim Giriş */}
                            <Text style={styles.inputLabel}>İsim Soyisim</Text>
                            <View style={styles.inputContainer}>
                                <MaterialCommunityIcons name="account-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Ahmet Yılmaz"
                                    placeholderTextColor={colors.textMuted + '80'}
                                    autoCapitalize="words"
                                    autoCorrect={false}
                                    value={name}
                                    onChangeText={setName}
                                />
                            </View>

                            {/* E-posta Giriş */}
                            <Text style={styles.inputLabel}>E-posta</Text>
                            <View style={styles.inputContainer}>
                                <MaterialCommunityIcons name="email-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="ornek@eposta.com"
                                    placeholderTextColor={colors.textMuted + '80'}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    value={email}
                                    onChangeText={setEmail}
                                />
                            </View>

                            {/* Şifre Giriş */}
                            <Text style={styles.inputLabel}>Şifre</Text>
                            <View style={styles.inputContainer}>
                                <MaterialCommunityIcons name="lock-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="••••••"
                                    placeholderTextColor={colors.textMuted + '80'}
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    value={password}
                                    onChangeText={setPassword}
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    style={styles.eyeIcon}
                                >
                                    <MaterialCommunityIcons
                                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                        size={20}
                                        color={colors.textMuted}
                                    />
                                </TouchableOpacity>
                            </View>

                            {/* Şifre Tekrar */}
                            <Text style={styles.inputLabel}>Şifre Tekrar</Text>
                            <View style={styles.inputContainer}>
                                <MaterialCommunityIcons name="lock-check-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="••••••"
                                    placeholderTextColor={colors.textMuted + '80'}
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                />
                            </View>

                            {/* Onayla Butonu */}
                            <TouchableOpacity
                                style={styles.modalSubmitButton}
                                onPress={handleUpgradeSubmit}
                                disabled={loading}
                                activeOpacity={0.9}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <>
                                        <Text style={styles.modalSubmitButtonText}>Değişiklikleri Kaydet</Text>
                                        <MaterialCommunityIcons name="check" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
                                    </>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ÖZEL ONAY MODALI */}
            <CustomAlert {...customAlertProps} />
        </SafeAreaView>
    );
}

const getDynamicStyles = (colors, isDark) => StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingVertical: 24,
    },
    profileCard: {
        flexDirection: 'row',
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        shadowColor: colors.shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.3 : 0.05,
        shadowRadius: 10,
        elevation: 4,
        marginBottom: 20,
    },
    avatarContainer: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#648754',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        shadowColor: '#648754',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 3,
    },
    avatarText: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: 'bold',
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.textMain,
    },
    userEmail: {
        fontSize: 13,
        color: colors.textMuted,
        marginTop: 2,
    },
    badge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginTop: 8,
    },
    badgeGuest: {
        backgroundColor: 'rgba(243, 156, 18, 0.15)',
    },
    badgeRegistered: {
        backgroundColor: 'rgba(46, 204, 113, 0.15)',
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: isDark ? '#FFF' : '#333',
        letterSpacing: 0.5,
    },
    upgradeBanner: {
        backgroundColor: isDark ? 'rgba(100, 135, 84, 0.12)' : 'rgba(100, 135, 84, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(100, 135, 84, 0.25)',
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
    },
    upgradeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    upgradeTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.textMain,
        marginLeft: 8,
    },
    upgradeDesc: {
        fontSize: 13,
        color: colors.textMuted,
        lineHeight: 18,
        marginBottom: 16,
    },
    upgradeButton: {
        backgroundColor: '#648754',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#648754',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 3,
    },
    upgradeButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    menuGroup: {
        marginBottom: 24,
    },
    menuGroupTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.textMuted,
        textTransform: 'uppercase',
        marginBottom: 8,
        marginLeft: 4,
        letterSpacing: 0.5,
    },
    menuItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.card,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 8,
        shadowColor: colors.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.2 : 0.02,
        shadowRadius: 4,
        elevation: 1,
    },
    menuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    menuIcon: {
        marginRight: 12,
    },
    menuText: {
        fontSize: 15,
        color: colors.textMain,
        fontWeight: '500',
    },
    menuValue: {
        fontSize: 14,
        color: colors.textMuted,
        fontWeight: '500',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isDark ? 'rgba(231, 76, 60, 0.1)' : 'rgba(231, 76, 60, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(231, 76, 60, 0.2)',
        borderRadius: 12,
        paddingVertical: 14,
        marginTop: 8,
    },
    logoutIcon: {
        marginRight: 8,
    },
    logoutText: {
        color: '#E74C3C',
        fontSize: 15,
        fontWeight: '700',
    },
    // Modal Stilleri
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: '85%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.textMain,
    },
    modalCloseButton: {
        padding: 4,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(231, 76, 60, 0.1)',
        borderRadius: 8,
        padding: 10,
        marginBottom: 16,
    },
    errorText: {
        color: '#E74C3C',
        fontSize: 13,
        fontWeight: '500',
        marginLeft: 8,
        flex: 1,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textMain,
        marginBottom: 6,
        marginTop: 10,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        marginBottom: 8,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        color: colors.textMain,
        fontSize: 14,
        height: '100%',
    },
    eyeIcon: {
        padding: 4,
    },
    modalSubmitButton: {
        backgroundColor: '#648754',
        height: 50,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 10,
        shadowColor: '#648754',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 3,
    },
    modalSubmitButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
});
