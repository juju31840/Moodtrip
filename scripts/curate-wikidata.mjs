/**
 * Notoriété des lieux culturels, tirée de Wikidata — gratuit, sous licence CC0, sans modèle.
 *
 * Pourquoi : le socle garantit qu'un lieu existe, jamais qu'il vaut le détour. Sans signal de
 * notoriété, `candidats_autour` tirait ses candidats au hasard (`md5`), et le modèle choisissait
 * « ce musée plutôt que l'autre » sans raison — c'est le reproche des testeurs du 24/09/2026.
 * Le nombre d'éditions de Wikipédia consacrant un article à un lieu départage très bien les
 * musées et monuments ; il ne dit presque rien des bars, d'où `curate-sources.mjs` à côté.
 *
 * Le rapprochement est volontairement strict — même verrou de noms que la vérification
 * (`namesMatch`) **et** moins de 250 m : un faux rapprochement donnerait à un lieu quelconque la
 * notoriété d'un autre, exactement le « Le Baron » / « Le Baron Rouge » qu'on a déjà payé.
 *
 *   node scripts/curate-wikidata.mjs lyon
 */
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { namesMatch } from "../lib/place-match.ts";
import { VILLES, distanceM, lieuxAutour, lit, sql } from "./lib-socle.mjs";

const DISTANCE_MAX_M = 250;

/** Minuscules sans accents : « Café » et « Amphitheatre » doivent se lire comme « cafe », « amphitheatre ». */
const plat = (t) => (t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const mots = (t) => plat(t).split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Liste blanche des sortes de lieux, lue dans la description Wikidata.
 *
 * Premier passage à blanc sur Lyon : « Lyon Discothèque » héritait des 196 éditions de *Lyon*,
 * « Brasserie d'Oullins » de la commune d'Oullins, « Le Café de Fourvière » du quartier. Les
 * communes, quartiers, gares et lycées ont des articles partout et sont posés au milieu des
 * commerces qui portent leur nom. Énumérer ce qu'on veut est vérifiable ; exclure le reste ne
 * l'est jamais — même leçon que pour le filtrage du socle.
 */
const SORTES_OK = new Set(("musee cathedrale basilique eglise chapelle abbaye primatiale temple synagogue " +
  "mosquee place parc jardin theatre opera amphitheatre monument fontaine tour halle marche salle " +
  "cinema galerie chateau palais archeologique restaurant cafe bar brasserie bouchon librairie " +
  "bibliotheque belvedere passage traboule fresque auditorium observatoire zoo aquarium concert concerts " +
  "spectacle cinematheque").split(" "));

/**
 * Les ponts ne figurent pas dans la liste blanche : ils ne sont jamais une étape en soi, et les
 * lieux du socle qui portent leur nom sont des bars (« Le Lafayette », « Le Pont de l'U »).
 */

/** Une station porte le nom de ce qu'elle dessert — « Cathédrale Saint-Jean » est une station de métro. */
const SORTES_EXCLUES = new Set("station gare arret ligne commune quartier arrondissement lycee college ecole universite".split(" "));

/**
 * Si le nom du socle annonce un commerce (« Café Gadagne », « Buvette de la Tête d'Or »), l'élément
 * Wikidata doit être ce commerce — pas le musée ou le parc dont il porte le nom.
 */
const COMMERCE = new Set("cafe cafet bar brasserie bistro bistrot restaurant resto pub discotheque club snack boulangerie cave buvette auberge creperie guinguette boutique librairie shop store".split(" "));

/**
 * Le mot de tête désigne la sorte de lieu (« place du Change », « pont du Change ») : s'il y en a
 * un de chaque côté, ils doivent concorder. Sans cela la place reçoit la notoriété du pont.
 */
const TETES = new Set("musee place pont parc jardin square chateau chapelle eglise basilique cathedrale theatre opera fontaine halle marche tour passage abbaye palais cinema traboule pont temple".split(" "));
const ARTICLES = new Set(["le", "la", "les", "l"]);
function tete(nom) {
  const m = mots(nom).filter((w) => !ARTICLES.has(w));
  return m.length > 0 && TETES.has(m[0]) ? m[0] : null;
}

function sortesCompatibles(nomSocle, e) {
  const descr = mots(e.description);
  if (descr.some((w) => SORTES_EXCLUES.has(w))) return false;
  const sorte = e.description ? descr : mots(e.nom);
  if (!sorte.some((w) => SORTES_OK.has(w)) && !mots(e.nom).some((w) => SORTES_OK.has(w))) return false;

  const texteWd = new Set([...mots(e.nom), ...descr]);
  const socle = mots(nomSocle);
  if (socle.some((w) => COMMERCE.has(w)) && !socle.some((w) => COMMERCE.has(w) && texteWd.has(w))) {
    // Un « Café » rapproché d'un « restaurant » reste un commerce : on n'exige que l'un d'eux.
    if (![...texteWd].some((w) => COMMERCE.has(w))) return false;
  }

  const tWd = tete(e.nom);
  const tSocle = tete(nomSocle);
  if (tWd && tSocle && tWd !== tSocle) return false;
  if (tSocle && !tWd && !texteWd.has(tSocle)) return false;
  // « Le Lafayette » n'est pas le pont Lafayette, « Hôtel de Ville » n'est pas sa chapelle.
  if (tWd && !socle.includes(tWd)) return false;

  // Les mots distinctifs d'un des deux noms doivent tous se retrouver dans l'autre. Toulouse,
  // premier passage hors de Lyon : « Saint-Pierre des Chartreux » prenait la notoriété de
  // Saint-Pierre-des-Cuisines, « Église Réformée » celle du Gésu. Le nom de la ville ne compte pas
  // (« musée des Augustins de Toulouse » reste le musée des Augustins).
  const a = distinctifs(nomSocle);
  const b = distinctifs(e.nom);
  if (a.length === 0 || b.length === 0) return false;
  return a.every((w) => b.includes(w)) || b.every((w) => a.includes(w));
}

const MOTS_VIDES = new Set("de du des la le les l d et a au aux en sur sous saint sainte collection".split(" "));
let motsVille = new Set();
function distinctifs(nom) {
  return mots(nom).filter((w) => w.length > 1 && !MOTS_VIDES.has(w) && !motsVille.has(w));
}

const cle = process.argv[2];
const ville = VILLES[cle];
if (!ville) {
  console.error(`Ville inconnue. Choix : ${Object.keys(VILLES).join(", ")}`);
  process.exit(1);
}
motsVille = new Set(mots(ville.nom));

const requete = `
SELECT ?item ?nom ?description ?coord ?liens WHERE {
  SERVICE wikibase:around {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(${ville.lng} ${ville.lat})"^^geo:wktLiteral ;
                    wikibase:radius "${ville.rayonKm}" .
  }
  ?item wikibase:sitelinks ?liens .
  FILTER(?liens >= 1)
  ?item rdfs:label ?nom . FILTER(lang(?nom) = "fr")
  OPTIONAL { ?item schema:description ?description . FILTER(lang(?description) = "fr") }
}`;

// Le service de requêtes limite durement le débit (429) : la réponse est gardée en cache une
// journée, et un refus est retenté après le délai demandé plutôt que d'abandonner.
const cache = join(tmpdir(), `vibetrip-wikidata-${cle}.json`);
async function interrogerWikidata() {
  if (existsSync(cache) && Date.now() - statSync(cache).mtimeMs < 86_400_000) {
    return JSON.parse(readFileSync(cache, "utf8"));
  }
  for (let essai = 0; essai < 4; essai++) {
    const res = await fetch(
      "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(requete),
      { headers: { "User-Agent": "VibeTrip/1.0 (jules.schuft@gmail.com)", Accept: "application/sparql-results+json" } }
    );
    if (res.ok) {
      const json = await res.json();
      writeFileSync(cache, JSON.stringify(json));
      return json;
    }
    if (res.status !== 429 && res.status < 500) throw new Error(`Wikidata ${res.status}`);
    const attente = Number(res.headers.get("retry-after")) || 30 * (essai + 1);
    console.log(`Wikidata ${res.status}, nouvel essai dans ${attente} s`);
    await new Promise((r) => setTimeout(r, attente * 1000));
  }
  throw new Error("Wikidata indisponible");
}

const elements = (await interrogerWikidata()).results.bindings.map((b) => {
  const [lng, lat] = b.coord.value.replace(/^Point\(|\)$/g, "").split(" ").map(Number);
  return {
    id: b.item.value.split("/").pop(),
    nom: b.nom.value,
    description: b.description?.value ?? null,
    liens: Number(b.liens.value),
    lat,
    lng,
  };
});
console.log(`${ville.nom} : ${elements.length} éléments Wikidata avec article`);

const lieux = await lieuxAutour(ville, ville.rayonKm + 1);
console.log(`${lieux.length} lieux proposables dans le socle`);

// Index grossier par cellule de ~1 km, pour ne pas comparer 5 000 × 20 000 paires.
const cellule = (p) => `${Math.floor(p.lat * 100)}:${Math.floor(p.lng * 100)}`;
const grille = new Map();
for (const l of lieux) {
  const k = cellule(l);
  if (!grille.has(k)) grille.set(k, []);
  grille.get(k).push(l);
}
function voisins(p) {
  const la = Math.floor(p.lat * 100), ln = Math.floor(p.lng * 100);
  const out = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push(...(grille.get(`${la + i}:${ln + j}`) ?? []));
  return out;
}

const rapproches = new Map(); // fsq_id → meilleur élément Wikidata
for (const e of elements) {
  const candidats = voisins(e)
    .map((l) => ({ l, d: distanceM(e, l) }))
    .filter(({ l, d }) =>
      d <= DISTANCE_MAX_M &&
      sortesCompatibles(l.nom, e) &&
      (namesMatch(e.nom, l.nom) || namesMatch(l.nom, e.nom)))
    .sort((a, b) => a.d - b.d);
  const choix = candidats[0];
  if (!choix) continue;
  const deja = rapproches.get(choix.l.fsq_id);
  if (!deja || deja.e.liens < e.liens) rapproches.set(choix.l.fsq_id, { e, l: choix.l, d: choix.d });
}

const liste = [...rapproches.values()].sort((a, b) => b.e.liens - a.e.liens);
console.log(`${liste.length} lieux rapprochés\n`);
for (const { e, l, d } of liste.slice(0, Number(process.env.N ?? 25))) {
  console.log(`  ${String(e.liens).padStart(3)} éd. · ${l.nom}  ←  ${e.nom} (${Math.round(d)} m) — ${e.description ?? ""}`);
}

if (process.argv.includes("--sec")) process.exit(0);

// Écriture par lots. `raison` ne reçoit la description Wikidata que si aucune source éditoriale
// n'en a déjà posé une : une citation de guide dit pourquoi y aller, une définition dit ce que c'est.
for (let i = 0; i < liste.length; i += 200) {
  const valeurs = liste
    .slice(i, i + 200)
    .map(({ e, l }) => `(${lit(l.fsq_id)}, ${lit(e.id)}, ${e.liens}, ${lit(e.description)})`)
    .join(",");
  await sql(`
    update places p set wd_id = v.wd, wd_sitelinks = v.liens,
           raison = coalesce(p.raison, v.descr)
    from (values ${valeurs}) as v(fsq_id, wd, liens, descr)
    where p.fsq_id = v.fsq_id`);
}
await sql(`select recalculer_notoriete()`);
console.log("Écrit en base, notoriété recalculée.");
