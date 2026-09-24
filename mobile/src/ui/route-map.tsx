import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

import type { ItineraryStep } from "@/types/itinerary";
import { colors, fonts } from "@/ui/theme";

/**
 * Carte du parcours. Squelette sur `react-native-maps` (Plans d'Apple), parce qu'il tourne dans
 * Expo Go et permet d'essayer l'application tout de suite, sans compte développeur. Le passage à
 * Mapbox — le style papier du site — demandera un build de développement, donc le compte de
 * Nathan.
 *
 * Marqueurs numérotés et non colorés par type : douze couleurs donnaient un semis illisible.
 */
export function RouteMap({ steps, activeId, onSelect }: {
  steps: ItineraryStep[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<MapView>(null);

  useEffect(() => {
    if (steps.length === 0) return;
    ref.current?.fitToCoordinates(
      steps.map((step) => ({ latitude: step.location.lat, longitude: step.location.lng })),
      { edgePadding: { top: 90, right: 50, bottom: 50, left: 50 }, animated: false }
    );
  }, [steps]);

  return (
    <MapView ref={ref} style={StyleSheet.absoluteFill} showsPointsOfInterests={false} showsBuildings={false}>
      <Polyline
        coordinates={steps.map((step) => ({ latitude: step.location.lat, longitude: step.location.lng }))}
        strokeColor={colors.ink}
        strokeWidth={3}
        lineDashPattern={[7, 6]}
      />
      {steps.map((step, index) => (
        <Marker
          key={step.id}
          coordinate={{ latitude: step.location.lat, longitude: step.location.lng }}
          onPress={() => onSelect(step.id)}
          tracksViewChanges={false}
        >
          <View style={[styles.pin, { backgroundColor: activeId === null || activeId === step.id ? colors.accent : colors.ink }]}>
            <Text style={styles.pinText}>{index + 1}</Text>
          </View>
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  // Le cercle est une convention cartographique, pas un arrondi d'interface.
  pin: { width: 30, height: 30, borderRadius: 15, borderWidth: 3, borderColor: colors.paper, alignItems: "center", justifyContent: "center" },
  pinText: { fontFamily: fonts.display, fontSize: 15, color: colors.paper },
});
