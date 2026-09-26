import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

import type { Scouting } from "@/lib/generation";
import { colors } from "@/ui/theme";

/**
 * Le repérage pendant l'attente — même geste que `components/ScoutingMap.tsx` sur le site : un
 * lent zoom sur le quartier de départ pendant que les adresses examinées apparaissent, les
 * recommandées en vermillon. Immobile si l'utilisateur a demandé à réduire les animations.
 */
export function ScoutingMap({ scouting }: { scouting: Scouting }) {
  const ref = useRef<MapView>(null);
  const [shown, setShown] = useState(0);
  const [reduced, setReduced] = useState(false);
  const places = [...scouting.places].sort((a, b) => Number(b.recognized) - Number(a.recognized));

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      setReduced(reduce);
      if (reduce) {
        setShown(places.length);
        return;
      }
      const step = Math.max(40, Math.floor(4000 / Math.max(1, places.length)));
      timer = setInterval(() => setShown((current) => Math.min(places.length, current + 1)), step);
    });
    return () => clearInterval(timer);
  }, [places.length]);

  const center = { latitude: scouting.origin.lat, longitude: scouting.origin.lng };

  return (
    <MapView
      ref={ref}
      style={StyleSheet.absoluteFill}
      initialCamera={{ center, zoom: 12.4, heading: -8, pitch: 0, altitude: 12000 }}
      scrollEnabled={false}
      zoomEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      showsPointsOfInterests={false}
      onMapReady={() => {
        if (reduced) return;
        ref.current?.animateCamera({ center, zoom: 14.6, heading: 14, pitch: 38, altitude: 2500 }, { duration: 15000 });
      }}
    >
      {places.slice(0, shown).map((place, index) => (
        <Marker key={`${place.name}-${index}`} coordinate={{ latitude: place.location.lat, longitude: place.location.lng }} tracksViewChanges={false} anchor={{ x: 0.5, y: 0.5 }}>
          <View
            style={{
              width: place.recognized ? 10 : 6,
              height: place.recognized ? 10 : 6,
              backgroundColor: place.recognized ? colors.accent : colors.ink,
              opacity: place.recognized ? 1 : 0.45,
            }}
          />
        </Marker>
      ))}
      <Marker coordinate={center} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
        <View style={{ width: 16, height: 16, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.paper }} />
      </Marker>
    </MapView>
  );
}
