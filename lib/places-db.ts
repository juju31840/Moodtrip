import "server-only";
import { haversineDistanceKm } from "./geo";
import { distanceBand } from "./distance";
import type { GeoPoint, Period, PlaceType, ThemeId, TripMode } from "@/types/itinerary";

/**
 * Le socle de lieux réels — l'inversion du pipeline.
 *
 * Jusqu'ici le modèle inventait un itinéraire et on vérifiait après coup : la moitié des étapes
 * échouait (52 % de confirmations mesurées, Paris 0/5, Lyon 0/4). Ici on lui donne d'abord une
 * liste de lieux **qui existent**, et il compose parmi eux. Le taux de confirmation devient élevé
 * par construction, et le modèle n'a plus à produire de la connaissance — seulement de
 * l'agencement, ce qu'il fait bien.
 *
 * Ce que la base garantit et ce qu'elle ne garantit pas, il faut être net là-dessus : elle
 * garantit que le lieu **existe**, à cette adresse, dans cette catégorie. Elle ne dit rien de son
 * intérêt — un Domino's Pizza y côtoie un bouchon lyonnais. C'est précisément le partage retenu :
 * la base fournit les faits, le modèle porte le jugement. D'où une liste large plutôt qu'étroite,
 * pour qu'il ait de quoi écarter.
 *
 * En cas d'indisponibilité (identifiants absents, réseau, base en panne), la fonction rend une
 * liste vide et la génération retombe sur l'ancien comportement. Le socle améliore le produit, il
 * ne doit pas être un point de rupture.
 */

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Taille du vivier, par mode — le seul arbitrage coûteux de l'inversion.
 *
 * Le prompt est ce qui coûte : à 90 candidats, la première proposition d'un week-end à Bordeaux
 * tombait à 18,8 s contre 9,8 s sans socle, le modèle passant son temps à lire la liste. Le socle
 * lui-même ne pèse que 0,22 s.
 *
 * Mais un vivier trop maigre coûte encore plus cher : mesuré au banc d'essai, un voyage de six
 * jours à Lille ne confirmait que **4 étapes sur 18** avec 50 candidats. Faute de trouver de quoi
 * composer, le modèle repart de sa propre connaissance — c'est-à-dire du défaut qu'on corrige.
 * Le vivier suit donc le nombre d'étapes à composer : 4 pour une soirée, 8 pour un week-end,
 * jusqu'à 18 pour un voyage.
 */
const CANDIDATS_MAX: Record<TripMode, number> = {
  tonight: 50,
  weekend: 70,
  trip: 130,
};

/**
 * Moins de lieux, mais les meilleurs — demande des testeurs (24/09/2026), et levier de latence :
 * le prompt est ce qui coûte. Quand la ville est curée, le vivier se resserre sur les lieux
 * reconnus et ne complète avec des inconnus que jusqu'à ce plancher.
 *
 * Le resserrage n'a lieu **que si** assez de lieux sont reconnus : sans curation, un vivier
 * maigre fait décrocher le modèle vers sa propre connaissance (Lille, 4 étapes confirmées sur 18
 * à 50 candidats) — c'est-à-dire vers le défaut que le socle corrige.
 */
const VIVIER_CURE: Record<TripMode, number> = {
  tonight: 32,
  weekend: 45,
  trip: 90,
};
const RECONNUS_MINIMUM = 12;

/**
 * Enseignes écartées du vivier. Elles existent, sont correctement référencées, et ne sont jamais
 * une sortie : les proposer ferait douter de tout le reste. Liste volontairement courte — le tri
 * fin reste au modèle, ceci n'écarte que l'indéfendable.
 */
const CHAINES = [
  "mcdonald", "domino", "subway", "starbucks", "burger king", "kfc", "quick",
  "brioche dorée", "paul ", "class'croute", "pizza hut", "o'tacos", "buffalo grill",
  "flunch", "courtepaille", "la mie caline", "columbus caf", "pomme de pain",
];

export interface PlaceCandidate {
  /** Référence courte (« L12 ») que le modèle cite au lieu d'inventer un nom et des coordonnées. */
  ref: string;
  /** Identifiant réel du lieu en base — sert à compter ce qui a été servi. */
  id: string;
  name: string;
  location: GeoPoint;
  address: string | null;
  type: PlaceType;
  themes: ThemeId[];
  distanceM: number;
  /** Commune du lieu — indispensable en mode voyage, où le vivier couvre des dizaines de villes. */
  city: string | null;
  /**
   * Points de notoriété : une source éditoriale qui le recommande, une fiche Wikipédia fournie.
   * Zéro pour l'immense majorité des lieux, qui existent sans que personne n'en dise rien.
   */
  notoriety: number;
  /** Ce qui le distingue, en une phrase factuelle — de la source éditoriale ou de Wikidata. */
  reason: string | null;
  /**
   * Créneaux où ce lieu peut raisonnablement accueillir quelqu'un — voir `periodesOuvertes`. Le
   * schéma de réponse s'en sert pour fermer la liste des références créneau par créneau.
   */
  periods: Period[];
  /**
   * Reconnu, mais laissé à une autre proposition : il reste choisissable, sans l'étoile qui le
   * ferait prendre en priorité. Voir `repartirReconnus` (lib/claude.ts).
   */
  cede?: boolean;
}

interface LigneRpc {
  ref: string;
  fsq_id: string;
  commune: string | null;
  nom: string;
  lat: number;
  lng: number;
  adresse: string | null;
  type_lieu: string;
  themes: string[];
  distance_m: number;
  notoriete: number | null;
  raison: string | null;
  gamme: string | null;
  /** Culte, bibliothèque, château, mémorial… — lu en base dans la catégorie Foursquare. */
  jour_seulement?: boolean;
}

/**
 * Rayon de recherche : le palier de distance (`lib/distance.ts`), identique dans les trois modes
 * et aligné sur le filtre de plausibilité.
 */
export function rayonKm(_mode: TripMode, distance: number): number {
  return distanceBand(distance).rayonKm;
}

export async function fetchCandidates(options: {
  origin: GeoPoint;
  mode: TripMode;
  distance: number;
  themes?: ThemeId[];
  /** Différencie les propositions parallèles : sans elle, les trois angles piochent les mêmes lieux. */
  seed: string;
  /** Curseur budget (0-100) : écarte les tables trop chères pour lui — voir `horsBudget`. */
  budget?: number;
  /** À couvert (pluie annoncée, choix accepté) : ni parc, ni point de vue, ni plein air. */
  sheltered?: boolean;
}): Promise<PlaceCandidate[]> {
  if (!URL_BASE || !CLE) return [];

  const { origin, mode, distance, themes, seed, budget = 50, sheltered = false } = options;
  const plafond = CANDIDATS_MAX[mode];
  // Assez large pour que chaque période de chaque jour ait le choix, sans noyer le prompt.
  // En soirée, trois fois plus de lignes : le filtre du soir s'applique après la requête, et les
  // lieux reconnus qu'elle place en tête sont souvent des musées et des églises. Mesuré le
  // 27/09/2026 sur une soirée « culture » à Lyon : 8 lieux utilisables sur 60 tirés, et les trois
  // propositions se partageaient les mêmes. `resserrer` ramène ensuite au plafond.
  const base = themes && themes.length > 0 ? Math.ceil(plafond / themes.length) : Math.ceil(plafond / 6);
  const parTheme = mode === "tonight" ? base * 3 : base;

  // Un voyage ne se cherche pas dans un rayon mais dans des villes : à 150 km à la ronde, le
  // balayage par proximité dépassait le délai d'exécution *par intermittence*, et cet échec est
  // silencieux — le modèle composait alors sans socle. C'est ce qui rendait le taux de
  // confirmation bimodal en mode voyage : 87 % quand la requête passait, 20 % sinon.
  // Et seulement au-delà de la ville : un voyage réglé sur « Toute la ville » restait jusqu'ici
  // un balayage de 110 km, qui menait à une ou deux heures de train (retour des testeurs).
  const palier = distanceBand(distance);
  const fonction = mode === "trip" && palier.plusieursVilles ? "candidats_voyage" : "candidats_autour";
  const corps = JSON.stringify({
    p_lat: origin.lat,
    p_lng: origin.lng,
    p_rayon_km: rayonKm(mode, distance),
    p_themes: themes && themes.length > 0 ? themes : null,
    p_par_theme: parTheme,
    p_graine: seed,
    ...(fonction === "candidats_autour" ? { p_meme_commune: palier.memeCommune } : {}),
  });

  try {
    const lignes = await interroger(fonction, corps);
    if (!lignes) return [];
    const utiles = lignes.filter(
      (l) =>
        !estUneChaine(l.nom) &&
        !horsBudget(l, budget) &&
        (!sheltered || estCouvert(l)) &&
        (mode !== "tonight" || periodesOuvertes(l).includes("evening"))
    );
    return resserrer(utiles, mode, plafond, themes)
      .map((l) => ({
        ref: l.ref,
        id: l.fsq_id,
        name: l.nom,
        location: { lat: l.lat, lng: l.lng },
        address: l.adresse,
        type: l.type_lieu as PlaceType,
        themes: l.themes as ThemeId[],
        distanceM: l.distance_m,
        city: l.commune,
        notoriety: l.notoriete ?? 0,
        reason: l.raison,
        periods: periodesOuvertes(l),
      }));
  } catch {
    // Socle indisponible : on ne casse pas la génération, elle repart comme avant.
    return [];
  }
}

/**
 * Une soirée ne propose pas ce qui est fermé le soir. Le socle ne porte aucun horaire : la règle
 * est donc par sorte de lieu. Elle est devenue urgente avec la curation (26/09/2026) — Wikidata
 * donne de la notoriété aux églises et aux musées, qui remontaient en tête des soirées : le
 * repérage de Lyon faisait défiler « Paroisse Saint-Nicolas » pour une sortie à 20 h.
 * Ne vaut que pour le mode soirée ; en week-end et en voyage, le créneau du matin ou du midi les
 * accueille, et c'est la règle par créneau (chantier « horaires ») qui devra les placer.
 */
const FERME_LE_SOIR = new Set(["museum", "shopping", "park"]);
// Bornes par lettres Unicode et non `\b` : en JavaScript `\b` ignore les lettres accentuées, et
// « Église Saint-Nicolas » ne se serait jamais fait écarter.
const CULTE = /(?<!\p{L})(eglise|église|basilique|cathedrale|cathédrale|chapelle|primatiale|paroisse|temple|abbaye|synagogue|mosquee|mosquée|couvent|monastere|monastère)(?!\p{L})/iu;

/** Un bar ou un restaurant peut s'appeler « Le Temple » : le nom ne compte que pour le reste. */
const SORTIES_DU_SOIR = new Set(["bar", "nightlife", "restaurant", "cafe"]);

/**
 * Les créneaux où un lieu peut accueillir quelqu'un. Le socle ne porte aucun horaire : la règle
 * est par sorte de lieu, et volontairement large — elle n'écarte que l'absurde (un musée le soir,
 * un club le matin). Défaut constaté le 24/09/2026 : la consigne du prompt ne suffisait pas, un
 * musée tombait encore « le soir » en week-end et en voyage. Le schéma de réponse ferme désormais
 * la liste des références créneau par créneau : l'erreur devient impossible, comme l'est déjà
 * une période hors du mode.
 */
function periodesOuvertes(ligne: LigneRpc): Period[] {
  if (FERME_LE_SOIR.has(ligne.type_lieu)) return ["morning", "midday"];
  // La catégorie d'abord, le nom en second : 3 800 lieux de culte ne disent pas « église »
  // (« Lyon Cathedral », « Sacré Cœur de Jésus », « Diyanet Fatih Camii »), et bibliothèques,
  // châteaux et mémoriaux passaient la règle du nom (27/09/2026). Un bar installé dans un château
  // reste un bar : la sorte de lieu prime.
  if (!SORTIES_DU_SOIR.has(ligne.type_lieu) && (ligne.jour_seulement || CULTE.test(ligne.nom))) return ["morning", "midday"];
  if (ligne.type_lieu === "nightlife") return ["evening"];
  // Théâtre, opéra, cinéma : l'après-midi et le soir. Ils étaient classés « museum » jusqu'au
  // 27/09/2026, donc exclus de toutes les soirées — l'Opéra de Lyon n'avait jamais pu en être.
  if (ligne.type_lieu === "show") return ["midday", "evening"];
  if (ligne.type_lieu === "bar") return ["midday", "evening"];
  if (ligne.type_lieu === "restaurant") return ["midday", "evening"];
  return ["morning", "midday", "evening"];
}

/**
 * À couvert : quand la pluie est annoncée **et** que l'utilisateur a accepté de rester à l'abri.
 * Parcs, points de vue et lieux dont la seule envie est le plein air sortent du vivier.
 */
function estCouvert(ligne: LigneRpc): boolean {
  if (ligne.type_lieu === "park" || ligne.type_lieu === "viewpoint") return false;
  return !(ligne.themes.length === 1 && ligne.themes[0] === "outdoor");
}

/**
 * Budget tenu par exclusion (défaut constaté dès le 25/08/2026 : « Le Petit Nice Passédat »,
 * trois étoiles, proposé à budget 70). La gamme vient de `scripts/curate-price.mjs`, pour les
 * restaurants reconnus — là où sont les tables chères. « Fauché » écarte ce qui dépasse 25 € par
 * personne ; « serré » et « raisonnable », ce qui dépasse 60 €. Au-delà, rien n'est écarté.
 */
function horsBudget(ligne: LigneRpc, budget: number): boolean {
  if (!ligne.gamme || ligne.gamme === "?") return false;
  if (budget < 12.5) return ligne.gamme !== "€";
  if (budget < 62.5) return ligne.gamme === "€€€";
  return false;
}

/** Minimum de lieux gardés par envie, reconnus ou non — voir `resserrer`. */
const MINIMUM_PAR_ENVIE: Record<TripMode, number> = { tonight: 4, weekend: 6, trip: 10 };

/**
 * Choisit le vivier envie par envie, **à tour de rôle**, et non dans l'ordre des lignes.
 *
 * Défaut trouvé le 26/09/2026 : les lignes arrivent groupées par envie, dans l'ordre alphabétique
 * (culture, drink, eat…). Compléter les lieux reconnus « dans l'ordre » laissait culture et bars
 * épuiser le quota d'inconnus avant que les restaurants ne soient servis — une proposition « autour
 * de la table » à Lyon n'avait plus un seul restaurant. Le `slice(plafond)` final avait le même
 * biais sans curation. Désormais chaque envie garde ses lieux reconnus et au moins
 * `MINIMUM_PAR_ENVIE` lieux ; là où rien n'est reconnu, on retombe sur le tirage d'avant.
 */
function resserrer(lignes: LigneRpc[], mode: TripMode, plafond: number, themes?: ThemeId[]): LigneRpc[] {
  const groupes = new Map<string, LigneRpc[]>();
  for (const ligne of lignes) {
    // Même clé que `theme_cle` en SQL : la première envie demandée que le lieu porte.
    const cle = ligne.themes.find((t) => !themes?.length || themes.includes(t as ThemeId)) ?? "autre";
    groupes.set(cle, [...(groupes.get(cle) ?? []), ligne]);
  }
  const reconnus = lignes.filter((l) => (l.notoriete ?? 0) > 0).length;
  const cure = reconnus >= RECONNUS_MINIMUM;
  const cible = Math.min(plafond, cure ? Math.max(VIVIER_CURE[mode], reconnus) : plafond);

  const gardes = new Set<LigneRpc>();
  // 1. L'indispensable de chaque envie : ses lieux reconnus, et de quoi atteindre le minimum.
  for (const groupe of groupes.values()) {
    groupe.forEach((ligne, rang) => {
      if ((ligne.notoriete ?? 0) > 0 || rang < MINIMUM_PAR_ENVIE[mode]) gardes.add(ligne);
    });
  }
  // 2. Le reste, à tour de rôle entre envies, jusqu'à la cible.
  const files = [...groupes.values()].map((groupe) => groupe.filter((l) => !gardes.has(l)));
  while (gardes.size < cible && files.some((file) => file.length > 0)) {
    for (const file of files) {
      const suivant = file.shift();
      if (suivant && gardes.size < cible) gardes.add(suivant);
    }
  }
  return lignes.filter((l) => gardes.has(l));
}

/**
 * Un aller-retour, avec **une** reprise. La requête est lourde par nature et le premier appel
 * après une période creuse peut dépasser le délai ; réessayer une fois rattrape ce cas, et
 * s'arrête là — au-delà, on ferait attendre l'utilisateur pour un socle qui ne répond pas.
 */
async function interroger(fonction: string, corps: string): Promise<LigneRpc[] | null> {
  for (let essai = 0; essai < 2; essai++) {
    const response = await fetch(`${URL_BASE}/rest/v1/rpc/${fonction}`, {
      method: "POST",
      headers: { apikey: CLE!, Authorization: `Bearer ${CLE!}`, "Content-Type": "application/json" },
      body: corps,
    });
    if (response.ok) return (await response.json()) as LigneRpc[];
  }
  return null;
}

function estUneChaine(nom: string): boolean {
  const n = nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return CHAINES.some((chaine) => n.includes(chaine));
}

/**
 * Retrouve le candidat cité par le modèle. La référence prime, mais un modèle peut la déformer
 * (« L12 » écrit « l12 », « L 12 ») : on rattrape par le nom, puis on exige que la coordonnée
 * proposée soit proche, faute de quoi on considère que le modèle parlait d'autre chose.
 */
export function resolveCandidate(
  ref: string | null | undefined,
  placeName: string,
  candidates: PlaceCandidate[]
): { candidat: PlaceCandidate; parRef: boolean } | null {
  if (candidates.length === 0) return null;

  if (ref) {
    const cle = ref.replace(/\s+/g, "").toUpperCase();
    const exact = candidates.find((c) => c.ref.toUpperCase() === cle);
    if (exact) return { candidat: exact, parRef: true };
  }

  const cherche = normaliser(placeName);
  const parNom = candidates.find((c) => normaliser(c.name) === cherche);
  return parNom ? { candidat: parNom, parRef: false } : null;
}

/** Distance entre ce que le modèle a écrit et le lieu réel — sert à repérer une confusion. */
export function ecartKm(candidat: PlaceCandidate, propose: GeoPoint): number {
  return haversineDistanceKm(candidat.location, propose);
}

function normaliser(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Compte les lieux réellement servis à un utilisateur.
 *
 * Sans ce compteur, `proposed_count` resterait à zéro et la file de vérification Google
 * prioriserait au hasard — or son principe est justement de vérifier d'abord ce que les gens
 * voient. C'est la seule écriture que l'application fait dans le socle, et elle ne touche qu'un
 * entier : la clé publiable n'a pas le droit d'écrire dans `places`, l'incrément passe donc par
 * une fonction dédiée.
 *
 * Volontairement sans `await` côté appelant : un échec de comptage ne doit jamais retarder ni
 * faire échouer une génération.
 */
export async function notePropositions(ids: string[]): Promise<void> {
  if (!URL_BASE || !CLE || ids.length === 0) return;

  try {
    await fetch(`${URL_BASE}/rest/v1/rpc/noter_propositions`, {
      method: "POST",
      headers: { apikey: CLE, Authorization: `Bearer ${CLE}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_ids: [...new Set(ids)] }),
    });
  } catch {
    // Statistique d'usage : son échec n'a aucune conséquence pour l'utilisateur.
  }
}
