import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { claudeItinerarySchemaFor, proposalCountForMode } from "./itinerary-schema";
import { buildSystemPrompt, buildUserPrompt, PROPOSAL_ANGLES, totalDaysForMode } from "./prompt";
import { buildMockItineraries } from "./mock-itinerary";
import {
  fetchCandidates,
  resolveCandidate,
  ecartKm,
  notePropositions,
  type PlaceCandidate,
} from "./places-db";
import { geocodeCity } from "./geocode";
import type { GenerateItineraryRequest, GenerationEvent, GeoPoint, Itinerary, ItineraryStep, Period } from "@/types/itinerary";

const client = new Anthropic();

/**
 * Haiku depuis le 27/08/2026, et c'est un renversement de la décision précédente.
 *
 * Haiku avait été écarté sur deux défauts. Le premier — **il perdait des propositions entières**,
 * ses coordonnées fausses étant vidées par le filtre de plausibilité — a disparu mécaniquement
 * avec l'ancrage sur le socle : les coordonnées ne viennent plus du modèle. Le second — **il ne
 * respectait pas le contrat des périodes** — est réglé par le schéma contraint
 * (`claudeItinerarySchemaFor`), et la mesure a montré au passage que Sonnet l'enfreignait aussi.
 *
 * Les deux raisons de l'écarter étant tombées, il reste l'écart de vitesse, mesuré à contrat et
 * socle identiques : un week-end à Bordeaux livre ses trois propositions en **7,7 s contre
 * 19,6 s**. Le taux de confirmation ne bouge pas (86-90 % contre 82-100 %), puisque les lieux
 * viennent désormais de la base et non de ce que le modèle croit savoir.
 *
 * Surchargeable par `VIBETRIP_MODEL` — c'est ainsi que la comparaison a été faite, et c'est le
 * chemin de retour si la qualité rédactionnelle devait décevoir à l'usage.
 */
const MODEL = process.env.VIBETRIP_MODEL ?? "claude-haiku-4-5-20251001";
const MAX_TOKENS = 6000;

export class ItineraryParseError extends Error {}

/**
 * Écart maximal toléré entre la coordonnée écrite par le modèle et celle du lieu réel qu'il dit
 * avoir choisi. Au-delà, on considère qu'il parlait d'autre chose et on ne substitue pas : mieux
 * vaut une étape à confirmer qu'une fausse certitude sur un lieu qui n'est pas celui décrit.
 */
const ECART_MAX_KM = 2;

async function requestItinerary(
  request: GenerateItineraryRequest,
  angle: string,
  retry: boolean,
  candidates: PlaceCandidate[]
) {
  const systemPrompt = retry
    ? `${buildSystemPrompt(angle)} Ta réponse précédente n'était pas un JSON valide conforme au schéma attendu. Corrige-la et renvoie uniquement le JSON demandé, sans aucun texte autour.`
    : buildSystemPrompt(angle);

  return client.messages.parse({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    // Le schéma est resserré sur le mode : en « ce soir », `period` ne peut valoir qu'`evening`,
    // et `totalDays` est figé. Ce que le prompt demandait sans être toujours suivi devient ici
    // impossible à enfreindre.
    output_config: {
      format: zodOutputFormat(
        claudeItinerarySchemaFor(
          request.mode,
          totalDaysForMode(request.mode, request.distance),
          candidates.map((c) => c.ref),
          process.env.VIBETRIP_CRENEAUX === "0" ? undefined : refsParCreneau(candidates)
        )
      ),
    },
    messages: [{ role: "user", content: buildUserPrompt(request, candidates) }],
  });
}

/** Les références ouvertes à chaque créneau — le schéma n'autorise qu'elles (voir `periodesOuvertes`). */
function refsParCreneau(candidates: PlaceCandidate[]): Record<Period, string[]> {
  const par: Record<Period, string[]> = { morning: [], midday: [], evening: [] };
  for (const c of candidates) for (const period of c.periods) par[period].push(c.ref);
  return par;
}

const LIBELLES_TYPE: Record<ItineraryStep["type"], string> = {
  restaurant: "Restaurant",
  bar: "Bar",
  cafe: "Café",
  museum: "Musée",
  park: "Parc",
  viewpoint: "Point de vue",
  activity: "Activité",
  shopping: "Boutique",
  nightlife: "Sortie de nuit",
  hotel: "Hôtel",
  transport: "Gare",
  other: "Lieu",
};

/**
 * La description d'un lieu dont aucune source ne dit rien : sa sorte et son adresse, et rien
 * d'autre. La consigne « n'invente aucune spécialité » n'était pas tenue (« ardoise qui change
 * chaque semaine » — l'exemple même de la consigne — sur un bar que personne n'a décrit) : le
 * partage du projet veut que les faits ne viennent jamais du modèle, on le rend donc impossible.
 * Plus sobre, et vrai.
 */
function descriptionFactuelle(type: ItineraryStep["type"], candidat: PlaceCandidate): string {
  // Le numéro et ce qui suit la première virgule (code postal, ville, pays) ne disent rien de plus.
  const rue = candidat.address?.split(",")[0]?.replace(/^\d+[\s,-]*(bis|ter)?\s*/i, "").trim();
  return rue ? `${LIBELLES_TYPE[type]}, ${rue}.` : `${LIBELLES_TYPE[type]}.`;
}

/**
 * Génère plusieurs propositions d'itinéraire via Claude en structured output (schéma Zod contraint côté API).
 * Une erreur de parsing déclenche une unique tentative de retry avant d'abandonner.
 * Les erreurs de l'API Anthropic (rate limit, indisponibilité, etc.) remontent telles
 * quelles pour que l'appelant les distingue via `instanceof Anthropic.APIError`.
 */
async function generateOne(
  request: GenerateItineraryRequest,
  angle: string,
  index: number,
  pool: Promise<PlaceCandidate[]>
): Promise<Itinerary> {
  // Le socle d'abord : le modèle compose parmi des lieux qui existent au lieu d'en inventer.
  // Une graine par proposition, sinon les trois angles piochent exactement les mêmes adresses.
  const candidates = await pool;

  let response = await requestItinerary(request, angle, false, candidates);

  if (!response.parsed_output) {
    response = await requestItinerary(request, angle, true, candidates);
  }

  if (!response.parsed_output) {
    throw new ItineraryParseError(
      "Claude n'a pas retourné un itinéraire au format attendu après deux tentatives."
    );
  }

  // Les identifiants sont attribués ici et non par le modèle : ils doivent être stables et
  // uniques pour servir de clés de sélection et de rendu, ce qu'un texte généré ne garantit pas.
  const servis: string[] = [];
  const steps: ItineraryStep[] = response.parsed_output.steps.map((step, stepIndex) => {
    const { ref, ...reste } = step;
    const base: ItineraryStep = { id: `p${index + 1}-step-${stepIndex + 1}`, ...reste };
    const candidat = choisirCandidat(base, ref, candidates);
    if (!candidat) return base;
    servis.push(candidat.id);
    return {
      ...base,
      placeName: candidat.name,
      // La description du modèle n'est gardée que s'il avait un fait sourcé à reformuler.
      description: candidat.reason ? base.description : descriptionFactuelle(base.type, candidat),
      location: candidat.location,
      address: candidat.address,
      verified: true,
      anchored: true,
      recognized: candidat.notoriety > 0,
      city: candidat.city,
      placeId: candidat.id,
    };
  });

  // Sans attendre : c'est une statistique d'usage, elle ne doit pas retarder la proposition.
  void notePropositions(servis);

  return { ...response.parsed_output, id: `proposal-${index + 1}`, steps };
}

async function candidatesFor(
  request: GenerateItineraryRequest,
  index: number,
  originPromise: Promise<GeoPoint | null>
): Promise<PlaceCandidate[]> {
  // Le socle s'interroge par proximité : il lui faut un point, et la ville saisie en toutes
  // lettres doit donc être géocodée **avant** la génération et non pendant, contrairement au
  // filtre de plausibilité. C'est le cas le plus fréquent en pratique — la géolocalisation du
  // navigateur exige un contexte sécurisé, donc elle est indisponible dès qu'on teste sur un
  // téléphone en réseau local. Sans socle utilisable ici, il ne servirait presque jamais.
  const origin = await originPromise;
  if (!origin) return [];

  return fetchCandidates({
    origin,
    mode: request.mode,
    distance: request.distance,
    themes: request.themes,
    seed: `p${index + 1}`,
    budget: request.budget,
    sheltered: request.sheltered,
  });
}

/**
 * Le lieu réel derrière ce que le modèle a écrit, ou `null` s'il n'a pas choisi dans la liste.
 *
 * C'est ici que l'inversion produit son effet : le nom, la coordonnée et l'adresse ne viennent
 * plus du modèle mais du socle, et l'étape est marquée vérifiée sans avoir à interroger qui que
 * ce soit. Une étape ancrée ne peut plus être un lieu inventé.
 *
 * Deux garde-fous. Le modèle garde **son** `type` : le socle classe « Boulangerie Pozzoli » en
 * restaurant, mais si le modèle l'a mise en café pour un petit-déjeuner, c'est son jugement qui
 * décrit l'étape. Et si la coordonnée qu'il a écrite s'éloigne trop de celle du lieu cité, on ne
 * substitue pas — il parlait probablement d'autre chose.
 */
function choisirCandidat(
  step: ItineraryStep,
  ref: string | null | undefined,
  candidates: PlaceCandidate[]
): PlaceCandidate | null {
  const trouve = resolveCandidate(ref, step.placeName, candidates);
  if (!trouve) return null;

  // Une référence citée est un choix explicite, et le schéma ne permet d'en citer que de
  // valides : on ne la refuse pas parce que les coordonnées recopiées sont approximatives.
  // C'est ce contrôle qui rejetait la moitié des étapes d'un voyage — sur 150 km de rayon, le
  // modèle recopie mal, et l'étape retombait sur ses propres coordonnées, non vérifiées.
  // Le contrôle de distance ne garde son sens que pour le rattrapage par le nom, où
  // l'homonymie est réelle (« Le Baron » désigne deux établissements à Paris).
  if (!trouve.parRef && ecartKm(trouve.candidat, step.location) > ECART_MAX_KM) return null;
  return trouve.candidat;
}

/**
 * Lance les propositions **en parallèle** — un appel par angle — et rend la liste des promesses
 * *sans les attendre*.
 *
 * C'est le point important : la fonction rendait autrefois `Promise<Itinerary[]>`, donc la route
 * ne pouvait rien livrer avant la fin de la génération la plus lente. Rendre les promesses telles
 * quelles laisse l'appelant émettre chaque proposition dès qu'elle arrive. Sur une soirée, la
 * première tombe vers 5-6 s au lieu de 9-11 s pour l'ensemble.
 *
 * Un seul appel produisant les trois itinéraires avait d'abord été essayé : bonnes propositions,
 * mais 2 min 10 sur un week-end — au-delà de la limite d'exécution de la plateforme.
 *
 * Aucune promesse n'est rejetée collectivement : l'appelant traite chacune séparément, pour
 * qu'une proposition en échec n'emporte pas les autres.
 */
export interface GenerationTasks {
  proposals: Promise<Itinerary>[];
  /** Le repérage, pour l'écran d'attente ; `null` sans point de départ ni socle (ou en mock). */
  scouting: Promise<Extract<GenerationEvent, { type: "scouting" }> | null>;
}

export function generateProposals(request: GenerateItineraryRequest): GenerationTasks {
  // Mock de développement (VIBETRIP_MOCK=1) : évite de consommer du crédit API pour itérer
  // sur l'interface. L'échelonnement est délibéré — un mock instantané ne ferait jamais passer
  // l'écran par son état d'attente partielle, qui est précisément ce qu'on veut pouvoir régler.
  if (process.env.VIBETRIP_MOCK === "1") {
    const mocks = buildMockItineraries(request);
    const proposals = Array.from(
      { length: proposalCountForMode(request.mode) },
      (_, index) =>
        new Promise<Itinerary>((resolve, reject) => {
          setTimeout(() => {
            mocks.then((itineraries) => resolve(itineraries[index]!)).catch(reject);
          }, 700 * (index + 1));
        })
    );
    return { proposals, scouting: Promise.resolve(null) };
  }

  // Résolu une seule fois et partagé : géocoder la même ville trois fois serait trois fois le
  // même aller-retour. La promesse est passée sans être attendue, pour ne pas retarder le
  // démarrage des générations dont le point est déjà connu.
  const origin: Promise<GeoPoint | null> =
    "lat" in request.location
      ? Promise.resolve(request.location)
      : geocodeCity(request.location.city);

  const angles = PROPOSAL_ANGLES.slice(0, proposalCountForMode(request.mode));
  // Les viviers sont tirés ici, une fois, et partagés : la même requête sert au repérage et à
  // la proposition, sans aller-retour de plus vers le socle.
  const pools = angles.map((_, index) => candidatesFor(request, index, origin));

  return {
    proposals: angles.map((angle, index) => generateOne(request, angle, index, pools[index]!)),
    scouting: Promise.all([origin, ...pools]).then(([point, ...viviers]) => {
      if (!point || !("lat" in point)) return null;
      const vus = new Map<string, PlaceCandidate>();
      for (const candidat of (viviers as PlaceCandidate[][]).flat()) vus.set(candidat.id, candidat);
      if (vus.size === 0) return null;
      return {
        type: "scouting" as const,
        origin: point,
        places: [...vus.values()].map((c) => ({ name: c.name, location: c.location, recognized: c.notoriety > 0 })),
      };
    }),
  };
}
