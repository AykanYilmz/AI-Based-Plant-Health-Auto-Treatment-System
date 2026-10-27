import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

export default function CommunityScreen() {
    const { colors } = useTheme();
    
    // Dinamik stiller
    const styles = useMemo(() => getDynamicStyles(colors), [colors]);

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <View style={styles.content}>
                <Text style={styles.text}>Toplum Özelliği Yakında!</Text>
            </View>
        </SafeAreaView>
    );
}

const getDynamicStyles = (colors) => StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.background, // Temaya göre dinamik zemin
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: colors.textMain, // Temaya göre dinamik metin rengi
        fontSize: 18,
        fontWeight: '600',
    },
});
