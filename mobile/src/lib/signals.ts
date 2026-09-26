import type { GeoPoint } from "@/types/itinerary";

/**
 * Les signaux envoyés au socle, comme `lib/closed-places.ts` du site — avec la clé publique,
 * sans rien d'individuel : la base additionne un compteur et une somme de notes, pas des avis
 * signés. Aucun n'est attendu par l'écran : cocher doit rester instantané, et l'échec d'une
 * statistique ne regarde pas l'utilisateur.
 */
const URL_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

async function rpc<T>(name: string, body: unknown): Promise<T | null> {
  if (!URL_BASE || !KEY) return null;
  try {
    const response = await fetch(`${URL_BASE}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    const text = await response.text();
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
}

type Located = { placeName: string; location: GeoPoint };

/** Le signal maison : « quelqu'un y est allé grâce à l'application ». Il fait remonter les lieux. */
export function noteVisit(step: Located) {
  void rpc("noter_visite", { p_nom: step.placeName, p_lat: step.location.lat, p_lng: step.location.lng });
}

/** Une note de 1 à 5 — l'actif que ni Google ni TripAdvisor ne possèdent. */
export function rateStep(step: Located, note: number) {
  void rpc("noter_lieu", { p_nom: step.placeName, p_lat: step.location.lat, p_lng: step.location.lng, p_note: note });
}

/**
 * Les étapes dont le lieu a fermé depuis l'enregistrement. Une liste vide veut dire « rien à
 * signaler » — y compris si la question n'a pas pu être posée : en cas de doute, on se tait
 * plutôt que d'inquiéter à tort.
 */
export async function findClosed(steps: Located[]): Promise<Set<string>> {
  const rows = await rpc<{ nom: string; statut: string }[]>("statut_etapes", {
    p_etapes: steps.map((step) => ({ nom: step.placeName, lat: step.location.lat, lng: step.location.lng })),
  });
  return new Set((rows ?? []).filter((row) => row.statut === "closed").map((row) => row.nom));
}
