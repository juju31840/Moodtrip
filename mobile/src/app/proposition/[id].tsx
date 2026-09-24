import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { findProposal } from "@/lib/generation";
import { itineraryStore } from "@/lib/storage";
import type { ItineraryStep } from "@/types/itinerary";
import { Body, Display, IconButton, Overline, PrimaryButton } from "@/ui/kit";
import { RouteMap } from "@/ui/route-map";
import { colors, fonts, rule } from "@/ui/theme";

const PERIOD = { morning: "Matin", midday: "Midi", evening: "Soir" } as const;

/**
 * La fin de la boucle, c'est que l'utilisateur **s'y rende vraiment** : chaque étape s'ouvre
 * dans Plans, sur le nom et l'adresse réels tirés du socle.
 */
function openInMaps(step: ItineraryStep) {
  const query = encodeURIComponent([step.placeName, step.address].filter(Boolean).join(", "));
  void Linking.openURL(`https://maps.apple.com/?q=${query}&ll=${step.location.lat},${step.location.lng}`);
}

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
    itineraryStore.save(proposal!);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.dismissAll();
    router.navigate("/sorties");
  }

  return (
    <View style={styles.screen}>
      <View style={styles.map}>
        <RouteMap steps={proposal.steps} activeId={activeId} onSelect={setActiveId} />
        <IconButton label="Revenir aux propositions" glyph="←" onPress={() => router.back()} style={{ position: "absolute", top: insets.top + 8, left: 16 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 110 }}>
        <Display size={32} color={colors.accent}>{proposal.tripName}</Display>
        <Body style={{ marginTop: 6, marginBottom: 12 }}>{proposal.summary}</Body>

        {proposal.steps.map((step, index) => {
          const active = step.id === activeId;
          return (
            <Pressable key={step.id} onPress={() => setActiveId(step.id)} style={[styles.step, active && { backgroundColor: colors.paper2 }]}>
              <Text style={styles.number}>{index + 1}</Text>
              <View style={{ flex: 1, gap: 4 }}>
                <Overline>{proposal.totalDays > 1 ? `Jour ${step.day} · ` : ""}{PERIOD[step.period]}</Overline>
                <Display size={20}>{step.placeName}</Display>
                <Body>{step.description}</Body>
                {step.verified && <Overline color={colors.blue}>✓ {step.address ?? "Adresse confirmée"}</Overline>}
              </View>
              {/* Un seul bouton par étape sélectionnée : sur le site, quatre « Changer »
                  permanents faisaient de l'écran un formulaire (revue du 24/09/2026). */}
              {active && (
                <Pressable accessibilityRole="link" onPress={() => openInMaps(step)} style={styles.go}>
                  <Text style={styles.goText}>Y aller</Text>
                </Pressable>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <PrimaryButton label="Valider cet itinéraire" onPress={validate} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  map: { height: "38%", borderBottomWidth: rule.major, borderColor: colors.ink },
  step: { flexDirection: "row", gap: 12, borderTopWidth: rule.thin, borderColor: colors.ink, paddingVertical: 12, paddingHorizontal: 6 },
  number: { width: 22, fontFamily: fonts.display, fontSize: 24, color: colors.accent },
  go: { alignSelf: "flex-start", height: 34, paddingHorizontal: 10, borderWidth: rule.thin, borderColor: colors.ink, justifyContent: "center" },
  goText: { fontFamily: fonts.bodyHeavy, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: colors.ink },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: rule.thin, borderColor: colors.ink, backgroundColor: colors.paper },
});
