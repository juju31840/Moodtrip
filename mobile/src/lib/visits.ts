import { THEMES, themeForType } from "@shared/themes";
import { createStore } from "@/lib/kv";
import type { GeoPoint, ItineraryStep, PlaceType, ThemeId } from "@/types/itinerary";

/**
 * « Ma carte » — la contrepartie du geste de cocher. Même règles que `lib/places-store.ts` :
 * - magasin **séparé** des itinéraires : supprimer une sortie n'efface pas où l'on est allé ;
 * - décocher retire le passage, recocher ne compte pas deux fois ;
 * - identité = nom normalisé + coordonnées à 3 décimales (~110 m) : il y a un « Le Comptoir »
 *   par ville, et le modèle et le socle ne posent pas exactement le même point.
 *
 * La commune vient du socle (`step.city`), et non d'un géocodage inverse après coup comme sur le
 * site : les étapes ancrées la portent depuis le 26/09/2026.
 */
export interface VisitedPlace {
  key: string;
  name: string;
  location: GeoPoint;
  type: PlaceType;
  city: string | null;
  /**
   * Vrai une fois la commune cherchée par géocodage inverse. Sans cette marque, un point dont la
   * commune reste introuvable serait recherché à chaque ouverture de la carte, indéfiniment.
   */
  cityTried?: boolean;
  /** `itineraryId:stepId` de chaque passage — la preuve qui rattache une sortie à une ville. */
  refs: string[];
  lastAt: string;
}

export const visitsStore = createStore<VisitedPlace[]>("vibetrip.visits.v1", []);

function placeKey(step: ItineraryStep): string {
  const name = step.placeName.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  return `${name}@${step.location.lat.toFixed(3)},${step.location.lng.toFixed(3)}`;
}

export function toggleVisit(itineraryId: string, step: ItineraryStep, done: boolean) {
  const ref = `${itineraryId}:${step.id}`;
  const key = placeKey(step);
  const places = visitsStore.get();
  const existing = places.find((place) => place.key === key);

  if (done) {
    if (existing?.refs.includes(ref)) return;
    const next: VisitedPlace = existing
      ? { ...existing, refs: [...existing.refs, ref], lastAt: new Date().toISOString() }
      : {
          key,
          name: step.placeName,
          location: step.location,
          type: step.type,
          city: step.city ?? null,
          refs: [ref],
          lastAt: new Date().toISOString(),
        };
    visitsStore.set([next, ...places.filter((place) => place.key !== key)]);
    return;
  }

  if (!existing) return;
  const refs = existing.refs.filter((item) => item !== ref);
  visitsStore.set(refs.length > 0 ? places.map((place) => (place.key === key ? { ...place, refs } : place)) : places.filter((place) => place.key !== key));
}

/**
 * Retrouve après coup la commune des lieux qui ne la portaient pas — ceux cochés avant que les
 * étapes ne la reçoivent du socle. Après coup et non au moment de cocher : le retour visuel du
 * geste ne doit pas attendre un aller-retour réseau.
 */
export async function resolveMissingCities(cityAt: (point: GeoPoint) => Promise<string | null>) {
  const missing = visitsStore.get().filter((place) => !place.city && !place.cityTried);
  for (const place of missing) {
    const city = await cityAt(place.location);
    visitsStore.set(visitsStore.get().map((item) => (item.key === place.key ? { ...item, city: city ?? item.city, cityTried: true } : item)));
  }
}

/** « lyon-2eme-arrondissement » se range avec Lyon, et s'affiche « Lyon ». */
/** Le référentiel écrit parfois la ville à l'anglaise (« Marseilles ») : on la rend en français. */
const ALIAS: Record<string, string> = { marseilles: "marseille", lyons: "lyon" };

export function cityLabel(city: string | null): string {
  if (!city) return "Ailleurs";
  const base0 = city.toLowerCase().trim();
  const base = (ALIAS[base0] ?? base0).toLowerCase().replace(/-\d+(er|e|eme)?-arrondissement$/, "").replace(/\s+\d+(er|e)?\s+arrondissement$/, "");
  return base.split("-").map((part) => (part.length > 2 ? part[0]!.toUpperCase() + part.slice(1) : part)).join("-");
}

/**
 * Goûts observés — rien n'est demandé, tout est observé. Muet sous `VISITS_MINIMUM` passages :
 * un profil qui se trompe sur vous est pire qu'un profil vide.
 */
export const VISITS_MINIMUM = 4;

export interface Taste {
  total: number;
  shares: { theme: ThemeId; label: string; count: number; share: number }[];
}

export function readTaste(places: VisitedPlace[]): Taste {
  const counts = new Map<ThemeId, number>();
  let total = 0;
  for (const place of places) {
    const theme = themeForType(place.type);
    counts.set(theme, (counts.get(theme) ?? 0) + place.refs.length);
    total += place.refs.length;
  }
  const shares = [...counts.entries()]
    .map(([theme, count]) => ({
      theme,
      label: THEMES.find((item) => item.id === theme)?.label ?? theme,
      count,
      share: total > 0 ? count / total : 0,
    }))
    .sort((a, b) => b.count - a.count);
  return { total, shares };
}
