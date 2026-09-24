import Storage from "expo-sqlite/kv-store";
import { useSyncExternalStore } from "react";

import type { Itinerary } from "@/types/itinerary";

/**
 * Même interface que `lib/storage.ts` du site (`ItineraryStore`), servie ici par le magasin
 * clé-valeur d'expo-sqlite, **synchrone** comme `localStorage` : les écrans ne voient pas la
 * différence, et le basculement vers Supabase restera un changement d'implémentation.
 *
 * Les types sont redéclarés et non importés : le module du site touche `window`, et le
 * typage de ce projet n'a pas à connaître le DOM.
 */
export interface SavedItinerary {
  id: string;
  itinerary: Itinerary;
  savedAt: string;
  doneStepIds: string[];
}

const KEY = "vibetrip.itineraries.v1";
const MAX_ENTRIES = 20;

const listeners = new Set<() => void>();
let cache: SavedItinerary[] | null = null;

function readAll(): SavedItinerary[] {
  if (cache) return cache;
  try {
    const raw = Storage.getItemSync(KEY);
    cache = raw ? (JSON.parse(raw) as SavedItinerary[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function writeAll(entries: SavedItinerary[]) {
  cache = entries.slice(0, MAX_ENTRIES);
  try {
    Storage.setItemSync(KEY, JSON.stringify(cache));
  } catch {
    // La copie en mémoire reste : l'écran courant n'en perd rien.
  }
  listeners.forEach((listener) => listener());
}

export const itineraryStore = {
  list: readAll,
  save(itinerary: Itinerary): SavedItinerary {
    const entry: SavedItinerary = {
      id: `${Date.now().toString(36)}-${itinerary.id}`,
      itinerary,
      savedAt: new Date().toISOString(),
      doneStepIds: [],
    };
    writeAll([entry, ...readAll()]);
    return entry;
  },
  remove(id: string) {
    writeAll(readAll().filter((entry) => entry.id !== id));
  },
  toggleStepDone(id: string, stepId: string) {
    writeAll(
      readAll().map((entry) =>
        entry.id !== id
          ? entry
          : {
              ...entry,
              doneStepIds: entry.doneStepIds.includes(stepId)
                ? entry.doneStepIds.filter((done) => done !== stepId)
                : [...entry.doneStepIds, stepId],
            }
      )
    );
  },
};

export function useSavedItineraries(): SavedItinerary[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    readAll
  );
}
