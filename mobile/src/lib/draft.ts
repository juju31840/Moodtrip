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
}

export const draftStore = createStore<Draft>("vibetrip.draft.v1", {
  mode: "tonight",
  city: "",
  position: null,
  budget: 50,
  ambiance: 50,
  distance: 25,
  themes: [],
});

export function patchDraft(patch: Partial<Draft>) {
  draftStore.set({ ...draftStore.get(), ...patch });
}
