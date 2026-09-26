import Svg, { Circle, Path, Rect } from "react-native-svg";

import type { TripMode } from "@/types/itinerary";
import { colors } from "@/ui/theme";

/**
 * Icônes au trait, comme `components/ui/icons.tsx` du site — jamais d'emoji : un emoji change de
 * dessin selon l'appareil, ne se recolore pas et rend mal en petit.
 */
type IconProps = { size?: number; color?: string };

const stroke = (color: string) => ({ stroke: color, strokeWidth: 2, strokeLinecap: "square" as const, fill: "none" });

export function MoonIcon({ size = 20, color = colors.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" {...stroke(color)} />
    </Svg>
  );
}

export function CalendarIcon({ size = 20, color = colors.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="4" y="5" width="16" height="15" {...stroke(color)} />
      <Path d="M4 10h16M9 3v4M15 3v4" {...stroke(color)} />
    </Svg>
  );
}

export function SuitcaseIcon({ size = 20, color = colors.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="3" y="7" width="18" height="13" {...stroke(color)} />
      <Path d="M9 7V4h6v3M3 12h18" {...stroke(color)} />
    </Svg>
  );
}

export function PinIcon({ size = 18, color = colors.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 21s-6-5.6-6-10.5A6 6 0 0 1 18 10.5C18 15.4 12 21 12 21z" {...stroke(color)} />
      <Circle cx="12" cy="10.5" r="2.2" {...stroke(color)} />
    </Svg>
  );
}

export function StarIcon({ size = 28, filled, color = colors.accent }: IconProps & { filled: boolean }) {
  return (
    // `pointerEvents="none"` : sans lui, le dessin capte le toucher avant le bouton qui l'entoure,
    // et les étoiles paraissaient mortes (retour du 26/09/2026).
    <Svg width={size} height={size} viewBox="0 0 24 24" pointerEvents="none">
      <Path
        d="M12 3.5l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.8l6-.7z"
        stroke={filled ? color : colors.inkMute}
        strokeWidth={1.8}
        strokeLinejoin="miter"
        fill={filled ? color : "none"}
      />
    </Svg>
  );
}

export function CameraIcon({ size = 26, color = colors.paper }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 8h4l2-3h6l2 3h4v12H3z" {...stroke(color)} />
      <Circle cx="12" cy="13.5" r="3.5" {...stroke(color)} />
    </Svg>
  );
}

export function ModeIcon({ mode, size, color }: IconProps & { mode: TripMode }) {
  if (mode === "tonight") return <MoonIcon size={size} color={color} />;
  if (mode === "weekend") return <CalendarIcon size={size} color={color} />;
  return <SuitcaseIcon size={size} color={color} />;
}

/** Aller : la flèche de navigation — l'action principale d'une étape. */
export function GoIcon({ size = 22, color = colors.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" pointerEvents="none">
      <Path d="M4 11.5 20 4l-7.5 16-2-6.5z" stroke={color} strokeWidth={2} strokeLinejoin="miter" fill="none" />
    </Svg>
  );
}

export function PhoneIcon({ size = 22, color = colors.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" pointerEvents="none">
      <Path d="M6 3h3.5l1.5 4.5-2.2 1.4a11 11 0 0 0 6.3 6.3l1.4-2.2L21 14.5V18a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z" {...stroke(color)} />
    </Svg>
  );
}

export function GlobeIcon({ size = 22, color = colors.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" pointerEvents="none">
      <Circle cx="12" cy="12" r="8.5" {...stroke(color)} />
      <Path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.3 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.3-3.8-8.5S9.4 5.9 12 3.5z" {...stroke(color)} />
    </Svg>
  );
}

export function SwapIcon({ size = 22, color = colors.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" pointerEvents="none">
      <Path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4" {...stroke(color)} />
    </Svg>
  );
}
