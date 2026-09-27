import * as Sentry from "@sentry/react-native";

/**
 * Suivi des plantages. Inactif tant que `EXPO_PUBLIC_SENTRY_DSN` n'est pas fourni : en
 * développement et dans Expo Go, rien ne part.
 *
 * Réglé pour ne rien envoyer de personnel, conformément à la page de confidentialité : pas
 * d'adresse IP ni d'identifiant (`sendDefaultPii: false`), pas d'enregistrement d'écran, et les
 * fils d'Ariane réseau sont retirés — leurs URL portent des coordonnées (météo, recherche de
 * villes). Une trace de pile suffit à corriger un plantage ; on n'a pas besoin de savoir où était
 * la personne.
 */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initMonitoring() {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    sendDefaultPii: false,
    enabled: !__DEV__,
    tracesSampleRate: 0,
    beforeBreadcrumb: (breadcrumb) => (breadcrumb.category === "fetch" || breadcrumb.category === "xhr" ? null : breadcrumb),
  });
}

export const wrapRoot = Sentry.wrap;
