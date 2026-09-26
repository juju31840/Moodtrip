/**
 * Notoriété par la connaissance du modèle — la curation qui passe à l'échelle.
 *
 * La curation éditoriale (`curate-sources.mjs`, recherche web) coûte ~1 $ par envie et par ville :
 * couvrir les 125 villes de plus de 400 lieux dépasserait de loin le budget du produit. Ici, pas
 * de recherche : on donne au modèle la liste **réelle** des bars, restaurants et lieux de sortie
 * d'une ville, et il désigne ceux qu'il connaît précisément, avec un fait qui le prouve. Quelques
 * centimes par ville.
 *
 * Ce qui garde la méthode honnête :
 * - le modèle ne peut rien ajouter : il choisit des identifiants dans la liste (schéma imposé) ;
 * - consigne d'abstention : un lieu seulement familier ne doit pas être retenu ;
 * - sa justification n'est **jamais** stockée comme un fait : mesuré sur Lyon, elle contient des
 *   erreurs (« Joseph Viola, vainqueur du Bocuse d'Or », « Le Centre, brasserie parisienne »).
 *   Le partage du projet tient : les faits ne viennent jamais du modèle. On garde le signal —
 *   ce lieu est connu —, pas la phrase ;
 * - la méthode est **mesurée** contre la curation éditoriale de Lyon (`--mesurer`) avant d'écrire
 *   quoi que ce soit : combien des lieux cités par la presse le modèle retrouve-t-il, et que
 *   valent ceux qu'il ajoute.
 *
 *   node --env-file=.env.local scripts/curate-knowledge.mjs lyon --mesurer [--modele claude-haiku-4-5]
 *   node --env-file=.env.local scripts/curate-knowledge.mjs lyon --ecrire
 */
import Anthropic from "@anthropic-ai/sdk";
import { FILTRE_SQL, PAQUET, SCHEMA, consigne } from "./knowledge-prompt.mjs";
import { lit, sql } from "./lib-socle.mjs";

const arg = (nom, defaut) => {
  const i = process.argv.indexOf(nom);
  return i > 0 ? process.argv[i + 1] : defaut;
};
const ville = process.argv[2];
const MODELE = arg("--modele", "claude-sonnet-5");
const TARIFS = { "claude-haiku-4-5": [1, 5], "claude-sonnet-5": [2, 10], "claude-opus-5": [5, 25] };
if (!ville) {
  console.error("Usage : curate-knowledge.mjs <locality_norm> [--mesurer|--ecrire] [--modele …]");
  process.exit(1);
}

const lieux = await sql(`
  select fsq_id, name as nom, address as adresse, place_type
  from places
  where (locality_norm = ${lit(ville)} or locality_norm like ${lit(ville + "-%arrondissement%")})
    and ${FILTRE_SQL}
  order by fsq_id`);
console.log(`${ville} : ${lieux.length} lieux de sortie · ${MODELE}`);

const client = new Anthropic({ apiKey: process.env.VIBETRIP_CURATION_API_KEY ?? process.env.ANTHROPIC_API_KEY });
const usage = { entree: 0, sortie: 0 };
const retenus = [];

for (let debut = 0; debut < lieux.length; debut += PAQUET) {
  const paquet = lieux.slice(debut, debut + PAQUET);
  const reponse = await client.messages.create({
    model: MODELE,
    max_tokens: 8000,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: consigne(ville, paquet, debut) }],
  });
  usage.entree += reponse.usage.input_tokens;
  usage.sortie += reponse.usage.output_tokens;
  const texte = reponse.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  let connus = [];
  try {
    connus = JSON.parse(texte).connus ?? [];
  } catch {
    console.log(`  ⚠ paquet ${debut} illisible (${reponse.stop_reason})`);
  }
  for (const c of connus) {
    const index = Number(String(c.ref).replace(/^R/, ""));
    const lieu = lieux[index];
    // Une référence hors de la liste est ignorée : le modèle ne peut rien ajouter.
    if (lieu && index >= debut && index < debut + PAQUET) retenus.push({ ...lieu, raison: c.raison });
  }
}

const [pe, ps] = TARIFS[MODELE] ?? TARIFS["claude-opus-5"];
const cout = (usage.entree * pe + usage.sortie * ps) / 1e6;
console.log(`${retenus.length} lieux reconnus · ${usage.entree} jetons lus, ${usage.sortie} écrits ≈ ${cout.toFixed(3)} $`);

if (process.argv.includes("--mesurer")) {
  // Référence : les lieux de cette ville que la curation éditoriale (presse, guides) a retenus.
  const presse = await sql(`
    select distinct m.fsq_id, p.name as nom from mentions m join places p using (fsq_id)
    where m.source_url not like 'modele:%'
      and (p.locality_norm = ${lit(ville)} or p.locality_norm like ${lit(ville + "-%arrondissement%")})`);
  const ids = new Set(retenus.map((r) => r.fsq_id));
  const retrouves = presse.filter((p) => ids.has(p.fsq_id));
  console.log(`\nRappel face à la presse : ${retrouves.length}/${presse.length} lieux cités par les guides retrouvés`);
  console.log(`  manqués : ${presse.filter((p) => !ids.has(p.fsq_id)).map((p) => p.nom).join(", ")}`);
  console.log(`\nÉchantillon des lieux ajoutés (à juger) :`);
  for (const r of retenus.filter((r) => !presse.some((p) => p.fsq_id === r.fsq_id)).slice(0, 40)) {
    console.log(`  - ${r.nom} (${r.adresse ?? "?"}) — ${r.raison}`);
  }
}

if (process.argv.includes("--ecrire") && retenus.length > 0) {
  for (let i = 0; i < retenus.length; i += 300) {
    const valeurs = retenus
      .slice(i, i + 300)
      .map((r) => `(${lit(r.fsq_id)}, ${lit(`Connaissance du modèle (${MODELE})`)}, ${lit(`modele:${MODELE}`)}, null, ${lit(ville)})`)
      .join(",");
    await sql(`
      insert into mentions (fsq_id, source_nom, source_url, raison, ville_norm) values ${valeurs}
      on conflict (fsq_id, source_url) do update set raison = excluded.raison, trouve_le = current_date`);
  }
  await sql(`select recalculer_notoriete()`);
  console.log("Écrit en base, notoriété recalculée.");
}
