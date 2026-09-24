/**
 * Direction « Riso », reprise du site (`tailwind.config.ts`) — mêmes valeurs, mêmes règles :
 * - aucun angle arrondi, aucune ombre diffuse : des filets noirs de 2 px (3 px pour les
 *   séparations majeures), et pour seul relief un décalage net de 3 px ;
 * - vermillon = l'action et la sélection, jamais décoratif ;
 * - outremer = le factuel et le confirmé.
 */
export const colors = {
  paper: "#E7E5DF",
  paper2: "#DBD9D2",
  paper3: "#CFCDC5",
  ink: "#17161A",
  inkSoft: "#56545C",
  inkMute: "#6E6C75",
  accent: "#DD3B2E",
  accentDeep: "#B32C21",
  blue: "#2B44A8",
} as const;

export const fonts = {
  display: "Anton_400Regular",
  body: "Archivo_400Regular",
  bodyBold: "Archivo_700Bold",
  bodyHeavy: "Archivo_800ExtraBold",
} as const;

export const rule = { thin: 2, major: 3 } as const;

/** Le seul relief du système : un décalage net, jamais un flou. */
export const printShadow = {
  shadowColor: colors.ink,
  shadowOffset: { width: 3, height: 3 },
  shadowOpacity: 1,
  shadowRadius: 0,
} as const;
