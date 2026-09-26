import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { findProposal } from "@/lib/generation";
import { itineraryStore } from "@/lib/storage";
import { Body, Display, IconButton, PrimaryButton } from "@/ui/kit";
import { RouteMap } from "@/ui/route-map";
import { StepList } from "@/ui/step-list";
import { colors, rule } from "@/ui/theme";

/**
 * Détail d'une proposition — c'est ici seulement qu'on valide. La validation range la sortie
 * dans « Sorties » et y conduit : l'écran d'arrivée ressemblant à celui qu'on quitte, rien ne
 * dirait sinon que l'itinéraire a été rangé quelque part.
 */
export default function PropositionScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const proposal = findProposal(id);
  const [activeId, setActiveId] = useState<string | null>(null);

  if (!proposal) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 12, paddingHorizontal: 20, gap: 16 }]}>
        <IconButton label="Revenir" glyph="←" onPress={() => router.back()} />
        <Body>Cette proposition n’est plus disponible.</Body>
      </View>
    );
  }

  function validate() {
    const saved = itineraryStore.save(proposal!);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.dismissAll();
    router.navigate("/sorties");
    router.push({ pathname: "/sortie/[id]", params: { id: saved.id, just: "1" } });
  }

  return (
    <View style={styles.screen}>
      <View style={styles.map}>
        <RouteMap steps={proposal.steps} activeId={activeId} onSelect={setActiveId} />
        <IconButton label="Revenir aux propositions" glyph="←" onPress={() => router.back()} style={{ position: "absolute", top: insets.top + 8, left: 16 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24 }}>
        <Display size={32} color={colors.accent}>{proposal.tripName}</Display>
        <Body style={{ marginTop: 6, marginBottom: 12 }}>{proposal.summary}</Body>
        <StepList steps={proposal.steps} showDay={proposal.totalDays > 1} activeId={activeId} onSelect={setActiveId} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <PrimaryButton label="Valider cet itinéraire" onPress={validate} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  map: { height: "36%", borderBottomWidth: rule.major, borderColor: colors.ink },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: rule.thin, borderColor: colors.ink, backgroundColor: colors.paper },
});
