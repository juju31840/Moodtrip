/**
 * Accès au socle depuis les scripts de maintenance — hors de Next, par l'API de gestion Supabase.
 *
 * Mis en commun parce que la curation (Wikidata, sources éditoriales) et la vérification Google
 * font la même chose : lire des lieux, écrire un verdict. Le `User-Agent` explicite n'est pas
 * décoratif — sans lui l'API répond 403, et le symptôme fait chercher ailleurs (voir CLAUDE.md).
 */
import { readFileSync } from "node:fs";

function reglages() {
  try {
    return JSON.parse(readFileSync(".claude/settings.local.json", "utf8")).env ?? {};
  } catch {
    return {};
  }
}

export function reglage(nom) {
  return process.env[nom] ?? reglages()[nom] ?? null;
}

export async function sql(requete) {
  const ref = reglage("SUPABASE_PROJECT_REF");
  const jeton = reglage("SUPABASE_ACCESS_TOKEN");
  if (!ref || !jeton) throw new Error("Identifiants Supabase absents.");
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jeton}`,
      "Content-Type": "application/json",
      "User-Agent": "vibetrip-scripts",
    },
    body: JSON.stringify({ query: requete }),
  });
  if (!res.ok) throw new Error(`SQL ${res.status} : ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/** Littéral SQL sûr pour une chaîne — les scripts n'ont pas de requêtes paramétrées. */
export function lit(valeur) {
  if (valeur === null || valeur === undefined) return "null";
  return `'${String(valeur).replace(/'/g, "''")}'`;
}

export function distanceM(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** Tous les lieux proposables dans un rayon — ceux-là seuls valent la peine d'être rapprochés. */
export async function lieuxAutour({ lat, lng }, rayonKm) {
  return sql(`
    select fsq_id, name as nom, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng,
           place_type, themes, notoriete, wd_id
    from places
    where ST_DWithin(location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${rayonKm * 1000})
      and google_status is distinct from 'closed'
      and not coord_douteuse and not est_chaine and not nom_douteux
      and cardinality(themes) > 0`);
}

/** Les villes pilotes. Le centre sert au rayon de rapprochement, pas au calcul de la commune. */
export const VILLES = {
  lyon: { nom: "Lyon", lat: 45.764, lng: 4.8357, rayonKm: 8 },
  paris: { nom: "Paris", lat: 48.8566, lng: 2.3522, rayonKm: 10 },
  bordeaux: { nom: "Bordeaux", lat: 44.8378, lng: -0.5792, rayonKm: 7 },
  marseille: { nom: "Marseille", lat: 43.2965, lng: 5.3698, rayonKm: 10 },
  toulouse: { nom: "Toulouse", lat: 43.6047, lng: 1.4442, rayonKm: 7 },
  lille: { nom: "Lille", lat: 50.6292, lng: 3.0573, rayonKm: 7 },
  nantes: { nom: "Nantes", lat: 47.2184, lng: -1.5536, rayonKm: 7 },
  tours: { nom: "Tours", lat: 47.3941, lng: 0.6848, rayonKm: 6 },
};
