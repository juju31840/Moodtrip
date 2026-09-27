import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { THEMES, themeForType } from "@shared/themes";
import { findNearby } from "@/lib/nearby";
import type { ItineraryStep, ThemeId } from "@/types/itinerary";
import { Body, Chip, Display, Overline } from "@/ui/kit";
import { colors, fonts, rule } from "@/ui/theme";

/**
 * Remplacer une étape. On remplace presque toujours un bar par un bar : la liste s'ouvre sur la
 * même envie, et les six envies restent derrière « Autre envie » — six étiquettes au-dessus
 * d'une liste la repoussaient sous la ligne de flottaison (revue du site, 24/09/2026). Rien ne
 * change tant qu'on n'a pas choisi.
 */
export function ChangePanel({ step, excludeNames, onPick }: {
  step: ItineraryStep;
  excludeNames: string[];
  onPick: (replacement: ItineraryStep) => void;
}) {
  const [theme, setTheme] = useState<ThemeId>(() => themeForType(step.type));
  const [otherTheme, setOtherTheme] = useState(false);
  // `undefined` = en cours, `null` = pas de réponse (hors réseau), `[]` = rien à proximité.
  const [results, setResults] = useState<ItineraryStep[] | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setResults(undefined);
    void findNearby(theme, step, excludeNames).then((found) => {
      // Une réponse arrivée après un changement d'envie est ignorée plutôt qu'affichée à tort.
      if (!cancelled) setResults(found);
    });
    return () => {
      cancelled = true;
    };
    // `excludeNames` change d'identité à chaque rendu : l'envie et l'étape décrivent la recherche.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, step.id]);

  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <Overline color={colors.ink}>{THEMES.find((item) => item.id === theme)?.label} · à proximité</Overline>
        {!otherTheme && (
          <Pressable accessibilityRole="button" onPress={() => setOtherTheme(true)} hitSlop={8}>
            <Text style={styles.link}>Autre envie</Text>
          </Pressable>
        )}
      </View>
      {otherTheme && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {THEMES.map((item) => (
            <Chip key={item.id} label={item.label} selected={theme === item.id} onPress={() => setTheme(item.id)} />
          ))}
        </View>
      )}
      {results === undefined && <Body>Recherche…</Body>}
      {results === null && <Body>Pas de connexion. Réessaie une fois en ligne.</Body>}
      {results?.length === 0 && <Body>Rien de ce type dans les environs immédiats.</Body>}
      {results?.map((candidate) => (
        <Pressable key={candidate.id} onPress={() => onPick(candidate)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.paper2 }]}>
          <Display size={18}>{candidate.placeName}</Display>
          <Body>{candidate.description}</Body>
          {candidate.recognized && <Overline color={colors.blue}>★ Adresse reconnue</Overline>}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: rule.thin, borderStyle: "dashed", borderColor: colors.inkMute, padding: 12, gap: 10, marginBottom: 8 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  link: { fontFamily: fonts.bodyHeavy, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", color: colors.inkSoft, textDecorationLine: "underline" },
  row: { borderWidth: rule.thin, borderColor: colors.ink, padding: 10, gap: 4 },
});
