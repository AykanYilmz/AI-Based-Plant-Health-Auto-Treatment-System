import { useRef, useState, useEffect, useCallback } from 'react';
import { PanResponder, Animated, Dimensions } from 'react-native';

const { height: screenHeight } = Dimensions.get('window');

/**
 * useSwipeModal — Bottom-sheet modalları için PanResponder + Animated tabanlı
 * kaydırarak kapatma jesti sağlar. iOS fiziksel cihaz ve Android'de tam uyumludur.
 *
 * Düzeltmeler (iOS uyumluluk):
 * - onStartShouldSetPanResponder: () => true  → Drag handle'da touch'u hemen kapat
 * - Manuel panY.setValue kullanımı             → Negatif dy'yi engeller (yukarı kaymaz)
 * - onPanResponderTerminationRequest: false    → iOS native gesture'ın çalmasını engeller
 *
 * @param {() => void} onClose — Modal kapandığında çağrılacak callback
 * @returns {{
 *   panY: Animated.Value,
 *   swipePanResponder: object,
 *   closeModal: () => void,
 *   handleScrollEnd: (e: object) => void,
 *   animatedStyle: object
 * }}
 */
export function useSwipeModal(onClose) {
    const [panY] = useState(() => new Animated.Value(0));

    // PanResponder bir kez oluşturulur; onClose sonradan değişse bile her zaman en güncelini çağırmak için ref'te tutulur
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    const closeModal = useCallback(() => {
        Animated.timing(panY, {
            toValue: screenHeight,
            duration: 280,
            useNativeDriver: false,
        }).start(() => {
            panY.setValue(0);
            onCloseRef.current();
        });
    }, [panY]);

    // closeModal'daki ref yalnızca jest olay işleyicilerinde (render dışında) okunur; analiz aracı
    // PanResponder.create'e verilen işleyicileri render sırasında çalışıyor sanıp yanlış uyarı veriyor.
    // eslint-disable-next-line react-hooks/refs
    const [swipePanResponder] = useState(() =>
        PanResponder.create({
            // ✅ iOS FIX: Drag handle'da touch'u hemen yakala (false → true)
            // false olunca iOS native gesture önce alıyor ve bize hiç gelmiyor
            onStartShouldSetPanResponder: () => true,
            onStartShouldSetPanResponderCapture: () => false,

            onMoveShouldSetPanResponder: (evt, gestureState) => {
                // Yalnızca net aşağı hareket — yatay kaymayı filtrele
                return gestureState.dy > 5 && Math.abs(gestureState.dx) < 15;
            },
            onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
                return gestureState.dy > 5 && Math.abs(gestureState.dx) < 15;
            },

            // ✅ iOS FIX: iOS'un başka bir gesture tanıyıcısına jesti devretmesini engelle
            onPanResponderTerminationRequest: () => false,

            onPanResponderMove: (evt, gestureState) => {
                // ✅ iOS FIX: Sadece aşağı yönde hareket izle (dy < 0 → yukarı → yoksay)
                // Animated.event kullanmak yerine setValue ile negatif değerleri engelliyoruz
                if (gestureState.dy > 0) {
                    panY.setValue(gestureState.dy);
                }
            },

            onPanResponderRelease: (evt, gestureState) => {
                // Yeterince aşağı çekildiyse veya hız yeterliyse kapat
                if (gestureState.dy > 100 || gestureState.vy > 1.2) {
                    closeModal();
                } else {
                    // Yetersizse yaylanarak geri dön
                    Animated.spring(panY, {
                        toValue: 0,
                        friction: 7,
                        tension: 40,
                        useNativeDriver: false,
                    }).start();
                }
            },

            onPanResponderTerminate: () => {
                // Jesti başka bir şey çaldıysa geri dön
                Animated.spring(panY, {
                    toValue: 0,
                    friction: 7,
                    useNativeDriver: false,
                }).start();
            },
        })
    );

    // ScrollView'in en tepesinde yukarı çekilince kapanma (bounce effect)
    const handleScrollEnd = (e) => {
        if (e.nativeEvent.contentOffset.y < -50) closeModal();
    };

    // Animated.View'e uygulanacak transform stilleri
    const animatedStyle = {
        transform: [
            {
                translateY: panY.interpolate({
                    inputRange: [0, screenHeight],
                    outputRange: [0, screenHeight],
                    extrapolate: 'clamp',
                }),
            },
            {
                scale: panY.interpolate({
                    inputRange: [0, screenHeight],
                    outputRange: [1, 0.92],
                    extrapolate: 'clamp',
                }),
            },
        ],
    };

    return { panY, swipePanResponder, closeModal, handleScrollEnd, animatedStyle };
}
