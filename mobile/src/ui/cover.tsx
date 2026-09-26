import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, G, Path, Polyline, Rect, Text as SvgText } from "react-native-svg";

import { PrimaryButton } from "@/ui/kit";
import { Paper } from "@/ui/paper";
import { colors, fonts, rule } from "@/ui/theme";

/**
 * Page de garde — comme sur le site : l'écran de réglages ouvrait directement sur trois curseurs
 * sans jamais dire ce que fait le produit. Même composition, en trois registres : le nom, qui
 * occupe la colonne ; l'accroche, qui tient ce qu'elle promet ; le dessin d'un parcours, seule
 * image de l'application, qui montre littéralement ce que l'accroche affirme.
 */
export function Cover({ onStart }: { onStart: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // Le nom occupe la colonne (reproche du 27/08 : il n'en prenait que 55 %), plafonné par la hauteur.
  const titleSize = Math.min(width * 0.23, height * 0.12, 104);
  // Le dessin n'a sa place que si l'écran est assez haut — seuil mesuré sur le site, pas deviné.
  const showSketch = height >= 660;

  return (
    <Paper style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, paddingHorizontal: 24 }]}>
      {/* Interlignage large : sur iPhone, Anton dépasse de sa boîte au-dessus des capitales, et le
          titre sortait coupé en haut avec l'interlignage serré du site (retour du 26/09/2026). */}
      <Text style={[styles.title, { fontSize: titleSize, lineHeight: Math.round(titleSize * 1.28) }]} adjustsFontSizeToFit numberOfLines={1}>
        Vibetrip
      </Text>
      <Text style={styles.question}>On sort où ?</Text>
      <View style={styles.band}>
        <Text style={styles.bandText}>Ce soir · Week-end · Voyage</Text>
      </View>

      <View style={{ marginTop: 20, gap: 12 }}>
        <View style={{ borderTopWidth: rule.major, borderColor: colors.ink }} />
        <Text style={[styles.hook, { color: colors.ink }]}>On ne te donne pas des idées.</Text>
        <Text style={[styles.hook, { color: colors.blue }]}>On te donne un itinéraire.</Text>
        <View style={{ borderTopWidth: rule.major, borderColor: colors.ink }} />
      </View>

      <View style={{ flex: 1, justifyContent: "center", paddingVertical: 12 }}>{showSketch && <RouteSketch />}</View>

      <PrimaryButton label="Commencer" onPress={onStart} />
      <Text style={styles.note}>Sans compte, sans inscription</Text>
    </Paper>
  );
}

/** Quatre étapes reliées par un trait interrompu, sur un fragment de ville traversé d'un cours d'eau. */
function RouteSketch() {
  const stops = [
    { x: 46, y: 146, n: "1" },
    { x: 116, y: 92, n: "2" },
    { x: 196, y: 112, n: "3" },
    { x: 282, y: 44, n: "4" },
  ];
  return (
    <Svg width="100%" height="100%" viewBox="0 0 340 190" preserveAspectRatio="xMidYMid meet">
      <G fill={colors.paper3}>
        <Rect x="14" y="24" width="62" height="40" />
        <Rect x="96" y="14" width="44" height="30" />
        <Rect x="232" y="96" width="70" height="46" />
        <Rect x="40" y="150" width="52" height="28" />
      </G>
      {/* Rivière amaigrie à 10 px : plus épaisse que le parcours, elle inversait la lecture. */}
      <Path d="M-12 46 C 70 30, 96 118, 178 132 S 292 152, 352 108" fill="none" stroke={colors.blue} strokeWidth={10} />
      <Polyline points="46,146 116,92 196,112 282,44" fill="none" stroke={colors.ink} strokeWidth={4} strokeLinecap="square" strokeDasharray="11 8" />
      {stops.map((stop) => (
        <G key={stop.n}>
          <Circle cx={stop.x} cy={stop.y} r={17} fill={colors.accent} stroke={colors.ink} strokeWidth={2.5} />
          <SvgText x={stop.x} y={stop.y + 7} textAnchor="middle" fill={colors.paper} fontFamily={fonts.display} fontSize={19}>
            {stop.n}
          </SvgText>
        </G>
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  // Encre pleine et non vermillon : le vermillon reste au seul bouton, repère d'action.
  title: { fontFamily: fonts.display, color: colors.ink, textTransform: "uppercase" },
  question: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.inkSoft, textTransform: "uppercase" },
  band: { alignSelf: "flex-start", marginTop: 14, backgroundColor: colors.ink, paddingHorizontal: 14, paddingVertical: 8, transform: [{ rotate: "-0.6deg" }] },
  bandText: { fontFamily: fonts.bodyHeavy, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: colors.paper },
  hook: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, textTransform: "uppercase" },
  note: { marginTop: 10, textAlign: "center", fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
});
