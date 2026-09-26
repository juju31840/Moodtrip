/**
 * Curation éditoriale : quels lieux de la ville sont recommandés par des sources reconnues, et
 * pourquoi. C'est le signal de notoriété des bars, cafés et restaurants, que Wikidata ne donne
 * pas — la réponse au « pourquoi ce café plutôt qu'un autre » des testeurs (24/09/2026).
 *
 * Partage faits / jugement, inchangé : l'agent ne crée **aucun lieu**. Il rapporte ce que des
 * guides et la presse citent ; chaque citation n'est retenue que si elle se rapproche d'un lieu
 * qui existe déjà dans le socle. Une adresse que le socle ne connaît pas est abandonnée, jamais
 * ajoutée — un lieu inventé écrit en base aurait l'autorité d'une donnée stockée.
 *
 * Ce qu'on stocke : le nom de la source, son lien, et une raison courte **reformulée** par
 * l'agent. Jamais le texte des articles.
 *
 *   node --env-file=.env.local scripts/curate-sources.mjs lyon [--sec] [--themes eat,drink]
 */
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { namesMatch } from "../lib/place-match.ts";
import { VILLES, distanceM, lit, sql } from "./lib-socle.mjs";

// Opus par défaut. Sonnet avait été choisi le 24/09/2026 pour son tarif (2 $ / 10 $ contre 5 $ /
// 25 $), et la mesure l'a démenti : sur la même tâche, Sonnet lit cinq fois plus de pages
// (722 000 à 795 000 jetons par envie contre ~146 000) et revient à ~1,90 $ l'envie, contre ~1 $.
// Le prix au jeton ne dit pas le coût d'une tâche.
const MODELE = process.env.VIBETRIP_CURATION_MODEL ?? "claude-opus-5";
const TARIFS = { "claude-sonnet-5": [2, 10], "claude-opus-5": [5, 25] };
/**
 * Plafond de dépense du passage, en dollars. Le crédit est partagé avec la production : le
 * 24/09/2026 une curation l'a vidé et coupé l'application. Le script s'arrête avant d'y toucher.
 */
const BUDGET = Number(process.env.VIBETRIP_CURATION_BUDGET ?? 5);

const ENVIES = {
  eat: "restaurants et bouchons (toutes gammes de prix, y compris des adresses abordables)",
  drink: "bars, bars à vin, bars à cocktails et cafés",
  night: "sorties de nuit : clubs, salles de concert, bars dansants",
  culture: "musées, lieux d'exposition, théâtres et lieux culturels",
  outdoor: "parcs, jardins, points de vue et balades en plein air",
  shopping: "boutiques et marchés qui valent le détour",
};

const cle = process.argv[2];
const ville = VILLES[cle];
if (!ville) {
  console.error(`Ville inconnue. Choix : ${Object.keys(VILLES).join(", ")}`);
  process.exit(1);
}
const sec = process.argv.includes("--sec");
/** Rejoue le rapprochement sur le dernier journal, sans rappeler le modèle ni payer de recherche. */
const rejouer = process.argv.includes("--rejouer");
const iThemes = process.argv.indexOf("--themes");
// Par défaut les trois envies que Wikidata ne couvre pas : la culture et le plein air y ont déjà
// leur notoriété, gratuitement.
const themes = iThemes > 0 ? process.argv[iThemes + 1].split(",") : ["eat", "drink", "night"];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["lieux"],
  properties: {
    lieux: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["nom", "adresse", "source_nom", "source_url", "raison"],
        properties: {
          nom: { type: "string" },
          adresse: { type: "string" },
          source_nom: { type: "string" },
          source_url: { type: "string" },
          raison: { type: "string" },
        },
      },
    },
  },
};

function consigne(theme) {
  const annee = new Date().getFullYear();
  return [
    `Trouve les adresses de ${ville.nom} (France) recommandées pour : ${ENVIES[theme]}.`,
    `Appuie-toi uniquement sur des sources éditoriales reconnues et récentes (${annee - 2}-${annee}) : guides, presse nationale ou locale, médias spécialisés. Pas d'annuaires, pas d'avis d'utilisateurs, pas de sites des établissements eux-mêmes.`,
    "Ne rapporte QUE des lieux explicitement cités dans une page que tu as lue. N'ajoute rien de ta propre connaissance : un lieu qui n'est cité nulle part ne doit pas apparaître.",
    "Écarte les lieux que les sources disent fermés.",
    "Pour chaque lieu : son nom exact ; son adresse (rue et numéro si la source les donne, sinon le quartier) ; le nom de la source et l'URL de la page ; une raison de moins de quinze mots, écrite avec tes mots, qui dit un fait précis (spécialité, particularité) — jamais une citation, jamais un adjectif creux comme convivial, chaleureux ou incontournable.",
    "Vise 25 à 35 lieux distincts, en croisant plusieurs sources : un seul article ne suffit pas.",
  ].join("\n");
}

// Clé distincte de celle de l'application si elle existe : le 24/09/2026, la curation a épuisé le
// crédit partagé et coupé la génération en production. Une dépense de maintenance ne doit jamais
// pouvoir couper le service — la bonne configuration est un espace de travail séparé, plafonné.
const client = new Anthropic({
  apiKey: process.env.VIBETRIP_CURATION_API_KEY ?? process.env.ANTHROPIC_API_KEY,
});

async function chercher(theme) {
  const messages = [{ role: "user", content: consigne(theme) }];
  const usage = { entree: 0, sortie: 0, recherches: 0 };
  let reponse;
  // Reprise sur `pause_turn` : la boucle côté serveur s'arrête à dix itérations, et renvoyer le
  // tour tel quel la fait reprendre là où elle en était.
  for (let reprise = 0; reprise < 5; reprise++) {
    const flux = client.beta.messages.stream({
      model: MODELE,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
      messages,
    });
    reponse = await flux.finalMessage();
    usage.entree += reponse.usage.input_tokens + (reponse.usage.cache_read_input_tokens ?? 0);
    usage.sortie += reponse.usage.output_tokens;
    usage.recherches += reponse.usage.server_tool_use?.web_search_requests ?? 0;
    if (reponse.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: reponse.content });
  }
  if (reponse.stop_reason === "refusal") throw new Error(`refus (${theme})`);
  const texte = reponse.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const debut = texte.indexOf("{");
  let lieux = [];
  try {
    lieux = debut >= 0 ? JSON.parse(texte.slice(debut, texte.lastIndexOf("}") + 1)).lieux ?? [] : [];
  } catch {
    // Le JSON n'a pas pu être lu : on le dit plutôt que de rendre « 0 citation » sans raison.
  }
  // Le 24/09/2026, « manger » à Lyon est revenu vide après 11 minutes et 1 $ de recherches, sans
  // qu'on sache pourquoi. Un résultat vide dit désormais d'où il vient.
  if (lieux.length === 0) {
    console.log(`  ⚠ ${theme} vide — arrêt : ${reponse.stop_reason}, ${texte.length} caractères de texte, blocs : ${reponse.content.map((b) => b.type).join(",")}`);
    console.log(`  début du texte : ${texte.slice(0, 300).replace(/\s+/g, " ")}`);
  }
  return { lieux, usage };
}

/** Nom comparable : sans accents, sans article de tête, sans ponctuation. */
const nomPlat = (t) =>
  (t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/^(le|la|les|l) /, "");

/** Les mots d'une adresse qui départagent deux homonymes : numéro et nom de rue. */
const motsAdresse = (t) =>
  (t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !["rue", "place", "quai", "avenue", "cours", "boulevard", "lyon", "france", "des", "les", "del"].includes(w));

/**
 * Rapproche une citation d'un lieu du socle. Abstention plutôt que pari : s'il y a plusieurs
 * homonymes et que l'adresse ne tranche pas, on n'attribue la citation à personne. Donner la
 * notoriété d'un bar à son homonyme serait exactement la faute que tout le reste évite.
 */
function rapprocher(citation, lieux) {
  // Un seul sens, celui de la vérification : la citation est la requête. Dans l'autre sens,
  // « Bon Clic Bon Genre » confirmait « Bar de Bon Secours » sur le seul mot « bon ».
  const candidats = lieux.filter((l) => namesMatch(citation.nom, l.nom));
  if (candidats.length === 0) return { statut: "absent" };
  if (candidats.length === 1) return { statut: "ok", lieu: candidats[0] };

  // Un seul lieu au nom exact l'emporte : « Le Fantôme de l'Opéra » face au « Bouchon de l'Opéra ».
  const exacts = candidats.filter((l) => nomPlat(l.nom) === nomPlat(citation.nom));
  if (exacts.length === 1) return { statut: "ok", lieu: exacts[0] };

  // Sinon l'adresse départage ; et si les meilleurs candidats sont au même endroit, ce sont des
  // doublons du référentiel (« Le Passage » et « Bar du Passage », 8 rue du Plâtre).
  const motsCit = motsAdresse(citation.adresse);
  const scores = candidats.map((l) => ({ l, s: motsAdresse(l.adresse).filter((w) => motsCit.includes(w)).length }));
  const meilleur = Math.max(...scores.map((x) => x.s));
  const tete = scores.filter((x) => x.s === meilleur).map((x) => x.l);
  if (meilleur > 0 && tete.length === 1) return { statut: "ok", lieu: tete[0] };
  if (meilleur > 0 && tete.every((l) => distanceM(l, tete[0]) < 60)) {
    return { statut: "ok", lieu: tete.find((l) => nomPlat(l.nom) === nomPlat(citation.nom)) ?? tete[0] };
  }
  return { statut: "ambigu", candidats: candidats.map((l) => `${l.nom} (${l.adresse ?? "?"})`) };
}

const lieux = await sql(`
  select fsq_id, name as nom, address as adresse, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
  from places
  where ST_DWithin(location, ST_SetSRID(ST_MakePoint(${ville.lng}, ${ville.lat}), 4326)::geography, ${(ville.rayonKm + 4) * 1000})
    and google_status is distinct from 'closed'
    and not coord_douteuse and not est_chaine and not nom_douteux and cardinality(themes) > 0`);
console.log(`${ville.nom} : ${lieux.length} lieux proposables · modèle ${MODELE}\n`);

const fichier = join(tmpdir(), `vibetrip-curation-${cle}.json`);
const anciens = rejouer ? JSON.parse(readFileSync(fichier, "utf8")) : [];
const total = { entree: 0, sortie: 0, recherches: 0 };
const retenus = [];
const journal = rejouer ? [] : existsSync(fichier) && process.argv.includes("--suite") ? JSON.parse(readFileSync(fichier, "utf8")) : [];

/**
 * Écrit **envie par envie**, pas à la fin. Le 24/09/2026, le crédit API s'est épuisé à la deuxième
 * envie et la première — recherches déjà payées, 14 lieux rapprochés — est partie avec le
 * processus. Une routine qui tourne des heures sur des dizaines de villes ne peut pas tout miser
 * sur son dernier instant.
 */
async function enregistrer(lot) {
  writeFileSync(fichier, JSON.stringify(journal, null, 1));
  if (sec || lot.length === 0) return;
  const valeurs = lot
    .map((r) => `(${lit(r.fsq_id)}, ${lit(r.source_nom)}, ${lit(r.source_url)}, ${lit(r.raison)}, ${lit(ville.nom.toLowerCase())})`)
    .join(",");
  await sql(`
    insert into mentions (fsq_id, source_nom, source_url, raison, ville_norm)
    values ${valeurs}
    on conflict (fsq_id, source_url) do update set raison = excluded.raison, trouve_le = current_date`);
}

const coutDe = (u) => {
  const [e, s] = TARIFS[MODELE] ?? TARIFS["claude-opus-5"];
  return (u.entree * e + u.sortie * s) / 1e6 + u.recherches * 0.01;
};
const depenseInitiale = Number(process.env.VIBETRIP_CURATION_DEJA ?? 0);
const coutsParEnvie = [];

for (const theme of themes) {
  // Plafond **prédictif** : une envie ne s'interrompt pas en cours de route, donc on refuse de la
  // lancer si son coût probable (la plus chère déjà faite, 1,2 $ faute de mieux) ferait déborder.
  // Vérifier seulement après coup avait laissé une envie coûter 1,90 $ sous un plafond de 1,20 $.
  const probable = Math.max(1.2, ...coutsParEnvie);
  if (!rejouer && depenseInitiale + coutDe(total) + probable > BUDGET) {
    console.log(`Plafond de ${BUDGET} $ : « ${theme} » (~${probable.toFixed(2)} $) le dépasserait — arrêt.`);
    break;
  }
  const t0 = Date.now();
  const { lieux: citations, usage } = rejouer
    ? { lieux: anciens.filter((c) => c.theme === theme), usage: { entree: 0, sortie: 0, recherches: 0 } }
    : await chercher(theme);
  for (const k of Object.keys(total)) total[k] += usage[k];
  coutsParEnvie.push(coutDe(usage));
  const bilan = { ok: 0, absent: 0, ambigu: 0 };
  const lot = [];
  for (const c of citations) {
    const r = rapprocher(c, lieux);
    bilan[r.statut]++;
    journal.push({ theme, ...c, statut: r.statut, socle: r.lieu?.nom, socle_adresse: r.lieu?.adresse, homonymes: r.candidats });
    if (r.statut === "ok") lot.push({ ...c, fsq_id: r.lieu.fsq_id, socle: r.lieu.nom });
  }
  retenus.push(...lot);
  await enregistrer(lot);
  console.log(
    `${theme.padEnd(9)} ${citations.length} citations → ${bilan.ok} rapprochées, ${bilan.absent} absentes du socle, ${bilan.ambigu} ambiguës` +
      `  (${Math.round((Date.now() - t0) / 1000)} s, ${usage.recherches} recherches)`
  );
}

// Coût : tarifs publics du modèle + 10 $ les 1 000 recherches.
const cout = coutDe(total);
console.log(`\n${retenus.length} lieux retenus · ${total.entree} jetons lus, ${total.sortie} écrits, ${total.recherches} recherches ≈ ${cout.toFixed(2)} $`);
console.log(`Journal complet : ${fichier}`);

if (sec) process.exit(0);
// Une raison éditoriale remplace une définition Wikidata : elle dit pourquoi y aller, pas ce que c'est.
await sql(`
  update places p set raison = m.raison
  from (select distinct on (fsq_id) fsq_id, raison from mentions order by fsq_id, trouve_le desc) m
  where p.fsq_id = m.fsq_id and m.raison is not null`);
await sql(`select recalculer_notoriete()`);
console.log("Écrit en base, notoriété recalculée.");
