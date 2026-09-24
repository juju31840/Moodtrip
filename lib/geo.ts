import { plausibilityRadiusKm } from "./distance";
import type { GeoPoint, TripMode } from "@/types/itinerary";

const EARTH_RADIUS_KM = 6371;

/** Distance à vol d'oiseau entre deux points, en kilomètres. */
export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Le rayon de plausibilité suit le palier de distance (`lib/distance.ts`), le même pour tous les
 * modes. Il valait 17,5 km pour une soirée « Toute la ville » et 110 km pour un voyage : c'était
 * la limite qui laissait passer les étapes hors de la ville que les testeurs ont signalées.
 * `mode` reste dans la signature pour les appelants, sans effet sur la borne.
 */
export function isPlausibleStepLocation(
  stepLocation: GeoPoint,
  referencePoint: GeoPoint,
  _mode: TripMode,
  distance: number
): boolean {
  return haversineDistanceKm(stepLocation, referencePoint) <= plausibilityRadiusKm(distance);
}

/** Filtre les étapes dont les coordonnées sont trop éloignées du point de référence pour être crédibles. */
export function filterPlausibleSteps<T extends { location: GeoPoint }>(
  steps: T[],
  referencePoint: GeoPoint,
  mode: TripMode,
  distance: number
): T[] {
  return steps.filter((step) =>
    isPlausibleStepLocation(step.location, referencePoint, mode, distance)
  );
}

export interface MapBounds {
  southwest: GeoPoint;
  northeast: GeoPoint;
}

/**
 * Bounds englobant tous les points, avec une marge, pour un fitBounds initial.
 *
 * Générique sur le point et non lié à `ItineraryStep` : la carte personnelle cadre des lieux
 * visités, qui n'ont ni jour ni période.
 */
export function computeBounds(
  points: { location: GeoPoint }[],
  paddingDegrees = 0.02
): MapBounds | null {
  if (points.length === 0) return null;

  let minLat = points[0]!.location.lat;
  let maxLat = points[0]!.location.lat;
  let minLng = points[0]!.location.lng;
  let maxLng = points[0]!.location.lng;

  for (const point of points) {
    minLat = Math.min(minLat, point.location.lat);
    maxLat = Math.max(maxLat, point.location.lat);
    minLng = Math.min(minLng, point.location.lng);
    maxLng = Math.max(maxLng, point.location.lng);
  }

  return {
    southwest: { lat: minLat - paddingDegrees, lng: minLng - paddingDegrees },
    northeast: { lat: maxLat + paddingDegrees, lng: maxLng + paddingDegrees },
  };
}
