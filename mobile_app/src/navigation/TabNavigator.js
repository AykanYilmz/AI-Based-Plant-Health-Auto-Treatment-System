import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

import MyPlantsScreen from '../screens/MyPlantsScreen';
import CommunityScreen from '../screens/CommunityScreen';
import SearchScreen from '../screens/SearchScreen';
import MenuScreen from '../screens/MenuScreen';

const Tab = createBottomTabNavigator();

const CustomTabBarButton = ({ children, onPress, styles }) => (
    <TouchableOpacity
        style={styles.customTabBarButtonContainer}
        onPress={onPress}
        activeOpacity={1}
    >
        <View style={styles.customTabBarButton}>
            {children}
        </View>
    </TouchableOpacity>
);

export default function TabNavigator() {
    const { colors } = useTheme();

    // Edge-to-edge: sistem navigasyon çubuğu görünürse tab bar onun üstünde kalsın
    const { bottom: bottomInset } = useSafeAreaInsets();

    const styles = useMemo(() => getDynamicStyles(colors, bottomInset), [colors, bottomInset]);

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarShowLabel: false, // İsimler kapalı
                tabBarStyle: styles.tabBar,
                tabBarActiveTintColor: colors.accent, // Aktif (Örn: Botanik Yeşil)
                tabBarInactiveTintColor: colors.navInactive, // Pasif (Örn: Açık veya Koyu Gri)
                // Cihazın kendi hesaplayıcısını (Safe Area) bozmamak için zorunlu yükseklik/ortalamalar kaldırıldı
            }}
        >
            <Tab.Screen
                name="MyPlants"
                component={MyPlantsScreen}
                options={{
                    tabBarIcon: ({ color }) => (
                        <MaterialCommunityIcons name="home-variant" color={color} size={30} />
                    ),
                }}
            />
            <Tab.Screen
                name="Stats"
                component={CommunityScreen}
                options={{
                    tabBarIcon: ({ color }) => (
                        <MaterialCommunityIcons name="chart-bar" color={color} size={28} />
                    ),
                }}
            />
            
            {/* Merkez Vurgulu Buton (Alt Çubuğu Gizleyecek Kök Kamera Ekranına Yönlendirir) */}
            <Tab.Screen
                name="CenterAction"
                component={View} // Ekrana hiçbir şey render edilmez, e.preventDefault ile iptal edilir çünkü
                options={{
                    tabBarIcon: () => (
                        <MaterialCommunityIcons name="camera-outline" color="#FFFFFF" size={30} />
                    ),
                    tabBarButton: (props) => (
                        <CustomTabBarButton {...props} styles={styles} />
                    )
                }}
                listeners={({ navigation }) => ({
                    tabPress: (e) => {
                        // Varsayılan geçişi iptal et (böylece alt menü çubuğu içeren ekranda kalmazsınız)
                        e.preventDefault();
                        // Alt menünün en tepesinde olan ana 'Camera' sayfasına Push et (kaydırarak geri gelinir)
                        navigation.navigate('Camera');
                    }
                })}
            />

            <Tab.Screen
                name="Logs"
                component={SearchScreen}
                options={{
                    tabBarIcon: ({ color }) => (
                        <MaterialCommunityIcons name="file-document-outline" color={color} size={26} />
                    ),
                }}
            />
            <Tab.Screen
                name="Profile"
                component={MenuScreen}
                options={{
                    tabBarIcon: ({ color }) => (
                        <MaterialCommunityIcons name="account-outline" color={color} size={30} />
                    ),
                }}
            />
        </Tab.Navigator>
    );
}

const getDynamicStyles = (colors, bottomInset) => StyleSheet.create({
    tabBar: {
        backgroundColor: colors.card,
        // iOS için o gereksiz devasa devasa siyah boşluğu kesiyoruz, Android'de sistem çubuğu payını ekliyoruz
        height: Platform.OS === 'ios' ? 70 : 65 + bottomInset,
        paddingBottom: Platform.OS === 'ios' ? 20 : 5 + bottomInset,
        paddingTop: Platform.OS === 'ios' ? 10 : 5, 
        borderTopWidth: 0,
        borderTopRightRadius: 20, 
        borderTopLeftRadius: 20,
        shadowColor: colors.shadowColor,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: colors.cardShadowOpacity, // Daha belirgin karanlık gölge
        shadowRadius: 10,
        elevation: 10, 
    },
    customTabBarButtonContainer: {
        top: -20, // Çubuk inceldiği için oranlı kalması adına taşırma payı ufaltıldı
        justifyContent: 'center',
        alignItems: 'center',
    },
    customTabBarButton: {
        width: 66,
        height: 66,
        borderRadius: 33,
        backgroundColor: colors.accent,
        justifyContent: 'center',
        alignItems: 'center',
    }
});
