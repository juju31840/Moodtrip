import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import photos from "@/data/city-photos.json";
import type { ItineraryStep } from "@/types/itinerary";
import { RouteThumb } from "@/ui/route-thumb";
import { colors } from "@/ui/theme";

export interface CityPhoto {
  ville: string;
  url: string;
  auteur: string;
  licence: string;
  page: string;
}

const PHOTOS = photos as Record<string, CityPhoto>;
const ALIAS: Record<string, string> = { marseilles: "marseille", lyons: "lyon" };

/**
 * La ville d'une sortie : celle que portent le plus d'étapes (un week-end peut passer par une
 * commune voisine), ramenée à la forme des clés — sans arrondissement, en français.
 */
export function outingCityKey(steps: ItineraryStep[]): string | null {
  const counts = new Map<string, number>();
  for (const step of steps) {
    if (!step.city) continue;
    const base = step.city.toLowerCase().replace(/-\d+(er|e|eme)?-arrondissement$/, "");
    const key = ALIAS[base] ?? base;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function photoFor(steps: ItineraryStep[]): CityPhoto | null {
  const key = outingCityKey(steps);
  return key ? PHOTOS[key] ?? null : null;
}

/**
 * La vignette d'une sortie : une photo de sa ville (retour du 26/09/2026 — la carte répétée à
 * chaque ligne « fait répétitif »), et la carte du parcours là où l'on n'a pas de photo — ville
 * hors des cent plus grandes, ou sortie enregistrée avant que les étapes ne portent leur ville.
 */
export function OutingThumb({ steps, size }: { steps: ItineraryStep[]; size: number }) {
  const photo = photoFor(steps);
  if (!photo) return <RouteThumb steps={steps} width={size} height={size} />;
  return (
    <View style={{ width: size, height: size, backgroundColor: colors.paper2 }}>
      <Image source={{ uri: photo.url }} alt={`Vue de ${photo.ville}`} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
    </View>
  );
}
