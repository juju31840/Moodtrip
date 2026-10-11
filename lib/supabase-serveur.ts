import "server-only";

/**
 * Appels Supabase faits par le serveur, avec la clé secrète (rôle `service_role`) quand elle est
 * posée.
 *
 * Depuis l'audit du 11/10/2026, le quota, le comptage des propositions et les fonctions du cron ne
 * sont plus ouverts à la clé publique (`scripts/sql/2026-10-11-securite-etape3.sql`) : la clé
 * publiable était dans le navigateur de tout le monde, et `consommer_quota` acceptait le plafond
 * fourni par l'appelant. Tant que `SUPABASE_SECRET_KEY` n'est pas posée, les appels qui le peuvent
 * retombent sur la clé publiable ; ceux qui exigent la clé secrète (`secrete: true`) renvoient null.
 *
 * La clé secrète contourne la RLS : jamais derrière `NEXT_PUBLIC_`, jamais importée côté client,
 * d'où `server-only`. Les variables sont lues à l'appel, pas au chargement du module.
 */
export function rpcServeur(
  fonction: string,
  corps: unknown,
  { secrete = false }: { secrete?: boolean } = {}
): Promise<Response> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cleSecrete = process.env.SUPABASE_SECRET_KEY;
  const cle = secrete ? cleSecrete : cleSecrete ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !cle) return null;
  return fetch(`${url}/rest/v1/rpc/${fonction}`, {
    method: "POST",
    headers: { apikey: cle, Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
}
