import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Colors } from './colors';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const systemColorScheme = useColorScheme();
    const [theme, setTheme] = useState(systemColorScheme || 'light');

    useEffect(() => {
        if (systemColorScheme) {
            setTheme(systemColorScheme);
        }
    }, [systemColorScheme]);

    const toggleTheme = () => {
        // En profesyonel, sıfır-lag native GPU Crossfade animasyonu
        const customAnimation = {
            duration: 400, // 400ms yumuşakça akışkan geçiş
            create: {
                type: LayoutAnimation.Types.easeInEaseOut,
                property: LayoutAnimation.Properties.opacity,
            },
            update: {
                type: LayoutAnimation.Types.easeInEaseOut,
                property: LayoutAnimation.Properties.opacity, // Sadece saydamlık üzerinden renklerin birbirine karışmasını sağlar
            },
            delete: {
                type: LayoutAnimation.Types.easeInEaseOut,
                property: LayoutAnimation.Properties.opacity,
            },
        };

        LayoutAnimation.configureNext(customAnimation);
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    // Ekranların her biri renk paletini ayrıca hesaplamasın diye hazır olarak sağlanır
    const value = useMemo(() => {
        const isDark = theme === 'dark';
        return { theme, isDark, colors: isDark ? Colors.dark : Colors.light, toggleTheme };
    }, [theme]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

/** @returns {{ theme: 'light'|'dark', isDark: boolean, colors: typeof Colors.light, toggleTheme: Function }} */
export const useTheme = () => useContext(ThemeContext);
