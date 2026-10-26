import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from './src/theme/colors';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';

// Ekranları içeri aktar
import LoginScreen from './src/screens/LoginScreen';
import TabNavigator from './src/navigation/TabNavigator';
import CameraScreen from './src/screens/CameraScreen';
import DiagnosisResultScreen from './src/screens/DiagnosisResultScreen';

const Stack = createNativeStackNavigator();

function AppContent() {
    const { theme } = useTheme();
    const { user, loading } = useAuth();
    const isDark = theme === 'dark';
    const colors = isDark ? Colors.dark : Colors.light;

    // React Navigation'ın arka plan sızıntılarını (beyaz köşeler vb.) önlemek için custom tema
    const MyNavigationTheme = {
        ...(isDark ? DarkTheme : DefaultTheme),
        colors: {
            ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
            background: colors.background,
        },
    };

    // Oturum yüklenirken yüklenme ekranı göster
    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    return (
        <NavigationContainer theme={MyNavigationTheme}>
            <StatusBar style={colors.statusBar} backgroundColor={colors.background} />
            {/* Android sistem navigasyon çubuğunu gizle (alttan kaydırınca geçici olarak görünür) */}
            <NavigationBar hidden />
            <Stack.Navigator
                screenOptions={{ headerShown: false }}
            >
                {user === null ? (
                    // Giriş yapılmadıysa sadece Giriş ekranı
                    <Stack.Screen
                        name="Login"
                        component={LoginScreen}
                        options={{
                            animationTypeForReplace: 'pop',
                        }}
                    />
                ) : (
                    // Giriş yapıldıysa ana akış ekranları
                    <>
                        <Stack.Screen
                            name="MainTabs"
                            component={TabNavigator}
                        />
                        <Stack.Screen
                            name="Camera"
                            component={CameraScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="DiagnosisResult"
                            component={DiagnosisResultScreen}
                            options={{ headerShown: false, animation: 'slide_from_bottom' }}
                        />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}

export default function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </ThemeProvider>
    );
}

