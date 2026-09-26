import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

import type { GeoPoint, ScoutedPlace } from "@/types/itinerary";
import { colors } from "@/ui/theme";

const FRANCE = { latitude: 46.6, longitude: 2.4 };

/**
 * Le repérage pendant l'attente — même geste que `components/ScoutingMap.tsx` sur le site.
 *
 * La carte est là **dès l'ouverture** (retour du 26/09/2026 : « un palier d'une seconde où la
 * carte ne vient pas ») : vue de France, puis elle file vers la ville dès que le téléphone l'a
 * géocodée, et descend lentement sur le quartier. Les adresses examinées s'y posent quand le
 * repérage du serveur arrive, sans interrompre le mouvement. Immobile si l'utilisateur a demandé
 * à réduire les animations.
 */
export function ScoutingMap({ origin, places }: { origin: GeoPoint | null; places: ScoutedPlace[] }) {
  const ref = useRef<MapView>(null);
  const [shown, setShown] = useState(0);
  const [reduced, setReduced] = useState(false);
  const flown = useRef(false);
  // Minuteur hors du cycle de l'effet : quand le repérage du serveur remplace le point du
  // téléphone, l'effet se relance, et son nettoyage aurait annulé la descente sur le quartier.
  const slowZoom = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(slowZoom.current), []);
  const ordered = [...places].sort((a, b) => Number(b.recognized) - Number(a.recognized));

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
  }, []);

  // Le vol vers la ville part une seule fois, au premier point connu.
  useEffect(() => {
    if (!origin || flown.current) return;
    flown.current = true;
    const center = { latitude: origin.lat, longitude: origin.lng };
    if (reduced) {
      ref.current?.setCamera({ center, zoom: 14, heading: 0, pitch: 0 });
      return;
    }
    ref.current?.animateCamera({ center, zoom: 12.6, heading: -8, pitch: 0 }, { duration: 700 });
    slowZoom.current = setTimeout(() => {
      ref.current?.animateCamera({ center, zoom: 14.6, heading: 14, pitch: 38 }, { duration: 15000 });
    }, 750);
  }, [origin, reduced]);

  // Apparition échelonnée sur ~4 s, quel que soit le nombre de lieux.
  useEffect(() => {
    if (ordered.length === 0) return;
    if (reduced) {
      setShown(ordered.length);
      return;
    }
    const step = Math.max(40, Math.floor(4000 / ordered.length));
    const timer = setInterval(() => setShown((current) => Math.min(ordered.length, current + 1)), step);
    return () => clearInterval(timer);
  }, [ordered.length, reduced]);

  return (
    <MapView
      ref={ref}
      style={StyleSheet.absoluteFill}
      initialCamera={{ center: origin ? { latitude: origin.lat, longitude: origin.lng } : FRANCE, zoom: origin ? 12.4 : 5, heading: 0, pitch: 0, altitude: 12000 }}
      scrollEnabled={false}
      zoomEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      showsPointsOfInterests={false}
    >
      {ordered.slice(0, shown).map((place, index) => (
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
      {origin && (
        <Marker coordinate={{ latitude: origin.lat, longitude: origin.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <View style={{ width: 16, height: 16, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.paper }} />
        </Marker>
      )}
    </MapView>
  );
}
