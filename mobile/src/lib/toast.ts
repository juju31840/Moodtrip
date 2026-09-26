import { createStore } from "@/lib/kv";
import type { ItineraryStep } from "@/types/itinerary";

/**
 * La confirmation d'un geste, affichée par-dessus tous les écrans. Quand on vient de cocher une
 * étape, elle nomme le lieu (« Soif ! — ajouté à ta carte ») et demande une note : c'est le bon
 * moment pour donner son avis. Sans un mot, on donnerait une information sans rien recevoir.
 */
export interface Toast {
  id: number;
  message: string;
  rate?: { itineraryId: string; step: ItineraryStep };
}

export const toastStore = createStore<Toast | null>("vibetrip.toast.volatile", null);

export function showToast(message: string, rate?: Toast["rate"]) {
  toastStore.set({ id: Date.now(), message, rate });
}
