import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import type { ItineraryStep } from "@/types/itinerary";
import { colors } from "@/ui/theme";

const STATIC_URL = "https://api.mapbox.com/styles/v1/mapbox/light-v11/static";
const MARKERS_MAX = 6;

/**
 * La carte du parcours comme image de chaque proposition — même choix et mêmes calages que
 * `lib/route-thumbnail.ts` du site : il n'existe pas de photo gratuite et juste d'un bar, et un
 * parcours de quartier ne ressemble pas à un parcours qui traverse la ville, ce qui décide souvent.
 * Marge basse plus grande : le titre est posé sur l'image en bandeau d'encre.
 */
export function routeThumbUrl(steps: ItineraryStep[], width: number, height: number): string | null {
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  if (!token || steps.length === 0) return null;
  const every = Math.max(1, Math.ceil(steps.length / MARKERS_MAX));
  const markers = steps
    .filter((_, index) => index % every === 0)
    .slice(0, MARKERS_MAX)
    .map((step, index) => `pin-s-${index + 1}+DD3B2E(${step.location.lng.toFixed(5)},${step.location.lat.toFixed(5)})`)
    .join(",");
  // Marges proportionnées à l'image : les marges fixes du site (30 et 74 px) dépassaient la hauteur
  // d'une miniature de 88 px, et Mapbox refusait la requête — un carré vide à la place de la carte.
  // La grande marge basse ne sert qu'aux cartes qui portent un bandeau de titre.
  const side = Math.round(Math.min(30, width * 0.14, height * 0.14));
  const bottom = height >= 140 ? Math.round(height * 0.44) : side;
  return `${STATIC_URL}/${markers}/auto/${Math.round(width)}x${Math.round(height)}@2x?access_token=${token}&logo=false&attribution=false&padding=${side},${side},${bottom},${side}`;
}

export function RouteThumb({ steps, width, height }: { steps: ItineraryStep[]; width: number; height: number }) {
  const uri = routeThumbUrl(steps, width, height);
  return (
    <View style={{ width, height, backgroundColor: colors.paper2 }}>
      {uri && <Image source={{ uri }} alt="Carte du parcours" style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />}
    </View>
  );
}
