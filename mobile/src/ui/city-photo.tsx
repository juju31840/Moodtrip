import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import photos from "@/data/city-photos.json";
import type { ItineraryStep } from "@/types/itinerary";
import { RouteThumb } from "@/ui/route-thumb";
import { colors } from "@/ui/theme";

export interface Photo {
  url: string;
  auteur: string;
  licence: string;
  page: string;
}

interface CityPhotos {
  ville: string;
  lat: number;
  lng: number;
  photos: Photo[];
}

export interface CreditedPhoto extends Photo {
  ville: string;
}

const CITIES = photos as unknown as Record<string, CityPhotos>;
const ALIAS: Record<string, string> = { marseilles: "marseille", lyons: "lyon" };
/** Au-delà, une sortie n'est plus « dans » la ville : on garde la carte du parcours. */
const DISTANCE_MAX_KM = 25;

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * La ville d'une sortie. D'abord celle que portent ses étapes ; à défaut — sorties enregistrées
 * avant que les étapes ne la portent, comme celle de Toulouse restée sans image le 26/09/2026 —
 * la grande ville la plus proche du centre de ses étapes.
 */
export function outingCityKey(steps: ItineraryStep[]): string | null {
  const counts = new Map<string, number>();
  for (const step of steps) {
    if (!step.city) continue;
    const base = step.city.toLowerCase().replace(/-\d+(er|e|eme)?-arrondissement$/, "");
    const key = ALIAS[base] ?? base;
    if (CITIES[key]) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const named = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (named) return named;
  if (steps.length === 0) return null;
  const center = {
    lat: steps.reduce((sum, step) => sum + step.location.lat, 0) / steps.length,
    lng: steps.reduce((sum, step) => sum + step.location.lng, 0) / steps.length,
  };
  let best: { key: string; km: number } | null = null;
  for (const [key, city] of Object.entries(CITIES)) {
    const km = distanceKm(center, city);
    if (!best || km < best.km) best = { key, km };
  }
  return best && best.km <= DISTANCE_MAX_KM ? best.key : null;
}

/**
 * La photo d'une sortie. `rank` = combien de sorties de la même ville la précèdent dans la liste :
 * chacune prend la photo suivante, pour que dix sorties à Lyon ne montrent pas dix fois la même
 * image (retour du 26/09/2026).
 */
export function photoFor(steps: ItineraryStep[], rank = 0): CreditedPhoto | null {
  const key = outingCityKey(steps);
  const city = key ? CITIES[key] : undefined;
  if (!city || city.photos.length === 0) return null;
  return { ...city.photos[rank % city.photos.length]!, ville: city.ville };
}

/** Rang de chaque sortie parmi celles de sa ville, dans l'ordre de la liste. */
export function photoRanks(outings: { id: string; steps: ItineraryStep[] }[]): Map<string, number> {
  const seen = new Map<string, number>();
  const ranks = new Map<string, number>();
  for (const outing of outings) {
    const key = outingCityKey(outing.steps) ?? "";
    const rank = seen.get(key) ?? 0;
    ranks.set(outing.id, rank);
    seen.set(key, rank + 1);
  }
  return ranks;
}

/**
 * La vignette d'une sortie : une photo de sa ville, et la carte du parcours là où l'on n'en a pas
 * (ville hors des cent plus grandes, ou trop loin de toutes).
 */
export function OutingThumb({ steps, rank, width, height }: { steps: ItineraryStep[]; rank: number; width: number; height: number }) {
  const photo = photoFor(steps, rank);
  if (!photo) return <RouteThumb steps={steps} width={width} height={height} />;
  return (
    <View style={{ width, height, backgroundColor: colors.paper2 }}>
      <Image source={{ uri: photo.url }} alt={`Vue de ${photo.ville}`} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
    </View>
  );
}
