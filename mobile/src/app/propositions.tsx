import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { vibeLabel } from "@shared/vibe-labels";
import { useGeneration } from "@/lib/generation";
import type { Itinerary } from "@/types/itinerary";
import { Body, Display, IconButton, Overline } from "@/ui/kit";
import { colors, printShadow, rule } from "@/ui/theme";

const MODE_TITLE = { tonight: "ce soir", weekend: "ce week-end", trip: "ton voyage" } as const;

/**
 * Choix en deux temps, comme sur le site : ici on compare (titre, résumé, nombre d'étapes),
 * le détail et la carte s'ouvrent ensuite. Déplier trois programmes complets sur un écran de
 * téléphone ne se comparait pas.
 */
export default function PropositionsScreen() {
  const insets = useSafeAreaInsets();
  const { request, proposals, expected, status } = useGeneration();
  const waiting = status === "loading" ? Math.max(0, expected - proposals.length) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 24, gap: 16 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <IconButton label="Revenir aux réglages" glyph="←" onPress={() => router.dismissAll()} />
          <View style={{ flex: 1, gap: 4 }}>
            <Display size={30}>
              {`${proposals.length + waiting} idées pour ${request ? MODE_TITLE[request.mode] : "toi"}`}
            </Display>
            {request && (
              <Body>
                {"city" in request.location ? request.location.city : "Autour de toi"} · {vibeLabel("budget", request.budget)} ·{" "}
                {vibeLabel("ambiance", request.ambiance)} · {vibeLabel("distance", request.distance)}
              </Body>
            )}
          </View>
        </View>

        <View style={{ borderTopWidth: rule.major, borderColor: colors.ink }} />

        {proposals.map((proposal) => (
          <ProposalCard key={proposal.id} proposal={proposal} />
        ))}
        {Array.from({ length: waiting }, (_, index) => (
          <View key={index} style={styles.placeholder}>
            <Overline color={colors.inkMute}>Idée suivante en route…</Overline>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function ProposalCard({ proposal }: { proposal: Itinerary }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/proposition/[id]", params: { id: proposal.id } })}
      style={({ pressed }) => [styles.card, printShadow, pressed && { backgroundColor: colors.paper2 }]}
    >
      <View style={styles.band}>
        <Display size={22} color={colors.paper}>{proposal.tripName}</Display>
      </View>
      <View style={{ padding: 12, gap: 6 }}>
        <Body>{proposal.summary}</Body>
        <Overline color={colors.blue}>
          {proposal.steps.length} étapes · {proposal.steps.filter((step) => step.verified).length} adresses confirmées
        </Overline>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: rule.thin, borderColor: colors.ink, backgroundColor: colors.paper },
  band: { backgroundColor: colors.ink, paddingHorizontal: 12, paddingVertical: 10 },
  placeholder: { height: 72, borderWidth: rule.thin, borderStyle: "dashed", borderColor: colors.inkMute, alignItems: "center", justifyContent: "center" },
});
