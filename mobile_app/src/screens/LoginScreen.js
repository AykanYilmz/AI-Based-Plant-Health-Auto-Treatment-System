import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { sessionStore } from '../services/SessionStore';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';


export default function LoginScreen() {
    const { login, register, guestLogin } = useAuth();
    const { isDark, colors } = useTheme();

    const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Form fields
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [name, setName] = useState('');
    const [registerEmail, setRegisterEmail] = useState('');
    const [registerPassword, setRegisterPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);

    // Password visibility
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Dinamik stiller
    const styles = useMemo(() => getDynamicStyles(colors, isDark), [colors, isDark]);

    // Beni Hatırla: yalnızca e-posta hatırlanır (şifre cihazda asla saklanmaz)
    useEffect(() => {
        const loadRememberedLogin = async () => {
            try {
                const { email, rememberMe: isRemembered } = await sessionStore.loadRememberedLogin();
                if (isRemembered) {
                    if (email) setLoginEmail(email);
                    setRememberMe(true);
                }
            } catch (err) {
                console.log('Beni hatırla yüklenemedi:', err);
            }
        };
        loadRememberedLogin();
    }, []);

    // Hataları temizle
    useEffect(() => {
        setErrorMsg('');
    }, [activeTab, loginEmail, loginPassword, name, registerEmail, registerPassword, confirmPassword]);

    // E-posta format kontrolü
    const isValidEmail = (val) => {
        const reg = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        return reg.test(val);
    };

    const handleLoginSubmit = async () => {
        if (!loginEmail.trim() || !loginPassword) {
            setErrorMsg('Lütfen e-posta ve şifrenizi girin.');
            return;
        }
        if (!isValidEmail(loginEmail)) {
            setErrorMsg('Geçerli bir e-posta adresi girin.');
            return;
        }

        setLoading(true);
        const res = await login(loginEmail.trim(), loginPassword, rememberMe);
        setLoading(false);

        if (!res.basarili) {
            setErrorMsg(res.hata);
        }
    };

    const handleRegisterSubmit = async () => {
        if (!name.trim() || !registerEmail.trim() || !registerPassword || !confirmPassword) {
            setErrorMsg('Lütfen tüm alanları doldurun.');
            return;
        }
        if (!isValidEmail(registerEmail)) {
            setErrorMsg('Geçerli bir e-posta adresi girin.');
            return;
        }
        if (registerPassword.length < 6) {
            setErrorMsg('Şifreniz en az 6 karakter olmalıdır.');
            return;
        }
        if (registerPassword !== confirmPassword) {
            setErrorMsg('Şifreler uyuşmuyor.');
            return;
        }

        setLoading(true);
        const res = await register(name.trim(), registerEmail.trim(), registerPassword);
        setLoading(false);

        if (!res.basarili) {
            setErrorMsg(res.hata);
        }
    };

    const handleGuestSubmit = async () => {
        setLoading(true);
        const res = await guestLogin();
        setLoading(false);

        if (!res.basarili) {
            setErrorMsg(res.hata);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Logo ve Başlık */}
                    <View style={styles.logoContainer}>
                        <View style={styles.logoCircle}>
                            <MaterialCommunityIcons name="leaf" size={48} color="#FFFFFF" />
                        </View>
                        <Text style={styles.title}>
                            Verdant<Text style={styles.titleGreen}>AI</Text>
                        </Text>
                        <Text style={styles.subtitle}>
                            Yapay Zeka Destekli Bitki Sağlığı ve Otonom Tedavi Sistemi
                        </Text>
                    </View>

                    {/* Hata Mesajı */}
                    {!!errorMsg && (
                        <View style={styles.errorContainer}>
                            <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#E74C3C" />
                            <Text style={styles.errorText}>{errorMsg}</Text>
                        </View>
                    )}

                    {/* Giriş/Kayıt Sekmeleri */}
                    <View style={styles.tabContainer}>
                        <TouchableOpacity
                            style={[styles.tabButton, activeTab === 'login' && styles.tabButtonActive]}
                            onPress={() => setActiveTab('login')}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.tabText, activeTab === 'login' && styles.tabTextActive]}>
                                Giriş Yap
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tabButton, activeTab === 'register' && styles.tabButtonActive]}
                            onPress={() => setActiveTab('register')}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.tabText, activeTab === 'register' && styles.tabTextActive]}>
                                Kayıt Ol
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Form Kartı */}
                    <View style={styles.card}>
                        {activeTab === 'login' ? (
                            // GİRİŞ YAP FORMU
                            <View>
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
                                        value={loginEmail}
                                        onChangeText={setLoginEmail}
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
                                        value={loginPassword}
                                        onChangeText={setLoginPassword}
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

                                {/* Beni Hatırla */}
                                <TouchableOpacity
                                    style={styles.rememberMeRow}
                                    onPress={() => setRememberMe(!rememberMe)}
                                    activeOpacity={0.8}
                                >
                                    <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                                        {rememberMe && (
                                            <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
                                        )}
                                    </View>
                                    <Text style={styles.rememberMeText}>Beni Hatırla</Text>
                                </TouchableOpacity>

                                {/* Gönder Butonu */}
                                <TouchableOpacity
                                    style={styles.submitButton}
                                    onPress={handleLoginSubmit}
                                    disabled={loading}
                                    activeOpacity={0.9}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.submitButtonText}>Giriş Yap</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        ) : (
                            // KAYIT OL FORMU
                            <View>
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
                                        value={registerEmail}
                                        onChangeText={setRegisterEmail}
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
                                        value={registerPassword}
                                        onChangeText={setRegisterPassword}
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

                                {/* Şifre Onay Giriş */}
                                <Text style={styles.inputLabel}>Şifre Tekrar</Text>
                                <View style={styles.inputContainer}>
                                    <MaterialCommunityIcons name="lock-check-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="••••••"
                                        placeholderTextColor={colors.textMuted + '80'}
                                        secureTextEntry={!showConfirmPassword}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                        style={styles.eyeIcon}
                                    >
                                        <MaterialCommunityIcons
                                            name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                                            size={20}
                                            color={colors.textMuted}
                                        />
                                    </TouchableOpacity>
                                </View>

                                {/* Gönder Butonu */}
                                <TouchableOpacity
                                    style={styles.submitButton}
                                    onPress={handleRegisterSubmit}
                                    disabled={loading}
                                    activeOpacity={0.9}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.submitButtonText}>Kayıt Ol</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* Misafir Girişi Bölümü */}
                    <View style={styles.guestSection}>
                        <Text style={styles.guestInfoText}>
                            Hesap açmadan denemek mi istiyorsunuz?
                        </Text>
                        <TouchableOpacity
                            style={styles.guestButton}
                            onPress={handleGuestSubmit}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.guestButtonText}>Misafir Girişi Yap</Text>
                            <MaterialCommunityIcons name="arrow-right" size={18} color={colors.accent} style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                        <Text style={styles.guestTipText}>
                            * Misafir verileriniz daha sonra gerçek bir hesaba yükseltildiğinde korunur.
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const getDynamicStyles = (colors, isDark) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 32,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    logoCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#648754',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        shadowColor: '#648754',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: isDark ? 0.4 : 0.2,
        shadowRadius: 10,
        elevation: 6,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: colors.textMain,
        letterSpacing: 0.5,
    },
    titleGreen: {
        color: '#2ECC71',
    },
    subtitle: {
        fontSize: 14,
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: 6,
        paddingHorizontal: 16,
        lineHeight: 20,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(231, 76, 60, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(231, 76, 60, 0.2)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    errorText: {
        color: '#E74C3C',
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 8,
        flex: 1,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
        borderRadius: 12,
        padding: 4,
        marginBottom: 16,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 8,
    },
    tabButtonActive: {
        backgroundColor: colors.card,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    tabText: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.textMuted,
    },
    tabTextActive: {
        color: colors.accent,
    },
    card: {
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 24,
        shadowColor: colors.shadowColor,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: isDark ? 0.3 : 0.05,
        shadowRadius: 20,
        elevation: 10,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textMain,
        marginBottom: 8,
        marginTop: 12,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 50,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        color: colors.textMain,
        fontSize: 15,
        height: '100%',
    },
    eyeIcon: {
        padding: 4,
    },
    rememberMeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
        marginBottom: 8,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: colors.accent,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    checkboxChecked: {
        backgroundColor: colors.accent,
    },
    rememberMeText: {
        fontSize: 14,
        color: colors.textMain,
        fontWeight: '500',
    },
    submitButton: {
        backgroundColor: colors.accent,
        height: 52,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 24,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    guestSection: {
        alignItems: 'center',
        marginTop: 32,
    },
    guestInfoText: {
        fontSize: 14,
        color: colors.textMuted,
    },
    guestButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    guestButtonText: {
        color: colors.accent,
        fontSize: 16,
        fontWeight: '700',
    },
    guestTipText: {
        fontSize: 11,
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: 12,
        paddingHorizontal: 32,
        lineHeight: 16,
    },
});
