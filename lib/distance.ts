import { levelIndex } from "./levels";

/**
 * Ce que veut dire chaque palier du curseur « Distance » — la source unique, lue par la
 * sélection des candidats (`lib/places-db.ts`), le filtre de plausibilité (`lib/geo.ts`) et la
 * consigne envoyée au modèle (`lib/prompt.ts`).
 *
 * Retour des testeurs (24/09/2026) : « même quand on met un truc pas trop loin, on se retrouve en
 * dehors de la ville ». Fondé, et pire qu'il n'y paraissait. Le mot affiché était le même dans
 * les trois modes, mais le rayon derrière ne l'était pas : « Toute la ville » valait 17,5 km en
 * soirée, 32,5 km en week-end et **110 km** en voyage — où l'application allait alors chercher
 * les sept plus grosses villes du rayon, d'où des étapes à une ou deux heures de train.
 *
 * Désormais le mot dit ce qu'il fait, quel que soit le mode :
 * - « Toute la ville » ne sort **pas** de la commune de départ ;
 * - « Les environs » est la proche banlieue, une demi-heure de transport ;
 * - « Loin » s'arrête à une heure de trajet.
 *
 * Module pur, sans `server-only` : l'écran de réglages pourra un jour afficher la même borne.
 */
export interface DistanceBand {
  /** Rayon de recherche des lieux autour du point de départ. */
  rayonKm: number;
  /** Les lieux doivent être dans la commune du point de départ (« Toute la ville »). */
  memeCommune: boolean;
  /** Au-delà de la ville : un voyage peut alors passer par d'autres communes du rayon. */
  plusieursVilles: boolean;
  /** Consigne au modèle, dans les mêmes mots que l'étiquette lue par l'utilisateur. */
  consigne: string;
}

const BANDS: readonly DistanceBand[] = [
  {
    rayonKm: 1.5,
    memeCommune: false,
    plusieursVilles: false,
    consigne: "Tout se fait à pied : moins de vingt minutes de marche entre deux étapes, aucun transport.",
  },
  {
    rayonKm: 3,
    memeCommune: false,
    plusieursVilles: false,
    consigne: "Reste dans le quartier de départ et ses quartiers voisins.",
  },
  {
    rayonKm: 10,
    memeCommune: true,
    plusieursVilles: false,
    consigne: "Toutes les étapes sont dans la ville de départ elle-même, jamais dans une autre commune.",
  },
  {
    rayonKm: 15,
    memeCommune: false,
    plusieursVilles: true,
    consigne: "La ville et sa proche banlieue : chaque étape à moins d'une demi-heure de transport du point de départ.",
  },
  {
    rayonKm: 50,
    memeCommune: false,
    plusieursVilles: true,
    consigne: "Jusqu'à une heure de trajet du point de départ, jamais au-delà : pas de train grande ligne.",
  },
];

export function distanceBand(distance: number): DistanceBand {
  return BANDS[levelIndex(distance)] ?? BANDS[BANDS.length - 1]!;
}

/**
 * Tolérance du filtre de plausibilité : il écarte les coordonnées que le modèle aurait écrites
 * hors de toute vraisemblance, pas celles qui débordent de quelques centaines de mètres.
 */
export function plausibilityRadiusKm(distance: number): number {
  const { rayonKm } = distanceBand(distance);
  return Math.max(rayonKm * 1.5, rayonKm + 2);
}
