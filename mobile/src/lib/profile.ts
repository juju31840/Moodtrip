import { createStore } from "@/lib/kv";
import type { ThemeId } from "@/types/itinerary";

/**
 * Le profil, comme sur le site : l'identité (qui ne change aucune proposition, et c'est assumé),
 * les villes de référence, et les préférences déclarées — qui ne se fondent **jamais** avec les
 * goûts observés : l'écart entre ce qu'on dit aimer et ce qu'on fait est l'information la plus
 * intéressante des deux.
 */
export interface Preferences {
  budget: number;
  ambiance: number;
  distance: number;
  themes: ThemeId[];
}

export interface Profile {
  firstName: string;
  /** `null` tant qu'il n'est pas renseigné — 0 serait un âge. */
  age: number | null;
  /**
   * Photo en `data:` URI, **déjà réduite** (320 px, JPEG 0,82, ~25 Ko) : une photo de téléphone
   * en pèse 4 à 8 Mo, et ferait échouer l'écriture du magasin entier.
   */
  photo: string | null;
  /** Quatre au plus : au-delà ce n'est plus une référence mais une liste. */
  cities: string[];
  preferences: Preferences;
}

export const NEUTRAL_PREFERENCES: Preferences = { budget: 50, ambiance: 50, distance: 25, themes: [] };

export const profileStore = createStore<Profile>("vibetrip.profile.v1", {
  firstName: "",
  age: null,
  photo: null,
  cities: [],
  preferences: NEUTRAL_PREFERENCES,
});

/** Des préférences renseignées ne sont pas des préférences utiles : aux défauts près, elles ne disent rien. */
export function preferencesUseful(preferences: Preferences): boolean {
  return (
    preferences.budget !== NEUTRAL_PREFERENCES.budget ||
    preferences.ambiance !== NEUTRAL_PREFERENCES.ambiance ||
    preferences.distance !== NEUTRAL_PREFERENCES.distance ||
    preferences.themes.length > 0
  );
}

/**
 * Les dernières villes de départ, pour les raccourcis de « Créer ». Les villes de référence du
 * profil passent devant ; à défaut, les grandes villes — celles de tout le monde et de personne,
 * mais un premier lancement doit bien proposer quelque chose.
 */
export const DEFAULT_CITIES = ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Montpellier", "Strasbourg", "Bordeaux", "Lille", "Rennes", "Grenoble", "Tours"];
export const recentCitiesStore = createStore<string[]>("vibetrip.recent-cities.v1", []);

export function rememberCity(city: string) {
  const clean = city.trim();
  if (clean.length < 2) return;
  const current = recentCitiesStore.get().filter((item) => item.toLowerCase() !== clean.toLowerCase());
  recentCitiesStore.set([clean, ...current].slice(0, 6));
}

export function cityShortcuts(profileCities: string[], recent: string[]): string[] {
  const seen = new Set<string>();
  return [...profileCities, ...recent, ...DEFAULT_CITIES.slice(0, 6)]
    .filter((city) => {
      const key = city.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}
