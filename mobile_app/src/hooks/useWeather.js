import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';

const WEATHER_VIDEOS = {
    clear: require('../../assets/videos/sunny.mp4'),
    cloudy: require('../../assets/videos/cloudy.mp4'),
    rain: require('../../assets/videos/rain.mp4'),
    snow: require('../../assets/videos/snow.mp4'),
    fog: require('../../assets/videos/fog.mp4'),
    storm: require('../../assets/videos/storm.mp4'),
    default: require('../../assets/videos/default.mp4'),
};

/**
 * useWeather — Kullanıcının anlık konumuna göre hava durumu ve şehir bilgisi sağlar.
 * Open-Meteo API ve expo-location entegrasyonu bu hook içinde yönetilir.
 * İzin henüz sorulmadıysa sistem penceresinden önce uygulama temalı bir açıklama
 * gösterilebilmesi için `needsLocationPermission` true döner.
 * @returns {{ weather: object|null, city: string, needsLocationPermission: boolean,
 *             requestLocationPermission: Function, declineLocationPermission: Function }}
 */
export function useWeather() {
    const [city, setCity] = useState('Konum Aranıyor...');
    const [weather, setWeather] = useState(null);
    const [needsLocationPermission, setNeedsLocationPermission] = useState(false);

    const loadWeather = useCallback(async () => {
        try {
            let location = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = location.coords;

            let geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (geocode && geocode.length > 0) {
                const loc = geocode[0];
                const il = loc.region || loc.adminArea || loc.city || '';
                const ilce = loc.subregion || loc.district || loc.name || '';

                if (il && ilce && il !== ilce) {
                    setCity(`${il}, ${ilce}`);
                } else {
                    setCity(il || ilce || 'Konum Bulunamadı');
                }
            }

            const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
            );
            const data = await response.json();

            if (data.current_weather) {
                let code = data.current_weather.weathercode;
                let iconName = 'weather-sunny';
                let bgVideo = WEATHER_VIDEOS.clear;
                let desc = 'Güneşli';

                if (code > 0 && code <= 3)   { iconName = 'weather-partly-cloudy'; bgVideo = WEATHER_VIDEOS.cloudy; desc = 'Parçalı Bulutlu'; }
                if (code >= 45 && code <= 48) { iconName = 'weather-fog';          bgVideo = WEATHER_VIDEOS.fog;    desc = 'Sisli'; }
                if (code >= 51 && code <= 67) { iconName = 'weather-rainy';        bgVideo = WEATHER_VIDEOS.rain;   desc = 'Yağmurlu'; }
                if (code >= 71 && code <= 77) { iconName = 'weather-snowy';        bgVideo = WEATHER_VIDEOS.snow;   desc = 'Karlı'; }
                if (code >= 80 && code <= 82) { iconName = 'weather-pouring';      bgVideo = WEATHER_VIDEOS.rain;   desc = 'Sağanak Yağış'; }
                if (code >= 95)               { iconName = 'weather-lightning';    bgVideo = WEATHER_VIDEOS.storm;  desc = 'Fırtınalı'; }

                setWeather({
                    temp: Math.round(data.current_weather.temperature),
                    icon: iconName,
                    videoUrl: bgVideo,
                    description: desc,
                });
            }
        } catch (_error) {
            setCity('Bağlantı Kurulamadı');
        }
    }, []);

    // Mevcut izin durumunu kontrol et; sorulmamışsa önce temalı açıklama penceresi gösterilir
    useEffect(() => {
        (async () => {
            try {
                const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
                if (status === 'granted') {
                    loadWeather();
                } else if (canAskAgain) {
                    setNeedsLocationPermission(true);
                } else {
                    setCity('Konum İzni Yok');
                }
            } catch (_error) {
                setCity('Bağlantı Kurulamadı');
            }
        })();
    }, [loadWeather]);

    const requestLocationPermission = useCallback(async () => {
        setNeedsLocationPermission(false);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
            loadWeather();
        } else {
            setCity('Konum İzni Yok');
        }
    }, [loadWeather]);

    const declineLocationPermission = useCallback(() => {
        setNeedsLocationPermission(false);
        setCity('Konum İzni Yok');
    }, []);

    return { weather, city, needsLocationPermission, requestLocationPermission, declineLocationPermission };
}
