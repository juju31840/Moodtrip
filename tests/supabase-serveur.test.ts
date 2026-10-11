/**
 * Quelle clé part vers Supabase depuis le serveur (audit de sécurité du 11/10/2026) : la clé
 * secrète dès qu'elle est posée, jamais la clé publique pour ce qui l'exige.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rpcServeur } from "@/lib/supabase-serveur";
import { checkRateLimit } from "@/lib/rate-limit";

const appels: { url: string; apikey: string; corps: unknown }[] = [];

beforeEach(() => {
  appels.length = 0;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://exemple.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      appels.push({ url, apikey: (init.headers as Record<string, string>).apikey ?? "", corps: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify([{ autorise: false, restant: 0 }]), { status: 200 });
    })
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("appels serveur vers Supabase", () => {
  it("utilise la clé secrète dès qu'elle est posée", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
    await rpcServeur("consommer_quota", { p_cle: "ip:1", p_max: 5 });
    expect(appels[0]?.apikey).toBe("sb_secret_test");
    expect(appels[0]?.url).toBe("https://exemple.supabase.co/rest/v1/rpc/consommer_quota");
  });

  it("retombe sur la clé publiable tant que la clé secrète manque, sauf si elle est exigée", async () => {
    delete process.env.SUPABASE_SECRET_KEY;
    await rpcServeur("noter_propositions", { p_ids: ["a"] });
    expect(appels[0]?.apikey).toBe("sb_publishable_test");
    expect(rpcServeur("file_verification_google", { p_lot: 150 }, { secrete: true })).toBeNull();
  });

  it("le quota suit la réponse de la base, sans repli mémoire quand elle refuse", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
    const resultat = await checkRateLimit("ip:203.0.113.7", 5);
    expect(resultat).toEqual({ allowed: false, remaining: 0 });
    expect(appels[0]?.corps).toEqual({ p_cle: "ip:203.0.113.7", p_max: 5 });
  });
});
