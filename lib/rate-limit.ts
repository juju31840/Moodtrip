import "server-only";
import { rpcServeur } from "./supabase-serveur";

/**
 * Quota de génération, par jour : par appareil, par adresse IP, et un plafond global.
 *
 * **Par jour et plafonné depuis le 12/11/2026 (plan C)** : l'application est gratuite tant qu'on
 * ne sait pas si les gens reviennent, et la perte doit être connue d'avance. Une recherche coûte
 * environ 2,5 centimes (mesuré le 11/11) ; 20 recherches par jour pour toute l'application, c'est
 * au pire 0,50 $ par jour. L'ancien quota (5 par heure et par appareil, 20 par heure et par IP)
 * laissait une seule adresse faire 480 recherches par jour.
 *
 * **Persisté en base depuis le 27/08/2026, et ce n'est pas un raffinement.** Le compteur vivait
 * en mémoire du processus : en serverless, chaque instance froide repart avec un compteur neuf,
 * ce qui revient à n'avoir aucune limite dès lors que l'application est publique. Tant qu'elle
 * tournait sur un poste de développement, la faiblesse restait théorique ; exposée sur Internet
 * avec une clé API derrière, elle offrait le crédit au premier venu.
 *
 * Le décompte se fait en un seul aller-retour (`consommer_quota`, `security definer`) : lire puis
 * écrire laisserait une fenêtre où deux appels simultanés passent tous les deux.
 *
 * Repli volontaire : si la base ne répond pas, on **autorise**. Un socle indisponible ne doit pas
 * empêcher quelqu'un de générer son itinéraire — le quota protège une dépense, il n'est pas une
 * fonction de sécurité.
 */

interface Bucket {
  tokens: number;
  lastRefillAt: number;
}

/** Recherches par appareil et par jour. Surchargeable pour tester en local. */
export const QUOTA_APPAREIL = Number(process.env.VIBETRIP_QUOTA_JOUR ?? 3);
/**
 * Plafond par adresse IP, quel que soit le nombre d'appareils derrière. Quatre fois le quota
 * d'un appareil : assez pour un foyer ou un groupe d'amis, pas assez pour vider le crédit en
 * renouvelant son identifiant d'appareil à chaque appel.
 */
export const QUOTA_ADRESSE = QUOTA_APPAREIL * 4;
/** Recherches par jour pour toute l'application : la dépense maximale. */
export const PLAFOND_GLOBAL = Number(process.env.VIBETRIP_PLAFOND_GLOBAL ?? 20);

const FENETRE_MS = 24 * 60 * 60 * 1000;

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export async function checkRateLimit(key: string, max = QUOTA_APPAREIL): Promise<RateLimitResult> {
  try {
    const response = await rpcServeur("consommer_quota_jour", { p_cle: key, p_max: max });
    if (response?.ok) {
      const [ligne] = (await response.json()) as { autorise: boolean; restant: number }[];
      if (ligne) return { allowed: ligne.autorise, remaining: ligne.restant };
    }
    // Le repli mémoire ne limite rien en serverless : il doit se voir dans les journaux Vercel
    // (refus de droits après l'étape 3 sans SUPABASE_SECRET_KEY, base injoignable…).
    if (response) console.error(`quota : consommer_quota a répondu ${response.status}, repli mémoire`);
  } catch {
    console.error("quota : base injoignable, repli mémoire");
  }
  return checkInMemory(key, max);
}

/** Repli hors ligne, et seul mode disponible en développement sans identifiants Supabase. */
function checkInMemory(key: string, max: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing) {
    buckets.set(key, { tokens: max - 1, lastRefillAt: now });
    return { allowed: true, remaining: max - 1 };
  }

  const elapsed = now - existing.lastRefillAt;
  if (elapsed >= FENETRE_MS) {
    existing.tokens = max;
    existing.lastRefillAt = now;
  }

  if (existing.tokens <= 0) {
    return { allowed: false, remaining: 0 };
  }

  existing.tokens -= 1;
  return { allowed: true, remaining: existing.tokens };
}
