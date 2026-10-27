import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * PlantItem — Dashboard bitki geçmişi listesindeki her bir satır kartı.
 * "Stacked Photo" efektiyle bitki fotoğrafı ve ihtiyaç ikonlarını gösterir.
 *
 * @param {{ name: string, status: string, imageSource: { uri: string, headers?: object }, needs: string[], styles: object, colors: object, onPress: () => void }} props
 */
export default function PlantItem({ name, status, imageSource, needs, styles, colors, onPress }) {
    return (
        <TouchableOpacity style={styles.plantItemContainer} onPress={onPress}>
            {/* Fotoğraf ve arka plan katman hissi */}
            <View style={styles.plantImageWrapper}>
                <View style={[styles.plantImageStackBase, styles.stackLayer2]} />
                <View style={[styles.plantImageStackBase, styles.stackLayer1]} />
                <Image source={imageSource} style={styles.plantImageMain} />
            </View>

            <View style={styles.plantTextContainer}>
                <View>
                    <Text style={styles.plantTitle} numberOfLines={1}>{name}</Text>
                    <Text style={styles.plantSubtitle} numberOfLines={1}>{status}</Text>
                </View>

                <View style={styles.plantNeedsRow}>
                    {needs.length === 0 ? (
                        <View style={[styles.needIconCircle, { borderColor: colors.brand, backgroundColor: 'rgba(46, 204, 113, 0.1)' }]}>
                            <MaterialCommunityIcons name="check" size={18} color={colors.brand} />
                        </View>
                    ) : null}
                    {needs.includes('water') && (
                        <View style={[styles.needIconCircle, { borderColor: colors.alert, backgroundColor: 'rgba(231, 76, 60, 0.1)' }]}>
                            <MaterialCommunityIcons name="water" size={18} color={colors.alert} />
                        </View>
                    )}
                    {needs.includes('fertilizer') && (
                        <View style={[styles.needIconCircle, { borderColor: '#1ABC9C', backgroundColor: 'rgba(26, 188, 156, 0.1)', marginLeft: 8 }]}>
                            <MaterialCommunityIcons name="flask" size={18} color="#1ABC9C" />
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
}
