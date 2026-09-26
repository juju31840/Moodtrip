import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MODE_LABELS } from "@shared/trip-modes";
import { itineraryStore, useSavedItineraries } from "@/lib/storage";
import { toggleVisit } from "@/lib/visits";
import { Body, Display, IconButton, Overline, SecondaryButton } from "@/ui/kit";
import { RouteMap } from "@/ui/route-map";
import { StepList } from "@/ui/step-list";
import { colors, rule } from "@/ui/theme";

/**
 * Une sortie enregistrée, rouverte — c'est ici que vit le hook de rétention : cocher « j'y suis
 * allé » donne une raison de rouvrir l'application *pendant* la sortie, et chaque case cochée
 * pose un point sur « Ma carte ». Un geste qui ne rend rien cesse d'être fait.
 */
export default function SortieScreen() {
  const insets = useSafeAreaInsets();
  const { id, just } = useLocalSearchParams<{ id: string; just?: string }>();
  const saved = useSavedItineraries().find((entry) => entry.id === id);
  const [activeId, setActiveId] = useState<string | null>(null);

  if (!saved) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 12, paddingHorizontal: 20, gap: 16 }]}>
        <IconButton label="Revenir" glyph="←" onPress={() => router.back()} />
        <Body>Cette sortie n’existe plus.</Body>
      </View>
    );
  }

  const { itinerary, doneStepIds } = saved;

  function remove() {
    Alert.alert("Supprimer cette sortie ?", "Les lieux où tu es allé restent sur ta carte.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => {
          itineraryStore.remove(saved!.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.map}>
        <RouteMap steps={itinerary.steps} activeId={activeId} onSelect={setActiveId} />
        <IconButton label="Revenir aux sorties" glyph="←" onPress={() => router.back()} style={{ position: "absolute", top: insets.top + 8, left: 16 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: insets.bottom + 24, gap: 6 }}>
        {just === "1" && (
          <View style={styles.saved}>
            <Overline color={colors.paper}>Ajouté à tes sorties</Overline>
          </View>
        )}
        <Overline>
          {MODE_LABELS[itinerary.mode]} · {doneStepIds.length}/{itinerary.steps.length} faites
        </Overline>
        <Display size={32} color={colors.accent}>{itinerary.tripName}</Display>
        <Body style={{ marginBottom: 12 }}>Coche chaque étape sur place : elle rejoint ta carte.</Body>

        <StepList
          steps={itinerary.steps}
          showDay={itinerary.totalDays > 1}
          activeId={activeId}
          onSelect={setActiveId}
          done={doneStepIds}
          onToggleDone={(step) => {
            const willBeDone = !doneStepIds.includes(step.id);
            itineraryStore.toggleStepDone(saved.id, step.id);
            toggleVisit(saved.id, step, willBeDone);
          }}
        />

        <SecondaryButton label="Supprimer cette sortie" onPress={remove} style={{ marginTop: 24, borderColor: colors.inkMute }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  map: { height: "34%", borderBottomWidth: rule.major, borderColor: colors.ink },
  saved: { alignSelf: "flex-start", backgroundColor: colors.blue, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 6 },
});
