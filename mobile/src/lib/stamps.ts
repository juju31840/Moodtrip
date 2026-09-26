import { createStore } from "@/lib/kv";
import { ratingsStore } from "@/lib/ratings";
import { itineraryStore, type SavedItinerary } from "@/lib/storage";
import { cityLabel, visitsStore, type VisitedPlace } from "@/lib/visits";

/**
 * Les tampons — la collection qui donne envie de remplir sa carte (idée 7, 26/09/2026).
 *
 * Ils récompensent des **sorties faites**, jamais l'usage de l'application : pas de points, pas de
 * série de jours, pas de rappel culpabilisant, qui usent vite et font « appli de régime ». Et rien
 * n'est à saisir : chaque tampon se déduit de ce qu'on fait déjà — étapes cochées, sorties, notes.
 * Les tampons à gagner restent visibles, en pointillé : c'est ce qui donne envie d'aller les
 * chercher.
 */
export interface Stamp {
  id: string;
  title: string;
  /** Ce qu'il faut faire pour l'obtenir — affiché tant qu'il n'est pas gagné. */
  hint: string;
  kind: "city" | "first";
  earned: boolean;
}

interface Facts {
  places: VisitedPlace[];
  outings: SavedItinerary[];
  rated: number;
}

const has = (facts: Facts, test: (place: VisitedPlace) => boolean) => facts.places.some(test);
const startedMode = (facts: Facts, mode: string) => facts.outings.some((o) => o.itinerary.mode === mode && o.doneStepIds.length > 0);

const FIXED: { id: string; title: string; hint: string; test: (facts: Facts) => boolean }[] = [
  { id: "first-step", title: "Première étape", hint: "Coche une étape sur place", test: (f) => f.places.length > 0 },
  { id: "tonight", title: "Première soirée", hint: "Fais une soirée", test: (f) => startedMode(f, "tonight") },
  { id: "weekend", title: "Premier week-end", hint: "Pars un week-end", test: (f) => startedMode(f, "weekend") },
  { id: "trip", title: "Premier voyage", hint: "Pars en voyage", test: (f) => startedMode(f, "trip") },
  {
    id: "complete",
    title: "Sortie bouclée",
    hint: "Fais toutes les étapes d'une sortie",
    test: (f) => f.outings.some((o) => o.itinerary.steps.length > 0 && o.doneStepIds.length >= o.itinerary.steps.length),
  },
  { id: "table", title: "Première table", hint: "Va au restaurant", test: (f) => has(f, (p) => p.type === "restaurant") },
  { id: "drink", title: "Premier verre", hint: "Va dans un bar ou un café", test: (f) => has(f, (p) => p.type === "bar" || p.type === "cafe") },
  { id: "museum", title: "Premier musée", hint: "Visite un musée", test: (f) => has(f, (p) => p.type === "museum") },
  { id: "night", title: "Nuit blanche", hint: "Sors en club ou en concert", test: (f) => has(f, (p) => p.type === "nightlife") },
  { id: "outdoor", title: "Grand air", hint: "Va dans un parc ou à un point de vue", test: (f) => has(f, (p) => p.type === "park" || p.type === "viewpoint") },
  { id: "recognized", title: "Adresse reconnue", hint: "Va dans une adresse recommandée", test: (f) => has(f, (p) => p.recognized === true) },
  { id: "rated", title: "Premier avis", hint: "Note un lieu", test: (f) => f.rated > 0 },
  { id: "three-cities", title: "Trois villes", hint: "Sors dans trois villes", test: (f) => cities(f.places).length >= 3 },
  { id: "ten", title: "Dix adresses", hint: "Va dans dix lieux", test: (f) => f.places.length >= 10 },
  { id: "twenty-five", title: "Vingt-cinq adresses", hint: "Va dans vingt-cinq lieux", test: (f) => f.places.length >= 25 },
];

function cities(places: VisitedPlace[]): string[] {
  return [...new Set(places.filter((place) => place.city).map((place) => cityLabel(place.city)))];
}

export function computeStamps(places = visitsStore.get(), outings = itineraryStore.list(), rated = ratingsStore.get().length): Stamp[] {
  const facts: Facts = { places, outings, rated };
  // Les villes d'abord (une par ville visitée), puis les premières fois — gagnées avant les autres.
  const cityStamps: Stamp[] = cities(places).map((city) => ({ id: `city:${city}`, title: city, hint: "", kind: "city", earned: true }));
  const fixed: Stamp[] = FIXED.map(({ id, title, hint, test }) => ({ id, title, hint, kind: "first", earned: test(facts) }));
  return [...cityStamps, ...fixed.filter((s) => s.earned), ...fixed.filter((s) => !s.earned)];
}

/** Les tampons déjà montrés : ceux qui ne le sont pas encore portent la mention « nouveau ». */
export const seenStampsStore = createStore<string[]>("vibetrip.stamps-seen.v1", []);

/**
 * À appeler autour d'un geste qui peut faire gagner un tampon : rend les titres des tampons
 * gagnés par ce geste, pour que la confirmation les annonce.
 */
export function earnedBy(action: () => void): string[] {
  const before = new Set(computeStamps().filter((s) => s.earned).map((s) => s.id));
  action();
  return computeStamps()
    .filter((s) => s.earned && !before.has(s.id))
    .map((s) => s.title);
}
