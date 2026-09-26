/**
 * Qualité des photos de villes — une seconde passe sur `mobile/src/data/city-photos.json`,
 * qui n'interroge que Commons (rapide, sans les humeurs de Wikidata).
 *
 * Retour du 26/09/2026 : « améliore la qualité des photos ». Deux causes, deux réglages :
 * - les vignettes étaient demandées en 480 px de large ; elles passent à 1 000 px, de quoi rester
 *   nettes en bandeau pleine largeur sur un écran d'iPhone (3× la densité) ;
 * - certaines images d'origine sont trop petites pour être nettes : on écarte celles de moins de
 *   900 px. Les photos en portrait restent, rangées après celles en paysage, et la vue principale
 *   de la ville garde la tête. Un premier réglage plus sévère (1 400 px, paysage seulement) laissait
 *   50 villes avec une seule photo et retirait Saint-Sernin à Toulouse : la variété compte autant
 *   que la netteté. Une ville ne perd jamais toutes ses photos.
 *
 *   node scripts/city-photos-quality.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const FICHIER = "mobile/src/data/city-photos.json";
const UA = { "User-Agent": "VibeTrip/1.0 (jules.schuft@gmail.com)" };
const LARGEUR = 1000;
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

const villes = JSON.parse(readFileSync(FICHIER, "utf8"));

// Le nom du fichier Commons se lit dans l'adresse de la vignette : …/thumb/a/ab/<Fichier>/500px-<Fichier>
const nomDe = (url) => {
  const morceaux = new URL(url).pathname.split("/");
  const i = morceaux.indexOf("thumb");
  return decodeURIComponent(i >= 0 ? morceaux[i + 3] : morceaux.pop()).replace(/_/g, " ");
};

const tous = [...new Set(Object.values(villes).flatMap((v) => v.photos.map((p) => nomDe(p.url))))];
console.log(`${tous.length} photos à revoir`);

const infos = new Map();
for (let i = 0; i < tous.length; i += 40) {
  const titres = tous.slice(i, i + 40).map((f) => `File:${f}`).join("|");
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo" +
    `&iiprop=url|size&iiurlwidth=${LARGEUR}&titles=` +
    encodeURIComponent(titres);
  for (let essai = 0; essai < 5; essai++) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      for (const page of Object.values(data.query?.pages ?? {})) {
        const info = page.imageinfo?.[0];
        if (info?.thumburl) infos.set(page.title.replace(/^File:/, ""), { url: info.thumburl, largeur: info.width, hauteur: info.height });
      }
      break;
    } catch (erreur) {
      console.log(`  Commons ${erreur.message}, nouvel essai`);
      await attendre(4000 * (essai + 1));
    }
  }
  await attendre(300);
}

let gardees = 0;
let ecartees = 0;
for (const ville of Object.values(villes)) {
  const revues = ville.photos
    .map((photo) => ({ photo, info: infos.get(nomDe(photo.url)) }))
    .filter(({ info }) => info);
  const nettes = revues.filter(({ info }) => info.largeur >= 900);
  const paysage = ({ info }) => info.largeur > info.hauteur;
  // La vue principale de la ville en tête, puis les paysages, puis les portraits.
  const [tete, ...reste] = nettes;
  const ordonnees = tete ? [tete, ...reste.filter(paysage), ...reste.filter((x) => !paysage(x))] : [];
  // Faute de mieux, la meilleure qu'on avait : une ville ne reste jamais sans image.
  const retenues = ordonnees.length > 0 ? ordonnees : revues.sort((a, b) => b.info.largeur - a.info.largeur).slice(0, 1);
  ecartees += ville.photos.length - retenues.length;
  gardees += retenues.length;
  ville.photos = retenues.map(({ photo, info }) => ({ ...photo, url: info.url }));
}

writeFileSync(FICHIER, JSON.stringify(villes) + "\n");
console.log(`${gardees} photos gardées en ${LARGEUR} px · ${ecartees} écartées (trop petites)`);
const unique = Object.values(villes).filter((v) => v.photos.length === 1).length;
console.log(`${Object.keys(villes).length} villes · ${unique} n'ont qu'une photo`);
