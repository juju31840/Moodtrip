/**
 * Une photo par grande ville, pour illustrer les sorties — gratuite, sous licence libre.
 *
 * Retour du 26/09/2026 : dans « Sorties », la carte du parcours répétée à chaque ligne « fait
 * répétitif » — carte, carte, carte. Une photo de la ville (sa mairie, une place connue) varie la
 * page. Source : l'image principale (P18) de chaque commune sur Wikidata, choisie par ses
 * contributeurs. En août, les photos Wikimedia avaient été écartées **pour les lieux** : cherchées
 * par géolocalisation, elles montraient le voisinage (« le portrait d'une écrivaine pour une
 * cave »). Pour une **ville**, l'image de sa propre fiche est la bonne.
 *
 * Licence libre ≠ libre de droits : chaque photo garde son auteur et sa licence, que
 * l'application affiche en crédit.
 *
 * Les 100 communes les plus peuplées, écrites dans `mobile/src/data/city-photos.json` (clé :
 * nom normalisé comme `locality_norm`).
 *
 *   node scripts/city-photos.mjs
 */
import { writeFileSync } from "node:fs";

const UA = { "User-Agent": "VibeTrip/1.0 (jules.schuft@gmail.com)" };

const requete = `
SELECT ?ville ?nom ?population ?image WHERE {
  ?ville wdt:P31 wd:Q484170 ; wdt:P1082 ?population ; wdt:P18 ?image .
  ?ville rdfs:label ?nom . FILTER(lang(?nom) = "fr")
}
ORDER BY DESC(?population) LIMIT 140`;

const res = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(requete), {
  headers: { ...UA, Accept: "application/sparql-results+json" },
});
if (!res.ok) throw new Error(`Wikidata ${res.status}`);
const lignes = (await res.json()).results.bindings;

// Paris n'est pas classée « commune de France » sur Wikidata (statut particulier) : une requête à
// part, l'union dans la requête principale la rendant trop lourde pour le service.
const paris = await fetch(
  "https://query.wikidata.org/sparql?format=json&query=" +
    encodeURIComponent(`SELECT ?ville ?nom ?image WHERE { VALUES ?ville { wd:Q90 } ?ville wdt:P18 ?image ; rdfs:label ?nom . FILTER(lang(?nom) = "fr") }`),
  { headers: { ...UA, Accept: "application/sparql-results+json" } }
);
if (paris.ok) lignes.unshift(...(await paris.json()).results.bindings);

// Une commune peut avoir plusieurs images ou populations : on garde la première par ville.
const vues = new Map();
for (const l of lignes) {
  if (!vues.has(l.ville.value)) vues.set(l.ville.value, { nom: l.nom.value, fichier: decodeURIComponent(l.image.value.split("/").pop()) });
}
const villes = [...vues.values()].slice(0, 100);

const norm = (t) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Vignette, auteur et licence, par lots de 40 fichiers.
const sortie = {};
for (let i = 0; i < villes.length; i += 40) {
  const lot = villes.slice(i, i + 40);
  const titres = lot.map((v) => `File:${v.fichier}`).join("|");
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=480&titles=" +
    encodeURIComponent(titres);
  const data = await (await fetch(url, { headers: UA })).json();
  const pages = Object.values(data.query?.pages ?? {});
  for (const v of lot) {
    const page = pages.find((p) => p.title?.replace(/^File:/, "").replace(/_/g, " ") === v.fichier.replace(/_/g, " "));
    const info = page?.imageinfo?.[0];
    if (!info?.thumburl) continue;
    const meta = info.extmetadata ?? {};
    // L'auteur arrive souvent en HTML (lien vers sa page) : on ne garde que le texte.
    const auteur =
      (meta.Artist?.value ?? "").replace(/<[^>]+>/g, "").replace(/\(talk[^)]*\)/gi, "").replace(/\s+/g, " ").trim() || "Auteur inconnu";
    sortie[norm(v.nom)] = {
      ville: v.nom,
      url: info.thumburl,
      auteur: auteur.slice(0, 80),
      licence: meta.LicenseShortName?.value ?? "Wikimedia Commons",
      page: info.descriptionurl,
    };
  }
}

writeFileSync("mobile/src/data/city-photos.json", JSON.stringify(sortie, null, 1) + "\n");
console.log(`${Object.keys(sortie).length} villes avec photo`);
console.log(Object.values(sortie).slice(0, 8).map((p) => `${p.ville} — ${p.auteur} (${p.licence})`).join("\n"));
