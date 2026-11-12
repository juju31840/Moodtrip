import "server-only";
import { rpcServeur } from "./supabase-serveur";

/**
 * Quota de génération, par jour : par appareil, par adresse IP, et un plafond global.
 *
 * **Par jour et plafonné depuis le 12/11/2026 (plan C)** : l'application est gratuite tant qu'on
 * ne sait pas si les gens reviennent, et la perte doit être connue d'avance. Une recherche coûte
 * environ 2,5 centimes (mesuré le 11/11) ; 30 recherches par jour pour toute l'application (20 jusqu'à l'audit
 * du 12/11), c'est au pire 0,75 $ par jour. L'ancien quota (5 par heure et par appareil, 20 par heure et par IP)
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
 * Plafond par adresse IP, quel que soit le nombre d'appareils derrière : deux appareils, un
 * couple ou une colocation. Il était de quatre fois le quota, et l'audit du 12/11/2026 a montré
 * que deux connexions (wifi puis 4G) vidaient alors le plafond global pour tout le monde ; à deux
 * fois, il en faut cinq.
 */
export const QUOTA_ADRESSE = QUOTA_APPAREIL * 2;
/** Recherches par jour pour toute l'application : la dépense maximale (~0,75 $ au pire). */
export const PLAFOND_GLOBAL = Number(process.env.VIBETRIP_PLAFOND_GLOBAL ?? 30);

const FENETRE_MS = 24 * 60 * 60 * 1000;

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * `fermeSansBase` : refuser quand la base ne répond pas, au lieu de retomber sur la mémoire. Pour
 * le plafond global seulement, et seulement sur Vercel : c'est lui qui borne la dépense, et le repli
 * mémoire ne limite rien en serverless. L'indisponibilité ne coûte presque rien de plus, puisque
 * les lieux viennent de la même base. En développement local, sans clé secrète, le repli reste.
 */
export async function checkRateLimit(
  key: string,
  max = QUOTA_APPAREIL,
  { fermeSansBase = false }: { fermeSansBase?: boolean } = {}
): Promise<RateLimitResult> {
  const fermer = fermeSansBase && process.env.VERCEL === "1";
  try {
    const response = await rpcServeur("consommer_quota_jour", { p_cle: key, p_max: max });
    if (response?.ok) {
      const [ligne] = (await response.json()) as { autorise: boolean; restant: number }[];
      if (ligne) return { allowed: ligne.autorise, remaining: ligne.restant };
    }
    // Le repli mémoire ne limite rien en serverless : il doit se voir dans les journaux Vercel
    // (refus de droits après l'étape 3 sans SUPABASE_SECRET_KEY, base injoignable…).
    if (response) console.error(`quota : consommer_quota_jour a répondu ${response.status}, ${fermer ? "refus" : "repli mémoire"}`);
  } catch {
    console.error(`quota : base injoignable, ${fermer ? "refus" : "repli mémoire"}`);
  }
  return fermer ? { allowed: false, remaining: 0 } : checkInMemory(key, max);
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
