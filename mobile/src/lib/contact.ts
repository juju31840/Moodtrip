/**
 * Téléphone et site d'un lieu, lus dans le socle à la demande (84 % des lieux reconnus ont un
 * téléphone, 67 % un site). C'est le geste qui manquait entre « ça me tente » et « j'y vais » :
 * réserver une table. Lecture seule, clé publique.
 */
const URL_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const cache = new Map<string, Contact | null>();

export interface Contact {
  tel: string | null;
  website: string | null;
}

export async function contactFor(placeId: string): Promise<Contact | null> {
  if (cache.has(placeId)) return cache.get(placeId)!;
  if (!URL_BASE || !KEY) return null;
  try {
    const response = await fetch(`${URL_BASE}/rest/v1/places?select=tel,website&fsq_id=eq.${encodeURIComponent(placeId)}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
    if (!response.ok) return null;
    const rows = (await response.json()) as Contact[];
    const contact = rows[0] && (rows[0].tel || rows[0].website) ? rows[0] : null;
    cache.set(placeId, contact);
    return contact;
  } catch {
    return null;
  }
}
