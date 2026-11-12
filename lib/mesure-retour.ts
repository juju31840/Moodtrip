import "server-only";
import { rpcServeur } from "./supabase-serveur";

/**
 * Lit l'en-tête `x-vibetrip-anciennete` (« nouveau » ou un nombre de jours) envoyé par l'appareil.
 * Il vient du client, donc d'un inconnu : tout ce qui n'est pas l'un des deux est ignoré.
 */
export function lireAnciennete(valeur: string | null): { anciennete: number; premiere: boolean } | null {
  if (valeur === "nouveau") return { anciennete: 0, premiere: true };
  if (!valeur || !/^\d{1,4}$/.test(valeur)) return null;
  return { anciennete: Math.min(Number(valeur), 3650), premiere: false };
}

/**
 * Note une recherche pour la mesure du retour (`scripts/sql/2026-11-12-mesure-retour.sql`).
 * Jamais bloquant : une mesure manquée ne doit rien coûter à l'utilisateur.
 */
export async function noterRecherche(entete: string | null): Promise<void> {
  const lue = lireAnciennete(entete);
  if (!lue) return;
  try {
    const reponse = await rpcServeur(
      "noter_recherche",
      { p_anciennete: lue.anciennete, p_premiere: lue.premiere },
      { secrete: true }
    );
    if (reponse && !reponse.ok) console.error(`mesure du retour : noter_recherche a répondu ${reponse.status}`);
  } catch {
    console.error("mesure du retour : base injoignable");
  }
}
