import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { MODE_LABELS } from "@shared/trip-modes";
import { useSavedItineraries } from "@/lib/storage";
import { Body, Display, Masthead, Overline } from "@/ui/kit";
import { Paper } from "@/ui/paper";
import { colors, rule } from "@/ui/theme";

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

export default function SortiesScreen() {
  const saved = useSavedItineraries();

  return (
    <Paper style={{ flex: 1 }}>
    <ScrollView
 style={{ backgroundColor: "transparent" }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: 40 }}>
      <Masthead title="Sorties" />
      {saved.length === 0 && (
        <Body style={{ marginTop: 16 }}>Valide une proposition dans « Créer » : elle se range ici, avec ses étapes à cocher sur place.</Body>
      )}
      {saved.map(({ id, itinerary, savedAt, doneStepIds }) => {
        const total = itinerary.steps.length;
        const done = doneStepIds.length;
        return (
          <Pressable
            key={id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/sortie/[id]", params: { id } })}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.paper2 }]}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <Display size={22} style={{ flex: 1 }}>{itinerary.tripName}</Display>
              <Overline color={colors.inkMute}>{DATE.format(new Date(savedAt))}</Overline>
            </View>
            <Body>
              {MODE_LABELS[itinerary.mode]} · {total} étapes
            </Body>
            {/* Une sortie jamais entamée n'est pas « 0/8 » : un zéro sur une barre vide se lit
                comme un échec alors que c'est un programme en attente. */}
            {done === 0 ? (
              <Overline color={colors.inkMute}>Pas encore faite</Overline>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${(done / total) * 100}%` }]} />
                </View>
                <Overline color={colors.blue}>{`${done}/${total}`}</Overline>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
    </Paper>
  );
}

const styles = StyleSheet.create({
  row: { borderTopWidth: rule.thin, borderColor: colors.ink, paddingVertical: 14, gap: 8, marginTop: 8 },
  track: { flex: 1, height: 10, borderWidth: rule.thin, borderColor: colors.blue },
  fill: { height: "100%", backgroundColor: colors.blue },
});
