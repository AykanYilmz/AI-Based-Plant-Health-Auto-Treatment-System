import React from 'react';
import { useVideoPlayer, VideoView } from 'expo-video';

// Hava durumu kartının arkasında sessiz ve döngüsel oynayan yerel video
export default function WeatherBackgroundVideo({ source, style }) {
    const player = useVideoPlayer(source, (p) => {
        p.loop = true;
        p.muted = true;
        p.play();
    });

    return (
        <VideoView
            player={player}
            style={style}
            contentFit="cover"
            nativeControls={false}
        />
    );
}
