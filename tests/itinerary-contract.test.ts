/**
 * Le contrat de l'itinéraire, vérifié à chaque push — la version automatique de la skill
 * `verify-itinerary-contract`, sans serveur, sans réseau et sans crédit Anthropic.
 */
import { describe, expect, it } from "vitest";
import { filterPlausibleSteps } from "@/lib/geo";
import {
  claudeItinerarySchemaFor,
  generateItineraryRequestSchema,
  itinerarySchema,
  proposalCountForMode,
} from "@/lib/itinerary-schema";
import { buildMockItineraries } from "@/lib/mock-itinerary";
import { totalDaysForMode } from "@/lib/prompt";
import type { TripMode } from "@/types/itinerary";

const PARIS = { lat: 48.8566, lng: 2.3522 };

const etape = (surcharge: Record<string, unknown> = {}) => ({
  day: 1,
  period: "evening",
  placeName: "Bar à vins du Marché",
  description: "Une trentaine de références au verre.",
  location: PARIS,
  type: "bar",
  ...surcharge,
});

const sortie = (totalDays: number, steps: unknown[]) => ({
  tripName: "Soirée test",
  summary: "Pour vérifier le contrat.",
  mode: "tonight",
  totalDays,
  steps,
});

describe("contrat de l'itinéraire", () => {
  it.each<TripMode>(["tonight", "weekend", "trip"])(
    "le mock en mode %s respecte le schéma, le nombre de jours et le rayon",
    async (mode) => {
      const requete = { budget: 50, ambiance: 50, distance: 50, mode, location: PARIS };
      const propositions = await buildMockItineraries(requete);

      expect(propositions).toHaveLength(proposalCountForMode(mode));
      for (const itineraire of propositions) {
        expect(itinerarySchema.safeParse(itineraire).success).toBe(true);
        expect(itineraire.totalDays).toBe(totalDaysForMode(mode, 50));
        expect(Math.max(...itineraire.steps.map((s) => s.day))).toBeLessThanOrEqual(itineraire.totalDays);
        expect(filterPlausibleSteps(itineraire.steps, PARIS, mode, 50)).toHaveLength(itineraire.steps.length);
      }
    }
  );

  it("en mode soirée, le schéma refuse une étape le matin", () => {
    const schema = claudeItinerarySchemaFor("tonight", 1);
    expect(schema.safeParse(sortie(1, [etape()])).success).toBe(true);
    expect(schema.safeParse(sortie(1, [etape({ period: "morning" })])).success).toBe(false);
  });

  it("le nombre de jours est imposé, pas laissé au modèle", () => {
    const schema = claudeItinerarySchemaFor("weekend", 2);
    const ok = { ...sortie(2, [etape({ day: 2 })]), mode: "weekend" };
    expect(schema.safeParse(ok).success).toBe(true);
    expect(schema.safeParse({ ...ok, totalDays: 3 }).success).toBe(false);
    expect(schema.safeParse({ ...ok, steps: [etape({ day: 3 })] }).success).toBe(false);
  });

  it("avec un socle, une étape ne cite qu'une référence existante et ouverte à ce créneau", () => {
    const schema = claudeItinerarySchemaFor("weekend", 2, ["L1", "L2"], {
      morning: ["L1"],
      midday: [],
      evening: ["L2"],
    });
    const avec = (ref: string, period: string) => ({ ...sortie(2, [etape({ ref, period })]), mode: "weekend" });
    expect(schema.safeParse(avec("L2", "evening")).success).toBe(true);
    expect(schema.safeParse(avec("L99", "evening")).success).toBe(false); // inventée
    expect(schema.safeParse(avec("L1", "evening")).success).toBe(false); // lieu du matin, le soir
  });

  it("la requête est validée : mode obligatoire, repli sur une ville accepté", () => {
    const base = { budget: 50, ambiance: 50, distance: 50, location: PARIS };
    expect(generateItineraryRequestSchema.safeParse(base).success).toBe(false); // → 400 INVALID_INPUT
    expect(generateItineraryRequestSchema.safeParse({ ...base, mode: "tonight" }).success).toBe(true);
    expect(
      generateItineraryRequestSchema.safeParse({ ...base, mode: "trip", location: { city: "Lyon" } }).success
    ).toBe(true);
    expect(generateItineraryRequestSchema.safeParse({ ...base, mode: "tonight", budget: 150 }).success).toBe(false);
  });

  it("une étape à Lyon est écartée d'une soirée à Paris", () => {
    const lyon = { location: { lat: 45.764, lng: 4.8357 } };
    const garde = filterPlausibleSteps([{ location: PARIS }, lyon], PARIS, "tonight", 50);
    expect(garde).toEqual([{ location: PARIS }]);
  });
});
