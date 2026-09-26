import { createStore } from "@/lib/kv";
import type { GeoPoint } from "@/types/itinerary";

/**
 * Le centre d'une ville, côté téléphone — pour que la carte d'attente s'ouvre **tout de suite**
 * sur la bonne ville, sans attendre le repérage du serveur (~0,3 à 1 s : l'écran restait vide,
 * retour du 26/09/2026). Gardé en mémoire : la deuxième fois, la carte est là instantanément.
 */
const cache = createStore<Record<string, GeoPoint>>("vibetrip.geocode.v1", {});

/** Retient le centre d'une ville trouvé ailleurs (suggestions de saisie) : il servira à l'attente. */
export function rememberCenter(city: string, point: GeoPoint) {
  const key = city.trim().toLowerCase();
  if (key && !cache.get()[key]) cache.set({ ...cache.get(), [key]: point });
}

export async function cityCenter(city: string): Promise<GeoPoint | null> {
  const key = city.trim().toLowerCase();
  if (!key) return null;
  const known = cache.get()[key];
  if (known) return known;
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  try {
    const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(city)}&country=fr&types=place&limit=1&access_token=${token}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as { features?: { geometry?: { coordinates?: [number, number] } }[] };
    const coordinates = data.features?.[0]?.geometry?.coordinates;
    if (!coordinates) return null;
    const point = { lat: coordinates[1], lng: coordinates[0] };
    cache.set({ ...cache.get(), [key]: point });
    return point;
  } catch {
    return null;
  }
}

/** La commune d'un point, pour ranger « Ma carte » quand l'étape ne la portait pas. */
export async function cityAt(point: GeoPoint): Promise<string | null> {
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  try {
    const url = `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${point.lng}&latitude=${point.lat}&types=place&limit=1&access_token=${token}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as { features?: { properties?: { name?: string } }[] };
    return data.features?.[0]?.properties?.name ?? null;
  } catch {
    return null;
  }
}
