import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { cancelGeneration, useGeneration } from "@/lib/generation";
import { Body, Display, IconButton, Overline, PrimaryButton } from "@/ui/kit";
import { colors, rule } from "@/ui/theme";

/**
 * Attente. Squelette : les trois cases qui se remplissent, comme sur le site.
 *
 * La version dessinée (maquette « Repérage ») montrera la carte du quartier et les adresses
 * réellement examinées — le serveur les connaît en ~0,3 s, bien avant la première proposition.
 * Il faut pour cela un événement de plus dans le flux (`scouting`), à ajouter côté route.
 */
export default function AttenteScreen() {
  const insets = useSafeAreaInsets();
  const { status, expected, proposals, error } = useGeneration();

  // La première idée ouvre l'écran de choix : on n'attend pas les autres.
  useEffect(() => {
    if (proposals.length > 0) router.replace("/propositions");
  }, [proposals.length]);

  const slots = Math.max(expected, 3);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}>
      <IconButton
        label="Annuler"
        glyph="✕"
        onPress={() => {
          cancelGeneration();
          router.back();
        }}
      />

      {status === "error" ? (
        <View style={{ gap: 16, marginTop: 28 }}>
          <Display size={40} color={colors.accent}>Ça n’a pas marché</Display>
          <Body>{error ?? "La génération a échoué."}</Body>
          <PrimaryButton label="Revenir aux réglages" onPress={() => router.back()} />
        </View>
      ) : (
        <>
          <Display size={46} color={colors.accent} style={{ marginTop: 28 }}>
            On te compose ça
          </Display>
          <View style={styles.bottom}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {Array.from({ length: slots }, (_, index) => (
                <View key={index} style={[styles.slot, index < proposals.length && styles.slotDone]} />
              ))}
            </View>
            <Overline>La première idée s’ouvre dès qu’elle est prête</Overline>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: 20 },
  bottom: { marginTop: "auto", gap: 12, borderTopWidth: rule.thin, borderColor: colors.ink, paddingTop: 14 },
  slot: { flex: 1, height: 12, borderWidth: rule.thin, borderColor: colors.ink, backgroundColor: colors.paper2 },
  slotDone: { backgroundColor: colors.accent, borderColor: colors.accent },
});
