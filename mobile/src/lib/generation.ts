import { useSyncExternalStore } from "react";

import { generate } from "@/lib/api";
import type { GenerateItineraryRequest, GenerationEvent, Itinerary } from "@/types/itinerary";

export type Scouting = Extract<GenerationEvent, { type: "scouting" }>;

/**
 * La génération en cours, partagée entre l'écran d'attente, la liste des propositions et leur
 * détail. Elle vit **hors** des écrans : c'est la leçon payée sur le site — tout état qui doit
 * survivre à l'ouverture d'un plein écran vit au-dessus de la navigation, pas dedans.
 */
export interface GenerationState {
  status: "idle" | "loading" | "done" | "error";
  request: GenerateItineraryRequest | null;
  expected: number;
  proposals: Itinerary[];
  /** Le repérage — point de départ et adresses examinées, montrés pendant l'attente. */
  scouting: Scouting | null;
  error: string | null;
}

let state: GenerationState = { status: "idle", request: null, expected: 0, proposals: [], scouting: null, error: null };
const listeners = new Set<() => void>();
let controller: AbortController | null = null;

function set(patch: Partial<GenerationState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

export function useGeneration(): GenerationState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state
  );
}

export function startGeneration(request: GenerateItineraryRequest) {
  controller?.abort();
  controller = new AbortController();
  const current = controller;
  set({ status: "loading", request, expected: 0, proposals: [], scouting: null, error: null });

  generate(
    request,
    (event) => {
      if (current.signal.aborted) return;
      if (event.type === "start") set({ expected: event.expected });
      if (event.type === "scouting") set({ scouting: event });
      if (event.type === "proposal") set({ proposals: [...state.proposals, event.itinerary] });
      if (event.type === "error") set({ status: "error", error: event.error.message });
    },
    current.signal
  )
    .then(() => {
      if (current.signal.aborted || state.status === "error") return;
      set({ status: state.proposals.length > 0 ? "done" : "error", error: state.proposals.length > 0 ? null : "Aucune proposition n'a abouti." });
    })
    .catch((error: unknown) => {
      if (current.signal.aborted) return;
      set({ status: "error", error: error instanceof Error ? error.message : "Erreur réseau." });
    });
}

export function cancelGeneration() {
  controller?.abort();
  set({ status: "idle" });
}

export function findProposal(id: string): Itinerary | undefined {
  return state.proposals.find((proposal) => proposal.id === id);
}
