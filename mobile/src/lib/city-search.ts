import photos from "@/data/city-photos.json";
import { rememberCenter } from "@/lib/geocode";
import { DEFAULT_CITIES } from "@/lib/profile";

/**
 * Suggestions de villes pendant la saisie (demande du 26/09/2026 : une liste qui s'affine à
 * chaque lettre, plutôt que des pastilles de noms sous le champ).
 *
 * Deux sources, dans cet ordre :
 * 1. **les villes déjà connues de l'application** — celles du profil, les dernières utilisées,
 *    les cent plus grandes — filtrées sur place, sans réseau : la première lettre répond aussitôt ;
 * 2. **la recherche de communes de Mapbox**, qui couvre toute la France et donne le département —
 *    ce qui distingue les homonymes (Saint-Denis de Seine-Saint-Denis et de La Réunion).
 */
export interface CitySuggestion {
  name: string;
  /** « Rhône, Auvergne-Rhône-Alpes » — absent pour les villes connues localement. */
  context?: string;
}

const KNOWN = [...new Set([...DEFAULT_CITIES, ...Object.values(photos as Record<string, { ville: string }>).map((city) => city.ville)])];

/** Minuscules sans accents ni tirets : « st etienne » trouve Saint-Étienne, « beziers » Béziers. */
export const flat = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[-']/g, " ").replace(/^st /, "saint ").replace(/\s+/g, " ").trim();

export function localSuggestions(query: string, preferred: string[], limit = 6): CitySuggestion[] {
  const q = flat(query);
  const pool = [...new Set([...preferred, ...KNOWN])];
  if (!q) return pool.slice(0, limit).map((name) => ({ name }));
  // Le début du nom d'abord (« Ly » → Lyon), puis le début d'un mot (« Etienne » → Saint-Étienne).
  const starts = pool.filter((name) => flat(name).startsWith(q));
  const words = pool.filter((name) => !starts.includes(name) && flat(name).split(" ").some((word) => word.startsWith(q)));
  return [...starts, ...words].slice(0, limit).map((name) => ({ name }));
}

export async function remoteSuggestions(query: string, signal: AbortSignal): Promise<CitySuggestion[]> {
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  if (!token || query.trim().length < 2) return [];
  const url =
    "https://api.mapbox.com/search/geocode/v6/forward?types=place&country=fr&autocomplete=true&language=fr&limit=6" +
    `&q=${encodeURIComponent(query.trim())}&access_token=${token}`;
  const response = await fetch(url, { signal });
  if (!response.ok) return [];
  const data = (await response.json()) as {
    features?: { geometry?: { coordinates?: [number, number] }; properties?: { name?: string; place_formatted?: string } }[];
  };
  return (data.features ?? [])
    .map((feature): CitySuggestion | null => {
      const name = feature.properties?.name;
      const coordinates = feature.geometry?.coordinates;
      // La ville choisie a déjà ses coordonnées : la carte d'attente s'ouvrira dessus sans attendre.
      if (name && coordinates) rememberCenter(name, { lat: coordinates[1], lng: coordinates[0] });
      if (!name) return null;
      const context = feature.properties?.place_formatted?.replace(/, France$/, "");
      return context ? { name, context } : { name };
    })
    .filter((suggestion): suggestion is CitySuggestion => suggestion !== null);
}
