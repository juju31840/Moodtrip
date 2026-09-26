import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { VIBE_LABELS, vibeLabel, type VibeKey } from "@shared/vibe-labels";
import { colors, fonts, printShadow, rule } from "@/ui/theme";

const STEPS = 5;
const THUMB = 28;

/**
 * Le curseur de réglage, dessiné comme sur la maquette « Riso » : un filet d'encre à cinq crans,
 * la partie parcourue en vermillon, une poignée carrée à l'ombre décalée. Il remplace cinq cases
 * juxtaposées (« juste un carré rouge, c'est moyen », 26/09/2026).
 *
 * Il se glisse au doigt **et** se touche à un cran, avec un retour haptique à chaque palier — le
 * mot au-dessus change avec lui, et c'est ce mot, pas une position, qui est la consigne envoyée au
 * modèle (`vibeLabel` indexe les deux par la même fonction). Les deux extrêmes sont écrits sous la
 * piste : on sait dans quel sens on va avant de bouger.
 */
export function VibeSlider({ kind, label, value, onChange }: {
  kind: VibeKey;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const index = Math.round(value / 25);
  const last = useRef(index);
  const widthRef = useRef(0);
  // Le geste est créé une fois : il lit la valeur et le rappel à jour par ces références, sinon
  // il repartirait de la valeur du premier rendu.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  const words = VIBE_LABELS[kind];

  function stepAt(x: number): number {
    const usable = Math.max(1, widthRef.current - THUMB);
    return Math.min(STEPS - 1, Math.max(0, Math.round(((x - THUMB / 2) / usable) * (STEPS - 1))));
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
      // Le curseur garde le geste une fois commencé : sans cela, le défilement vertical de la
      // page le lui reprend au moindre écart du doigt.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        setDragging(true);
        last.current = Math.round(valueRef.current / 25);
        commit(stepAt(event.nativeEvent.locationX));
      },
      onPanResponderMove: (event) => commit(stepAt(event.nativeEvent.locationX)),
      onPanResponderRelease: () => setDragging(false),
      onPanResponderTerminate: () => setDragging(false),
    })
  ).current;

  function onLayout(event: LayoutChangeEvent) {
    widthRef.current = event.nativeEvent.layout.width;
    setWidth(event.nativeEvent.layout.width);
  }

  const usable = Math.max(0, width - THUMB);
  const x = (index / (STEPS - 1)) * usable;

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.head}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <VibeIcon kind={kind} />
          <Text style={styles.label}>{label}</Text>
        </View>
        <Text style={styles.word}>{vibeLabel(kind, value)}</Text>
      </View>

      <View
        onLayout={onLayout}
        style={styles.track}
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
          {/* Le filet, puis la partie parcourue en vermillon. */}
          <View style={[styles.line, { left: THUMB / 2, right: THUMB / 2 }]} />
          <View style={[styles.filled, { left: THUMB / 2, width: x }]} />
          {/* Les cinq crans, qui disent qu'il n'y a que cinq réglages possibles. */}
          {Array.from({ length: STEPS }, (_, step) => (
            <View
              key={step}
              style={[styles.tick, { left: THUMB / 2 + (step / (STEPS - 1)) * usable - 1 }, step <= index && { backgroundColor: colors.accent }]}
            />
          ))}
          <View style={[styles.thumb, printShadow, { left: x }, dragging && { backgroundColor: colors.accent, borderColor: colors.ink }]} />
        </View>
      </View>

      <View style={styles.ends}>
        <Text style={styles.end}>{words[0]}</Text>
        <Text style={styles.end}>{words[words.length - 1]}</Text>
      </View>
    </View>
  );
}

/** Un pictogramme par réglage, au trait, comme les icônes du site. */
function VibeIcon({ kind }: { kind: VibeKey }) {
  const common = { stroke: colors.inkSoft, strokeWidth: 2, fill: "none", strokeLinecap: "square" as const };
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      {kind === "budget" && <Path d="M17 6.5A7 7 0 1 0 17 17.5M4 10h9M4 14h9" {...common} />}
      {kind === "ambiance" && <Path d="M4 14v-4M9 18V6M14 16V8M19 13v-2" {...common} />}
      {kind === "distance" && (
        <>
          <Circle cx="6" cy="18" r="2.5" {...common} />
          <Path d="M8.5 17.5c6-1 3-7 8-8.5M16 5l3 3.5L15.5 11" {...common} />
        </>
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontFamily: fonts.bodyHeavy, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase", color: colors.inkSoft },
  word: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.ink, textTransform: "uppercase" },
  track: { height: 40, justifyContent: "center" },
  line: { position: "absolute", top: 19, height: rule.thin, backgroundColor: colors.ink },
  filled: { position: "absolute", top: 18, height: 4, backgroundColor: colors.accent },
  tick: { position: "absolute", top: 13, width: 2, height: 14, backgroundColor: colors.ink },
  thumb: { position: "absolute", top: 6, width: THUMB, height: THUMB, backgroundColor: colors.paper, borderWidth: 3, borderColor: colors.ink },
  ends: { flexDirection: "row", justifyContent: "space-between" },
  end: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.4, color: colors.inkMute },
});
