import React, { useMemo } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    StyleSheet,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';


export default function CustomAlert({
    visible,
    title,
    message,
    confirmText = 'Onayla',
    cancelText = 'Vazgeç',
    onConfirm,
    onCancel,
    isDestructive = false,
    showCancel = true,
}) {
    const { isDark, colors } = useTheme();

    const styles = useMemo(() => getDynamicStyles(colors, isDark), [colors, isDark]);

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onCancel}
        >
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={onCancel}
            >
                <TouchableWithoutFeedback>
                    <View style={styles.alertBox}>
                        {/* Başlık */}
                        <Text style={styles.title}>{title}</Text>

                        {/* Mesaj */}
                        {!!message && <Text style={styles.message}>{message}</Text>}

                        {/* Buton Alanı */}
                        <View style={styles.buttonContainer}>
                            {/* Vazgeç Butonu */}
                            {showCancel && onCancel && (
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={onCancel}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.cancelText}>{cancelText}</Text>
                                </TouchableOpacity>
                            )}

                            {/* Onayla Butonu */}
                            <TouchableOpacity
                                style={[
                                    styles.confirmButton,
                                    isDestructive ? styles.confirmDestructive : styles.confirmAccent,
                                ]}
                                onPress={onConfirm}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.confirmText}>{confirmText}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </TouchableOpacity>
        </Modal>
    );
}

const getDynamicStyles = (colors, isDark) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
    },
    alertBox: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: colors.card,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: colors.shadowColor,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: isDark ? 0.4 : 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textMain,
        textAlign: 'center',
    },
    message: {
        fontSize: 14,
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: 10,
        lineHeight: 20,
    },
    buttonContainer: {
        flexDirection: 'row',
        marginTop: 24,
        width: '100%',
        justifyContent: 'space-between',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        height: 46,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    },
    cancelText: {
        fontSize: 14,
        color: colors.textMuted,
        fontWeight: '600',
    },
    confirmButton: {
        flex: 1,
        height: 46,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 5,
        elevation: 3,
    },
    confirmAccent: {
        backgroundColor: colors.accent,
        shadowColor: colors.accent,
    },
    confirmDestructive: {
        backgroundColor: colors.danger,
        shadowColor: colors.danger,
    },
    confirmText: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '700',
    },
});
