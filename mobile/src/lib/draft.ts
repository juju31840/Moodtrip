import { createStore } from "@/lib/kv";
import type { GeoPoint, ThemeId, TripMode } from "@/types/itinerary";

/**
 * Le brouillon de « Créer », hors de l'écran : il survit au changement d'onglet (leçon du site,
 * `HomeDraft` remonté dans `app/page.tsx`) et le Profil peut y **déposer** des envies — les
 * déposer, pas les appliquer en sous-main : on doit voir pourquoi on obtient ce qu'on obtient.
 */
export interface Draft {
  mode: TripMode;
  city: string;
  position: GeoPoint | null;
  budget: number;
  ambiance: number;
  distance: number;
  themes: ThemeId[];
  /** Pour « ce soir » : partir tout de suite, à une heure donnée, ou demain soir. */
  start: StartChoice;
}

export type StartChoice = "now" | "20" | "21" | "22" | "tomorrow";

/**
 * L'heure de départ réelle d'un choix. « Tout de suite » avant 18 h vaut 20 h : on ne propose pas
 * une soirée à 15 h. Une heure déjà passée n'est pas proposée à l'écran (`availableStarts`).
 */
export function startDate(choice: StartChoice, now = new Date()): Date {
  const at = (days: number, hour: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    date.setHours(hour, 0, 0, 0);
    return date;
  };
  if (choice === "tomorrow") return at(1, 20);
  if (choice === "now") return now.getHours() < 18 ? at(0, 20) : now;
  return at(0, Number(choice));
}

export function availableStarts(now = new Date()): { id: StartChoice; label: string }[] {
  const hours = (["20", "21", "22"] as const).filter((hour) => Number(hour) > now.getHours());
  return [
    { id: "now", label: "Tout de suite" },
    ...hours.map((hour) => ({ id: hour, label: `${hour} h` })),
    { id: "tomorrow", label: "Demain soir" },
  ];
}

export const draftStore = createStore<Draft>("vibetrip.draft.v1", {
  mode: "tonight",
  city: "",
  position: null,
  budget: 50,
  ambiance: 50,
  distance: 25,
  themes: [],
  start: "now",
});

export function patchDraft(patch: Partial<Draft>) {
  draftStore.set({ ...draftStore.get(), ...patch });
}
