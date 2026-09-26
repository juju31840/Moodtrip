import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

import { vibeLabel, type VibeKey } from "@shared/vibe-labels";
import { colors, fonts, rule } from "@/ui/theme";

const STEPS = 5;

/**
 * Les réglages en pictogrammes. Deux versions ont précédé : cinq cases (« juste un carré rouge »),
 * puis un curseur à crans (« pas mal, mais encore trop IA » — un formulaire comme tous les
 * formulaires). Ici chaque réglage se **voit** :
 * - le budget, en « € » qui se remplissent — un pour « fauché », cinq pour « sans compter » ;
 * - l'ambiance, en barres d'égaliseur qui montent ;
 * - la distance, en cinq étapes d'un trajet — à pied, le quartier, la ville, les environs, loin —
 *   reliées par le trait du parcours, vermillon jusqu'à celle qu'on choisit.
 *
 * On touche un pictogramme ou on balaie la rangée du doigt, avec un retour haptique par palier.
 * Le mot au-dessus reste la consigne envoyée au modèle (`vibeLabel`, même fonction).
 */
export function VibeSlider({ kind, label, value, onChange }: {
  kind: VibeKey;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.round(value / 25);
  const last = useRef(index);
  const widthRef = useRef(0);
  // Le geste est créé une fois : il lit la valeur et le rappel à jour par ces références.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  function stepAt(x: number): number {
    const cell = Math.max(1, widthRef.current / STEPS);
    return Math.min(STEPS - 1, Math.max(0, Math.floor(x / cell)));
  }

  function commit(step: number) {
    if (step === last.current) return;
    last.current = step;
    void Haptics.selectionAsync();
    onChangeRef.current(step * 25);
  }

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Le geste reste au réglage une fois commencé : sinon le défilement de la page le reprend.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        last.current = Math.round(valueRef.current / 25);
        commit(stepAt(event.nativeEvent.locationX));
      },
      onPanResponderMove: (event) => commit(stepAt(event.nativeEvent.locationX)),
    })
  ).current;

  function onLayout(event: LayoutChangeEvent) {
    widthRef.current = event.nativeEvent.layout.width;
    setWidth(event.nativeEvent.layout.width);
  }

  const cell = width / STEPS;

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.word}>{vibeLabel(kind, value)}</Text>
      </View>

      <View
        onLayout={onLayout}
        style={styles.row}
        {...responder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: vibeLabel(kind, value) }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) => {
          const next = event.nativeEvent.actionName === "increment" ? Math.min(STEPS - 1, index + 1) : Math.max(0, index - 1);
          onChange(next * 25);
        }}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {kind === "distance" && width > 0 && <RouteLine width={width} cell={cell} index={index} />}
          <View style={styles.cells}>
            {Array.from({ length: STEPS }, (_, step) => (
              <View key={step} style={styles.cell}>
                {kind === "budget" && <Euro on={step <= index} />}
                {kind === "ambiance" && <Bar step={step} on={step <= index} />}
                {kind === "distance" && <Place step={step} on={step === index} />}
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const OFF = "rgba(110, 108, 117, 0.35)";

function Euro({ on }: { on: boolean }) {
  return <Text style={[styles.euro, { color: on ? colors.accent : OFF }]}>€</Text>;
}

/** Une barre d'égaliseur, de plus en plus haute : l'ambiance qui monte. */
function Bar({ step, on }: { step: number; on: boolean }) {
  const height = 12 + step * 9;
  return <View style={[styles.bar, { height }, on ? { backgroundColor: colors.accent, borderColor: colors.accent } : { borderColor: OFF }]} />;
}

/** Le trait du parcours qui relie les cinq distances, vermillon jusqu'à celle choisie. */
function RouteLine({ width, cell, index }: { width: number; cell: number; index: number }) {
  const y = 28;
  const start = cell / 2;
  const chosen = cell / 2 + index * cell;
  const end = width - cell / 2;
  return (
    <Svg width={width} height={56} style={StyleSheet.absoluteFill}>
      <Line x1={start} y1={y} x2={end} y2={y} stroke={OFF} strokeWidth={2} strokeDasharray="5 5" />
      {index > 0 && <Line x1={start} y1={y} x2={chosen} y2={y} stroke={colors.accent} strokeWidth={3} strokeDasharray="7 5" />}
    </Svg>
  );
}

/** Cinq pictogrammes de distance, sur fond papier pour masquer le trait qui passe dessous. */
function Place({ step, on }: { step: number; on: boolean }) {
  const color = on ? colors.accent : colors.inkSoft;
  const p = { stroke: color, strokeWidth: 2, fill: "none", strokeLinecap: "square" as const, strokeLinejoin: "miter" as const };
  return (
    <View style={[styles.place, on && { borderColor: colors.accent }]}>
      <Svg width={26} height={26} viewBox="0 0 24 24">
        {step === 0 && (
          // À pied : un marcheur.
          <>
            <Circle cx="13" cy="4.5" r="2" {...p} />
            <Path d="M12 8l-2 6 3 3v4M12 8l3 4 3 1M10 14l-3 7M11 9l-3 2-1 3" {...p} />
          </>
        )}
        {step === 1 && (
          // Le quartier : une maison.
          <Path d="M4 11l8-6 8 6M6 9.5V20h12V9.5M10 20v-5h4v5" {...p} />
        )}
        {step === 2 && (
          // Toute la ville : des immeubles.
          <>
            <Rect x="3" y="9" width="6" height="11" {...p} />
            <Rect x="9" y="4" width="7" height="16" {...p} />
            <Rect x="16" y="11" width="5" height="9" {...p} />
            <Path d="M12 8h1M12 12h1M12 16h1" {...p} />
          </>
        )}
        {step === 3 && (
          // Les environs : un arbre et une colline.
          <>
            <Path d="M2 20c4-6 8-6 12 0M8 20h14" {...p} />
            <Circle cx="17" cy="8" r="4" {...p} />
            <Path d="M17 12v8" {...p} />
          </>
        )}
        {step === 4 && (
          // Loin : un train.
          <>
            <Rect x="6" y="3" width="12" height="14" {...p} />
            <Path d="M6 10h12M9 20l-2 2M15 20l2 2M9 14h.5M14.5 14h.5" {...p} />
          </>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontFamily: fonts.bodyHeavy, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase", color: colors.inkSoft },
  word: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.ink, textTransform: "uppercase" },
  row: { height: 56 },
  cells: { flex: 1, flexDirection: "row" },
  cell: { flex: 1, alignItems: "center", justifyContent: "flex-end", paddingBottom: 6 },
  euro: { fontFamily: fonts.display, fontSize: 38, lineHeight: 46 },
  bar: { width: 18, borderWidth: rule.thin },
  place: { width: 40, height: 40, marginBottom: 2, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper, borderWidth: rule.thin, borderColor: "transparent" },
});
