import { createStore } from "@/lib/kv";

/**
 * Les notes données — gardées pour être **rendues** à qui les a données (profil, rappel dans
 * « Sorties »). Sur le site, le registre ne gardait d'abord que le fait d'avoir noté : on donnait
 * un avis qu'on ne revoyait jamais, et un geste qui ne rend rien cesse d'être fait.
 */
export interface Rating {
  /** `${itineraryId}:${stepId}` — la même forme de référence que les passages. */
  ref: string;
  placeName: string;
  note: number;
  at: string;
}

export const ratingsStore = createStore<Rating[]>("vibetrip.ratings.v1", []);

export function isRated(itineraryId: string, stepId: string): boolean {
  return ratingsStore.get().some((rating) => rating.ref === `${itineraryId}:${stepId}`);
}

export function saveRating(itineraryId: string, stepId: string, placeName: string, note: number) {
  const ref = `${itineraryId}:${stepId}`;
  ratingsStore.set([{ ref, placeName, note, at: new Date().toISOString() }, ...ratingsStore.get().filter((rating) => rating.ref !== ref)]);
}
