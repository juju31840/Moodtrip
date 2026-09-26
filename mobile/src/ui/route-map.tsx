import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
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
export function RouteMap({ steps, activeId, onSelect, animate = false }: {
  steps: ItineraryStep[];
  activeId: string | null;
  onSelect: (id: string) => void;
  /**
   * Trace le parcours à l'ouverture : les étapes apparaissent une à une, dans l'ordre, reliées au
   * fur et à mesure — comme on suit un itinéraire au crayon sur un plan. Dans l'esprit du repérage
   * de l'écran d'attente. Tout est affiché d'un coup si l'on a demandé à réduire les animations.
   */
  animate?: boolean;
}) {
  const ref = useRef<MapView>(null);
  const [revealed, setRevealed] = useState(animate ? 0 : steps.length);

  useEffect(() => {
    if (!animate) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        setRevealed(steps.length);
        return;
      }
      // Un court temps pour que la carte se cadre, puis une étape toutes les 350 ms.
      setTimeout(() => {
        if (cancelled) return;
        setRevealed(1);
        timer = setInterval(() => setRevealed((count) => (count >= steps.length ? count : count + 1)), 350);
      }, 400);
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [animate, steps.length]);

  // Une étape remplacée (« Changer ») ne rejoue pas l'animation : tout ce qui est déjà tracé reste.
  const shown = animate ? steps.slice(0, revealed) : steps;

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
        coordinates={shown.map((step) => ({ latitude: step.location.lat, longitude: step.location.lng }))}
        strokeColor={colors.ink}
        strokeWidth={3}
        lineDashPattern={[7, 6]}
      />
      {shown.map((step, index) => (
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
