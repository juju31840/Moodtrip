/**
 * Cinq paliers et non trois. Avec trois, le palier central couvrait un tiers de la course du
 * curseur : on pouvait le déplacer longuement sans que le mot affiché ne bouge, ce qui donnait
 * l'impression d'un réglage sans effet. Cinq paliers de 25 points font changer le mot à chaque
 * cran, et le curseur avance désormais par pas de 25 (components/ui/Slider.tsx) : chaque
 * position possible correspond exactement à un palier.
 *
 * Module à part pour que `lib/distance.ts` puisse s'en servir sans importer tout le prompt.
 */
export const LEVEL_COUNT = 5;

export function levelIndex(value: number): number {
  const clamped = Math.min(100, Math.max(0, value));
  return Math.min(LEVEL_COUNT - 1, Math.round((clamped / 100) * (LEVEL_COUNT - 1)));
}
