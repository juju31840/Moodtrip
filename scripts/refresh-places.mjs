/**
 * Recharge le socle depuis le catalogue Foursquare — la version mensuelle, plus fraîche que le
 * miroir public figé à février 2025.
 *
 * **État : bloqué côté compte, pas côté code.** Le catalogue répond et le jeton est accepté, mais
 * ses trois espaces de noms (`datasets`, `attribute_packs`, `plugins`) sont **vides** : le jeu
 * OS Places n'est pas rattaché au compte. Il faut l'ajouter depuis le Places Portal ; aucune
 * ligne de ce script n'y changera quoi que ce soit.
 *
 * L'endpoint a coûté un détour : `data.foursquare.com/iceberg`, deviné, n'existe pas. Le bon est
 * `catalog.h3-hub.foursquare.com/iceberg`, avec le préfixe `places` imposé par la configuration
 * du catalogue (`GET /v1/config?warehouse=places` renvoie `overrides.prefix`). Il ne se trouve
 * que dans le portail, jamais dans la documentation publique.
 *
 * **Le jeton expire au bout d'un mois** — c'est le maximum qu'accorde le portail. Le
 * rechargement ne peut donc pas être entièrement automatique : il demande d'en régénérer un à
 * chaque fois. Une routine qui le supposerait permanent échouerait silencieusement au bout de
 * trente jours.
 *
 *   node scripts/refresh-places.mjs --explorer   (liste ce que le catalogue expose)
 */
import { reglage } from "./lib-socle.mjs";

const ENDPOINT = "https://catalog.h3-hub.foursquare.com/iceberg";

async function api(chemin, tok) {
  const r = await fetch(`${ENDPOINT}/v1/${chemin}`, {
    headers: { Authorization: `Bearer ${tok}` },
  });
  return r.ok ? r.json() : { erreur: `HTTP ${r.status}` };
}

const tok = reglage("FOURSQUARE_TOKEN");
if (!tok) {
  console.error("FOURSQUARE_TOKEN absent du trousseau (service moodtrip).");
  process.exit(1);
}

// Le jeton est un JWT : sa date d'expiration se lit sans appeler personne.
const charge = JSON.parse(Buffer.from(tok.split(".")[1], "base64url").toString());
const expire = new Date(charge.exp * 1000);
const jours = Math.round((expire - Date.now()) / 86400000);
console.log(`Jeton valable jusqu'au ${expire.toLocaleDateString("fr-FR")} (${jours} jours)`);
if (jours <= 0) {
  console.error("Jeton expiré — en régénérer un sur places.foursquare.com.");
  process.exit(1);
}

const prefixe = (await api("config?warehouse=places", tok))?.overrides?.prefix ?? "places";
const { namespaces = [] } = await api(`${prefixe}/namespaces`, tok);

let total = 0;
for (const ns of namespaces) {
  const nom = ns.join(".");
  const { identifiers = [] } = await api(`${prefixe}/namespaces/${nom}/tables`, tok);
  total += identifiers.length;
  console.log(`  ${nom} : ${identifiers.length ? identifiers.map((t) => t.name).join(", ") : "(vide)"}`);
}

if (total === 0) {
  console.log(
    "\nAucune table exposée. Le jeu OS Places n'est pas rattaché à ce compte : l'ajouter depuis\n" +
    "le Places Portal (places.foursquare.com), section des jeux de données. Le socle actuel reste\n" +
    "utilisable — il vient du miroir public, dont la dernière version est celle de février 2025."
  );
}
