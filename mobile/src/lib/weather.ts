import type { GeoPoint } from "@/types/itinerary";

/**
 * La pluie annoncée sur les heures de la sortie — Open-Meteo, gratuit et sans clé.
 *
 * Elle ne décide rien : elle **propose** (idée de Jules, 26/09/2026) de rester à couvert, et la
 * personne peut refuser, auquel cas on garde l'itinéraire tel quel. Seuil volontairement franc —
 * au moins 60 % de probabilité et un vrai cumul — : une bruine incertaine ne mérite pas qu'on
 * interrompe quelqu'un qui regarde ses idées.
 */
export interface RainForecast {
  /** Heure (0-23, heure de Paris) où la probabilité est la plus forte. */
  hour: number;
  probability: number;
}

export async function rainDuring(point: GeoPoint, start: Date, hours: number): Promise<RainForecast | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${point.lat.toFixed(3)}&longitude=${point.lng.toFixed(3)}` +
      "&hourly=precipitation_probability,precipitation&timezone=Europe%2FParis&forecast_days=4";
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const data = (await response.json()) as { hourly?: { time: string[]; precipitation_probability: number[]; precipitation: number[] } };
    const hourly = data.hourly;
    if (!hourly) return null;
    // Les heures d'Open-Meteo sont locales (Paris), sans fuseau : on compare en heure de Paris.
    const local = (date: Date) =>
      new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit" })
        .format(date)
        .replace(" ", "T")
        .slice(0, 13);
    const from = local(start);
    const to = local(new Date(start.getTime() + hours * 3600_000));
    let best: RainForecast | null = null;
    let total = 0;
    hourly.time.forEach((time, index) => {
      const key = time.slice(0, 13);
      if (key < from || key > to) return;
      total += hourly.precipitation[index] ?? 0;
      const probability = hourly.precipitation_probability[index] ?? 0;
      if (!best || probability > best.probability) best = { hour: Number(time.slice(11, 13)), probability };
    });
    const found = best as RainForecast | null;
    return found && found.probability >= 60 && total >= 0.5 ? found : null;
  } catch {
    // Pas de réseau ou service indisponible : on ne dit rien plutôt que d'inventer une averse.
    return null;
  }
}

/** Le début d'une sortie : l'heure choisie pour un soir, le samedi 10 h pour un week-end. */
export function outingWindow(mode: "tonight" | "weekend" | "trip", startAt?: string): { start: Date; hours: number } | null {
  if (mode === "tonight") return { start: startAt ? new Date(startAt) : new Date(), hours: 4 };
  if (mode === "weekend") {
    const saturday = new Date();
    saturday.setDate(saturday.getDate() + ((6 - saturday.getDay() + 7) % 7));
    saturday.setHours(10, 0, 0, 0);
    return { start: saturday, hours: 36 };
  }
  // Un voyage de plusieurs jours n'est pas dit « sous la pluie » sur la foi d'une prévision.
  return null;
}
