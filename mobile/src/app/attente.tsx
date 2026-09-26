import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { cancelGeneration, useGeneration } from "@/lib/generation";
import { Body, Display, IconButton, Overline, PrimaryButton } from "@/ui/kit";
import { ScoutingMap } from "@/ui/scouting-map";
import { Paper } from "@/ui/paper";
import { colors, fonts, rule } from "@/ui/theme";

/**
 * Attente. Dès que le serveur a envoyé le repérage (~0,3 s), la carte du quartier et les
 * adresses examinées remplissent l'écran ; avant cela, et si le socle n'a rien rendu, le titre
 * seul. La première idée ouvre l'écran de choix, sans attendre les autres.
 */
export default function AttenteScreen() {
  const insets = useSafeAreaInsets();
  const { status, expected, proposals, scouting, approxOrigin, error } = useGeneration();

  useEffect(() => {
    if (proposals.length > 0) router.replace("/propositions");
  }, [proposals.length]);

  const slots = Math.max(expected, 3);
  const recognized = scouting?.places.filter((place) => place.recognized) ?? [];
  const names = (recognized.length >= 4 ? recognized : scouting?.places ?? []).slice(0, 14).map((place) => place.name);

  const cancel = (
    <IconButton
      label="Annuler"
      glyph="✕"
      onPress={() => {
        cancelGeneration();
        router.back();
      }}
      style={{ position: "absolute", top: insets.top + 8, left: 16 }}
    />
  );

  if (status === "error") {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 72, paddingHorizontal: 20, gap: 16 }]}>
        {cancel}
        <Display size={40} color={colors.accent}>Ça n’a pas marché</Display>
        <Body>{error ?? "La génération a échoué."}</Body>
        <PrimaryButton label="Revenir aux réglages" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <Paper style={styles.screen}>
      <View style={styles.map}>
        <ScoutingMap origin={scouting?.origin ?? approxOrigin} places={scouting?.places ?? []} />
        {cancel}
        <View style={[styles.badge, { top: insets.top + 18 }]}>
          <Overline color={colors.paper}>Repérage</Overline>
        </View>
      </View>

      {names.length > 0 && <Ticker text={names.join(" · ")} />}

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
        <Display size={34} color={colors.accent}>
          {scouting ? `On regarde ${scouting.places.length} adresses` : "On te compose ça"}
        </Display>
        {scouting && (
          <Body>
            {recognized.length > 0
              ? `Dont ${recognized.length} reconnues — presse, guides ou institutions locales : les points rouges.`
              : "Tous des lieux qui existent, vérifiés dans notre base."}
          </Body>
        )}
        <View style={styles.progress}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {Array.from({ length: slots }, (_, index) => (
              <View key={index} style={[styles.slot, index < proposals.length && styles.slotDone]} />
            ))}
          </View>
          <Overline>La première idée s’ouvre dès qu’elle est prête</Overline>
        </View>
      </View>
    </Paper>
  );
}

/** Bandeau des lieux recommandés, qui défile en boucle — immobile si les animations sont réduites. */
function Ticker({ text }: { text: string }) {
  const offset = useRef(new Animated.Value(0)).current;
  // La largeur n'est connue qu'après le premier rendu : l'animation part quand elle l'est.
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || width === 0) return;
      offset.setValue(0);
      loop = Animated.loop(
        Animated.timing(offset, { toValue: -width, duration: width * 28, easing: Easing.linear, useNativeDriver: true })
      );
      loop.start();
    });
    return () => loop?.stop();
  }, [offset, width]);

  return (
    <View style={styles.ticker}>
      <Animated.View style={{ flexDirection: "row", transform: [{ translateX: offset }] }}>
        <Text
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          style={styles.tickerText}
        >
          {text} ·{" "}
        </Text>
        <Text style={styles.tickerText}>
          {text} ·{" "}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  map: { flex: 1 },
  badge: { position: "absolute", right: 16, backgroundColor: colors.ink, paddingHorizontal: 8, paddingVertical: 5 },
  ticker: { height: 40, backgroundColor: colors.ink, justifyContent: "center", overflow: "hidden", borderTopWidth: rule.major, borderColor: colors.ink },
  // `flexShrink: 0` : le texte doit pouvoir dépasser l'écran pour défiler, pas être tronqué.
  tickerText: { flexShrink: 0, fontFamily: fonts.bodyHeavy, fontSize: 13, letterSpacing: 1, textTransform: "uppercase", color: colors.paper, paddingLeft: 16 },
  bottom: { paddingHorizontal: 20, paddingTop: 18, gap: 8 },
  progress: { marginTop: 16, gap: 12, borderTopWidth: rule.thin, borderColor: colors.ink, paddingTop: 14 },
  slot: { flex: 1, height: 12, borderWidth: rule.thin, borderColor: colors.ink, backgroundColor: colors.paper2 },
  slotDone: { backgroundColor: colors.accent, borderColor: colors.accent },
});
