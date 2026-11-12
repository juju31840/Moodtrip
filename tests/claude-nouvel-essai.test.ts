/**
 * Une sortie hors schéma doit déclencher le nouvel essai, pas emporter la proposition
 * (banc du 11/11/2026 : 2 propositions sur 19 perdues ainsi).
 */
import { describe, expect, it, vi } from "vitest";

const parse = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const original = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  class Faux {
    messages = { parse };
  }
  // Les classes d'erreur sont des membres statiques non énumérables : à recopier une par une.
  Object.assign(Faux, { APIError: original.APIError, APIConnectionError: original.APIConnectionError, RateLimitError: original.RateLimitError });
  return { ...original, default: Faux };
});
vi.mock("@/lib/places-db", () => ({
  fetchCandidates: async () => [],
  resolveCandidate: () => null,
  ecartKm: () => 0,
  notePropositions: async () => {},
}));

const { AnthropicError } = await import("@anthropic-ai/sdk");
const { generateProposals } = await import("@/lib/claude");
const { generateItineraryRequestSchema } = await import("@/lib/itinerary-schema");

const sortie = {
  tripName: "Soirée",
  summary: "Résumé",
  mode: "tonight",
  totalDays: 1,
  steps: [],
};

describe("nouvel essai après une sortie hors schéma", () => {
  it("relance une fois au lieu de perdre la proposition", async () => {
    parse
      .mockRejectedValueOnce(new AnthropicError("Failed to parse structured output"))
      .mockResolvedValue({ parsed_output: sortie });
    const requete = generateItineraryRequestSchema.parse({
      mode: "tonight", budget: 50, ambiance: 50, distance: 50, location: { lat: 48.85, lng: 2.35 },
    });
    const [premiere] = generateProposals(requete).proposals;
    await expect(premiere).resolves.toMatchObject({ tripName: "Soirée" });
    expect(parse.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
