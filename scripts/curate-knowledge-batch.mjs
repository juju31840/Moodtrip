/**
 * Curation par connaissance du modèle, pour **toutes** les villes de plus de 400 lieux, via l'API
 * Batch (moitié prix, résultat en moins d'une heure en général). Même consigne que
 * `curate-knowledge.mjs`, dont la mesure a guidé les choix (26/09/2026) :
 * - Haiku et non Sonnet : sur Tours, ils désignent les mêmes adresses pour un tiers du prix, et
 *   comme on ne stocke que le signal — jamais la phrase —, la qualité de rédaction ne compte pas ;
 * - ~105 000 lieux de sortie dans 125 villes ≈ 1,35 $ en Batch.
 *
 * Deux temps, parce qu'un lot se traite en différé :
 *   node --env-file=.env.local scripts/curate-knowledge-batch.mjs soumettre [--min 400] [--max 1e9]
 *   node --env-file=.env.local scripts/curate-knowledge-batch.mjs relever
 *
 * La correspondance « paquet → identifiants de lieux » est gardée dans un fichier dès l'envoi :
 * si la session s'interrompt entre les deux temps, rien de ce qui a été payé n'est perdu.
 */
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { FILTRE_SQL, PAQUET, SCHEMA, consigne } from "./knowledge-prompt.mjs";
import { lit, sql } from "./lib-socle.mjs";

const MODELE = "claude-haiku-4-5";
const ETAT = "scripts/.knowledge-batch.json";
const client = new Anthropic({ apiKey: process.env.VIBETRIP_CURATION_API_KEY ?? process.env.ANTHROPIC_API_KEY });
const action = process.argv[2];

if (action === "soumettre") {
  if (existsSync(ETAT)) {
    console.error(`Un lot est déjà en cours (${ETAT}) : le relever avant d'en soumettre un autre.`);
    process.exit(1);
  }
  const iMin = process.argv.indexOf("--min");
  const minimum = iMin > 0 ? Number(process.argv[iMin + 1]) : 400;
  // `--max` pour étendre à une tranche de villes sans resoumettre celles déjà traitées.
  const iMax = process.argv.indexOf("--max");
  const maximum = iMax > 0 ? Number(process.argv[iMax + 1]) : 1e9;
  const lieux = await sql(`
    select p.fsq_id, p.name as nom, p.address as adresse, p.place_type, p.locality_norm as ville
    from (select * from places where ${FILTRE_SQL}) p
    join communes c on c.nom = p.locality_norm
    where c.nb_lieux >= ${minimum} and c.nb_lieux < ${maximum}
    order by p.locality_norm, p.fsq_id`);

  const parVille = new Map();
  for (const lieu of lieux) parVille.set(lieu.ville, [...(parVille.get(lieu.ville) ?? []), lieu]);

  const requests = [];
  const paquets = {};
  for (const [ville, liste] of parVille) {
    for (let debut = 0; debut < liste.length; debut += PAQUET) {
      const paquet = liste.slice(debut, debut + PAQUET);
      // Identifiant court et sûr : [a-zA-Z0-9_-]{1,64}.
      const id = `k${requests.length}`;
      paquets[id] = { ville, debut, fsq: paquet.map((l) => l.fsq_id) };
      requests.push({
        custom_id: id,
        params: {
          model: MODELE,
          max_tokens: 8000,
          output_config: { format: { type: "json_schema", schema: SCHEMA } },
          messages: [{ role: "user", content: consigne(ville, paquet, debut) }],
        },
      });
    }
  }

  const lot = await client.messages.batches.create({ requests });
  writeFileSync(ETAT, JSON.stringify({ lot: lot.id, modele: MODELE, soumis: new Date().toISOString(), paquets }));
  console.log(`${parVille.size} villes · ${lieux.length} lieux · ${requests.length} requêtes → lot ${lot.id}`);
  process.exit(0);
}

if (action === "relever") {
  const etat = JSON.parse(readFileSync(ETAT, "utf8"));
  const lot = await client.messages.batches.retrieve(etat.lot);
  console.log(`Lot ${etat.lot} : ${lot.processing_status}`, lot.request_counts);
  if (lot.processing_status !== "ended") process.exit(0);

  const retenus = [];
  const usage = { entree: 0, sortie: 0 };
  let echecs = 0;
  for await (const resultat of await client.messages.batches.results(etat.lot)) {
    const paquet = etat.paquets[resultat.custom_id];
    if (resultat.result.type !== "succeeded" || !paquet) {
      echecs += 1;
      continue;
    }
    const message = resultat.result.message;
    usage.entree += message.usage.input_tokens;
    usage.sortie += message.usage.output_tokens;
    const texte = message.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    let connus = [];
    try {
      connus = JSON.parse(texte).connus ?? [];
    } catch {
      echecs += 1;
    }
    for (const c of connus) {
      const index = Number(String(c.ref).replace(/^R/, "")) - paquet.debut;
      // Une référence hors du paquet est ignorée : le modèle ne peut rien ajouter.
      const fsq = paquet.fsq[index];
      // Un lieu cité deux fois ferait échouer l'insertion (« affect row a second time »).
      if (fsq && !retenus.some((r) => r.fsq === fsq)) retenus.push({ fsq, ville: paquet.ville });
    }
  }

  // Tarif Batch : moitié du tarif standard de Haiku (1 $ / 5 $ par million).
  const cout = (usage.entree * 0.5 + usage.sortie * 2.5) / 1e6;
  console.log(`${retenus.length} lieux reconnus · ${echecs} paquets en échec · ≈ ${cout.toFixed(2)} $`);

  for (let i = 0; i < retenus.length; i += 400) {
    const valeurs = retenus
      .slice(i, i + 400)
      .map((r) => `(${lit(r.fsq)}, ${lit(`Connaissance du modèle (${etat.modele})`)}, ${lit(`modele:${etat.modele}`)}, null, ${lit(r.ville)})`)
      .join(",");
    await sql(`
      insert into mentions (fsq_id, source_nom, source_url, raison, ville_norm) values ${valeurs}
      on conflict (fsq_id, source_url) do update set trouve_le = current_date`);
  }
  await sql(`select recalculer_notoriete()`);
  writeFileSync(ETAT.replace(".json", `.releve-${Date.now()}.json`), JSON.stringify({ ...etat, retenus: retenus.length, cout }));
  unlinkSync(ETAT);
  console.log("Écrit en base, notoriété recalculée.");
  process.exit(0);
}

console.error("Usage : curate-knowledge-batch.mjs soumettre|relever");
process.exit(1);
