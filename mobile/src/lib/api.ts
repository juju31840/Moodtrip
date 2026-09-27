import { fetch } from "expo/fetch";
import Storage from "expo-sqlite/kv-store";

import type { GenerateItineraryRequest, GenerationEvent } from "@/types/itinerary";

/**
 * L'application n'a pas de serveur à elle : elle appelle la même route que le site, qui porte
 * toute la chaîne de fiabilité (socle de lieux, curation, vérification). Rien de ce pipeline
 * n'est dupliqué côté téléphone.
 */
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "https://moodtrip-schuft.vercel.app";

const CLIENT_KEY = "vibetrip.client.v1";

/**
 * Identifiant d'appareil tiré au sort, envoyé en `x-vibetrip-client` : le quota compte par
 * appareil, pas seulement par adresse (trois amis derrière la même box). Contournable, et ce
 * n'est pas grave — le quota protège une dépense, il ne garde pas une porte.
 */
function clientId(): string {
  const existing = Storage.getItemSync(CLIENT_KEY);
  if (existing) return existing;
  const id = `ios-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  Storage.setItemSync(CLIENT_KEY, id);
  return id;
}

export const OFFLINE_MESSAGE = "Pas de connexion. Vérifie ton réseau, puis relance.";

/**
 * La route rend un flux NDJSON : `start`, puis une `proposal` dès que chacune est prête.
 * `expo/fetch` et non le `fetch` de React Native, qui ne sait pas lire un corps en flux — on
 * perdrait exactement ce qui fait arriver la première idée avant les autres.
 */
export async function generate(
  request: GenerateItineraryRequest,
  onEvent: (event: GenerationEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  // Le `fetch` natif échoue hors réseau avec un message technique en anglais
  // (« Network request failed ») : c'est lui qui s'affichait tel quel sur l'écran d'erreur.
  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetch(`${API_BASE}/api/generate-itinerary`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-vibetrip-client": clientId() },
      body: JSON.stringify(request),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(OFFLINE_MESSAGE);
  }

  // Seules la validation et le quota portent un vrai statut HTTP ; tout le reste arrive
  // comme un événement `error` à l'intérieur d'un 200.
  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Erreur ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    let chunk: Awaited<ReturnType<typeof reader.read>>;
    try {
      chunk = await reader.read();
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new Error(OFFLINE_MESSAGE);
    }
    const { value, done } = chunk;
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) onEvent(JSON.parse(line) as GenerationEvent);
    }
  }
}
