/**
 * Plan C (12/11/2026) : quota par jour et plafond global, pour que la perte soit connue d'avance.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const quota = vi.hoisted(() => ({ refuses: new Set<string>(), cles: [] as string[] }));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...original,
    checkRateLimit: vi.fn(async (cle: string) => {
      quota.cles.push(cle);
      const refuse = [...quota.refuses].some((r) => cle.startsWith(r));
      return { allowed: !refuse, remaining: refuse ? 0 : 1 };
    }),
  };
});
vi.mock("@/lib/claude", () => ({
  ItineraryParseError: class extends Error {},
  generateProposals: () => ({ proposals: [], scouting: Promise.resolve(null) }),
}));

const { POST } = await import("@/app/api/generate-itinerary/route");

function demande() {
  return new NextRequest("http://localhost/api/generate-itinerary", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7", "x-vibetrip-client": "abc" },
    body: JSON.stringify({ mode: "tonight", budget: 50, ambiance: 50, distance: 50, location: { lat: 48.85, lng: 2.35 } }),
  });
}

afterEach(() => {
  quota.refuses.clear();
  quota.cles.length = 0;
});

describe("quota du jour", () => {
  it("un appareil au bout de son quota ne consomme pas le plafond global", async () => {
    quota.refuses.add("203.0.113.7:abc");
    const reponse = await POST(demande());
    expect(reponse.status).toBe(429);
    expect(quota.cles).not.toContain("global");
  });

  it("le plafond global atteint bloque tout le monde, avec un message distinct", async () => {
    quota.refuses.add("global");
    const reponse = await POST(demande());
    expect(reponse.status).toBe(429);
    expect((await reponse.json()).error.message).toMatch(/plein de recherches/);
  });

  it("sous les trois plafonds, la génération part", async () => {
    const reponse = await POST(demande());
    expect(reponse.status).toBe(200);
    expect(quota.cles).toEqual(["203.0.113.7:abc", "ip:203.0.113.7", "global"]);
  });
});

describe("repli mémoire sans base", () => {
  it("compte par jour et refuse au-delà du plafond", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const { checkRateLimit } = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
    const resultats = [];
    for (let i = 0; i < 4; i++) resultats.push((await checkRateLimit("test-memoire", 3)).allowed);
    expect(resultats).toEqual([true, true, true, false]);
    vi.unstubAllEnvs();
  });
});

describe("mesure du retour", () => {
  it("n'accepte que « nouveau » ou un nombre de jours", async () => {
    const { lireAnciennete } = await import("@/lib/mesure-retour");
    expect(lireAnciennete("nouveau")).toEqual({ anciennete: 0, premiere: true });
    expect(lireAnciennete("12")).toEqual({ anciennete: 12, premiere: false });
    expect(lireAnciennete("99999")).toBeNull();
    expect(lireAnciennete("-3")).toBeNull();
    expect(lireAnciennete("1; drop table")).toBeNull();
    expect(lireAnciennete(null)).toBeNull();
  });
});
