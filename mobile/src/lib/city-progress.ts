import { flat } from "@/lib/city-search";
import type { VisitedPlace } from "@/lib/visits";

/**
 * La progression dans une ville : combien de ses adresses reconnues on a faites (« Lyon : 8 sur
 * 198 »). On voit ce qu'il reste à découvrir, et c'est ce qui donne envie de revenir — la curation
 * des 1 090 villes sert ici aussi. Lecture seule, clé publique, gardée en mémoire le temps de la
 * session.
 */
const URL_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const cache = new Map<string, string[]>();

/** « Lyon », « lyon-2eme-arrondissement », « Marseilles » → la forme `locality_norm` du socle. */
function localityKey(city: string): string {
  const base = flat(city).replace(/\s+/g, "-").replace(/-\d+(er|e|eme)?-arrondissement$/, "");
  return base === "marseilles" ? "marseille" : base === "lyons" ? "lyon" : base;
}

async function recognizedNames(city: string): Promise<string[] | null> {
  const key = localityKey(city);
  if (cache.has(key)) return cache.get(key)!;
  if (!URL_BASE || !KEY) return null;
  try {
    // Une fonction côté base plutôt qu'une requête paginée : celle-ci dépassait le délai accordé à
    // la clé publique, et plafonnait à 1 000 lignes quand Paris compte 1 230 adresses reconnues.
    const response = await fetch(`${URL_BASE}/rest/v1/rpc/adresses_reconnues`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_ville: key }),
    });
    if (!response.ok) return null;
    const names = ((await response.json()) as string[]).map((name) => flat(name));
    cache.set(key, names);
    return names;
  } catch {
    return null;
  }
}

export async function cityProgress(city: string, places: VisitedPlace[]): Promise<{ done: number; total: number } | null> {
  const names = await recognizedNames(city);
  if (!names || names.length === 0) return null;
  const known = new Set(names);
  const done = places.filter((place) => place.recognized || known.has(flat(place.name))).length;
  return { done: Math.min(done, names.length), total: names.length };
}
