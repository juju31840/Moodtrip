/**
 * Des photos pour chaque grande ville, pour illustrer les sorties — gratuites, sous licence libre.
 *
 * Retours du 26/09/2026 : la carte du parcours répétée à chaque ligne « fait répétitif » ; puis
 * une seule photo par ville ne suffisait pas — dix sorties à Lyon, dix fois la même image. Chaque
 * ville reçoit donc **plusieurs** photos : l'image principale de sa fiche Wikidata (P18), plus
 * celles de ses monuments les plus connus (les éléments situés dans la commune, classés par
 * nombre d'éditions Wikipédia). En août, Wikimedia avait été écarté pour les **lieux** — cherchées
 * par géolocalisation, les images montraient le voisinage ; pour une ville et ses monuments,
 * l'image vient de leur propre fiche.
 *
 * Wikidata limite durement le débit (429) et tombe parfois (502, 504) : chaque requête est
 * réessayée avec des pauses croissantes, et le travail avance ville par ville — une panne ne
 * perd que la ville en cours.
 *
 * Licence libre ≠ sans auteur : chaque photo garde son auteur et sa licence, crédités dans
 * l'application (page « Crédits photos » du profil).
 *
 *   node scripts/city-photos.mjs [--villes 100]
 */
import { writeFileSync } from "node:fs";

const UA = { "User-Agent": "VibeTrip/1.0 (jules.schuft@gmail.com)" };
const iVilles = process.argv.indexOf("--villes");
const NOMBRE = iVilles > 0 ? Number(process.argv[iVilles + 1]) : 100;
const PAR_VILLE = 5;
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Un appel réseau réessayé avec des pauses croissantes — sur une réponse en erreur (429, 502,
 * 504) **comme sur une connexion coupée** (ECONNRESET) : la première version ne rattrapait que
 * les réponses, et une coupure faisait tomber tout le script avant qu'il n'écrive quoi que ce soit.
 */
async function avecReprise(nom, appel) {
  for (let essai = 0; essai < 6; essai++) {
    let motif;
    try {
      const res = await appel();
      if (res.ok) return await res.json();
      motif = res.status;
      const pause = (Number(res.headers.get("retry-after")) || 5 * 2 ** essai) * 1000;
      console.log(`  ${nom} ${motif}, nouvel essai dans ${Math.round(pause / 1000)} s`);
      await attendre(pause);
    } catch (erreur) {
      motif = erreur.cause?.code ?? erreur.message;
      console.log(`  ${nom} ${motif}, nouvel essai dans ${5 * 2 ** essai} s`);
      await attendre(5000 * 2 ** essai);
    }
  }
  throw new Error(`${nom} indisponible`);
}

async function sparql(requete) {
  const json = await avecReprise("Wikidata", () =>
    fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(requete), {
      headers: { ...UA, Accept: "application/sparql-results+json" },
      // Sans délai, une connexion à demi coupée laissait le script suspendu indéfiniment
      // (constaté le 26/09/2026 : 30 minutes sans une ligne de journal).
      signal: AbortSignal.timeout(60_000),
    })
  );
  return json.results.bindings;
}

const qid = (uri) => uri.split("/").pop();
const fichier = (uri) => decodeURIComponent(uri.split("/").pop()).replace(/_/g, " ");
const norm = (t) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// Cartes, blasons, logos, plans : pas des photos de la ville.
const PAS_UNE_PHOTO = /(\.svg$|\.png$|map|carte|logo|blason|coat|arms|flag|drapeau|plan |locator|localisation|collage|interior|intérieur)/i;

// 1. Les communes les plus peuplées, avec leur position (pour rattacher une sortie à sa ville).
// En deux temps : trier les 35 000 communes par population dépassait le délai du service le
// 26/09/2026 (six refus de suite). Filtrer d'abord au-dessus de 40 000 habitants répond en 3 s,
// et c'est sur ces ~200 communes seulement qu'on demande nom, position et photo.
const peuplees = await sparql(`
SELECT ?ville (MAX(?p) AS ?population) WHERE {
  ?ville wdt:P31 wd:Q484170 ; wdt:P1082 ?p . FILTER(?p > 40000)
} GROUP BY ?ville ORDER BY DESC(?population) LIMIT ${NOMBRE + 20}`);
// Paris n'est pas classée « commune de France » (statut particulier) : ajoutée en tête.
const identifiants = ["Q90", ...peuplees.map((l) => qid(l.ville.value))];
const details = await sparql(`
SELECT ?ville ?nom ?coord ?image WHERE {
  VALUES ?ville { ${identifiants.map((id) => `wd:${id}`).join(" ")} }
  ?ville wdt:P625 ?coord ; rdfs:label ?nom . FILTER(lang(?nom) = "fr")
  OPTIONAL { ?ville wdt:P18 ?image }
}`);
const parId = new Map(details.map((l) => [qid(l.ville.value), l]));
const communes = identifiants.map((id) => parId.get(id)).filter(Boolean);
const paris = [];

const villes = new Map();
for (const l of [...paris, ...communes]) {
  const id = qid(l.ville.value);
  if (villes.has(id)) continue;
  const [lng, lat] = l.coord.value.replace(/^Point\(|\)$/g, "").split(" ").map(Number);
  villes.set(id, { id, nom: l.nom.value, lat, lng, fichiers: l.image ? [fichier(l.image.value)] : [] });
}
const liste = [...villes.values()].slice(0, NOMBRE);
console.log(`${liste.length} villes`);

/**
 * Liste blanche des sortes de monuments. Premier passage sans elle : « situé dans la ville »
 * ramenait des campus d'écoles (celui d'une école parisienne pour Lyon, d'une école bordelaise
 * pour Marseille), la Joconde pour Paris, des rames de métro. Même leçon que pour le socle :
 * énumérer ce qu'on veut est vérifiable, exclure le reste ne l'est jamais.
 */
const SORTES = [
  "Q16970", // église
  "Q2977", // cathédrale
  "Q163687", // basilique
  "Q174782", // place
  "Q33506", // musée
  "Q207694", // musée d'art
  "Q22698", // parc
  "Q1107656", // jardin
  "Q12280", // pont
  "Q23413", // château
  "Q4989906", // monument
  "Q483453", // fontaine
  "Q12518", // tour
  "Q16560", // palais
  "Q153562", // opéra
  "Q24354", // théâtre
  "Q543654", // hôtel de ville
  "Q15243209", // quartier historique
  "Q44613", // monastère
  "Q57821", // fortification
  "Q39614", // cimetière monumental
  "Q1030034", // halle
]
  .map((q) => `wd:${q}`)
  .join(" ");

// 2. Les monuments de chaque ville, par notoriété — une requête par ville, pour qu'une panne ne
// coûte qu'une ville. `P131/P131?` : à Paris, Lyon et Marseille, les monuments sont rattachés à
// l'arrondissement, pas à la commune.
for (const [n, ville] of liste.entries()) {
  try {
    const monuments = await sparql(`
SELECT DISTINCT ?image ?liens WHERE {
  VALUES ?sorte { ${SORTES} }
  ?item wdt:P131/wdt:P131? wd:${ville.id} ; wdt:P31 ?sorte ; wdt:P18 ?image ; wikibase:sitelinks ?liens .
  FILTER(?liens >= 5)
} ORDER BY DESC(?liens) LIMIT 12`);
    for (const m of monuments) {
      const f = fichier(m.image.value);
      if (!PAS_UNE_PHOTO.test(f) && !ville.fichiers.includes(f)) ville.fichiers.push(f);
      if (ville.fichiers.length >= PAR_VILLE) break;
    }
  } catch {
    console.log(`  ${ville.nom} : monuments indisponibles, photo principale seule`);
  }
  if (n % 10 === 9) console.log(`  ${n + 1}/${liste.length}`);
  await attendre(400);
}

// 3. Vignette, auteur et licence de chaque fichier, par lots de 40.
const tous = [...new Set(liste.flatMap((v) => v.fichiers))];
const infos = new Map();
for (let i = 0; i < tous.length; i += 40) {
  const titres = tous.slice(i, i + 40).map((f) => `File:${f}`).join("|");
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=480&titles=" +
    encodeURIComponent(titres);
  const data = await avecReprise("Commons", () => fetch(url, { headers: UA, signal: AbortSignal.timeout(60_000) }));
  for (const page of Object.values(data.query?.pages ?? {})) {
    const info = page.imageinfo?.[0];
    if (!info?.thumburl) continue;
    const meta = info.extmetadata ?? {};
    // L'auteur arrive souvent en HTML, avec « (talk · contribs) » : on ne garde que le nom.
    const auteur =
      (meta.Artist?.value ?? "").replace(/<[^>]+>/g, "").replace(/\(talk[^)]*\)/gi, "").replace(/\s+/g, " ").trim() || "Auteur inconnu";
    infos.set(page.title.replace(/^File:/, ""), {
      url: info.thumburl,
      auteur: auteur.slice(0, 80),
      licence: meta.LicenseShortName?.value ?? "Wikimedia Commons",
      page: info.descriptionurl,
    });
  }
  await attendre(300);
}

const sortie = {};
for (const ville of liste) {
  const photos = ville.fichiers.map((f) => infos.get(f)).filter(Boolean);
  if (photos.length === 0) continue;
  sortie[norm(ville.nom)] = { ville: ville.nom, lat: ville.lat, lng: ville.lng, photos };
}
writeFileSync("mobile/src/data/city-photos.json", JSON.stringify(sortie) + "\n");
const nb = Object.values(sortie).map((v) => v.photos.length);
console.log(`${nb.length} villes avec photo · ${nb.reduce((a, b) => a + b, 0)} photos · ${nb.filter((x) => x >= 3).length} villes à 3 photos ou plus`);
const manquantes = liste.filter((v) => !sortie[norm(v.nom)]).map((v) => v.nom);
if (manquantes.length) console.log(`Sans photo : ${manquantes.join(", ")}`);
