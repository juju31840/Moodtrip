import type { ItineraryStep, ThemeId } from "@/types/itinerary";

/**
 * Remplaçants d'une étape — la même requête que `lib/nearby-places.ts` du site, adressée au socle
 * avec la clé publique (lecture seule depuis le 06/09/2026). Aucun appel au modèle : une réponse
 * en quelques centaines de millisecondes, des lieux réels, les reconnus en tête.
 */
const URL_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** En kilomètres — l'API refuse des mètres (400, et le panneau paraissait vide sans raison). */
const RADIUS_KM = 2;

interface Row {
  fsq_id: string;
  nom: string;
  lat: number;
  lng: number;
  adresse: string | null;
  type_lieu: string;
  distance_m: number;
  notoriete: number | null;
  raison: string | null;
  commune: string | null;
}

const flat = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export async function findNearby(theme: ThemeId, origin: ItineraryStep, excludeNames: string[], limit = 8): Promise<ItineraryStep[]> {
  if (!URL_BASE || !KEY) return [];
  let rows: Row[];
  try {
    const response = await fetch(`${URL_BASE}/rest/v1/rpc/lieux_par_theme`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_lat: origin.location.lat, p_lng: origin.location.lng, p_theme: theme, p_rayon_km: RADIUS_KM, p_limite: limit * 3 }),
    });
    if (!response.ok) return [];
    rows = (await response.json()) as Row[];
  } catch {
    return [];
  }

  const excluded = new Set(excludeNames.map(flat));
  const seen = new Set<string>();
  const results: ItineraryStep[] = [];
  for (const row of rows) {
    const key = flat(row.nom);
    if (excluded.has(key) || seen.has(key)) continue;
    seen.add(key);
    const distance = row.distance_m < 1000 ? `à ${row.distance_m} m` : `à ${(row.distance_m / 1000).toFixed(1).replace(".", ",")} km`;
    results.push({
      id: `nearby-${row.fsq_id}`,
      day: origin.day,
      period: origin.period,
      placeName: row.nom,
      // Un lieu reconnu dit pourquoi ; les autres, seulement où ils sont — rien d'inventé.
      description: row.raison ?? (row.adresse ? `${row.adresse} — ${distance}` : `${distance} de l'étape remplacée`),
      location: { lat: row.lat, lng: row.lng },
      type: row.type_lieu as ItineraryStep["type"],
      verified: true,
      anchored: true,
      address: row.adresse,
      recognized: (row.notoriete ?? 0) > 0,
      city: row.commune,
    });
    if (results.length >= limit) break;
  }
  return results;
}
