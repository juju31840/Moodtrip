import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatTrajet, trajetDepuis } from "@shared/walking";
import { noteVisit } from "@/lib/signals";
import { itineraryStore, useSavedItineraries } from "@/lib/storage";
import { earnedBy } from "@/lib/stamps";
import { showToast } from "@/lib/toast";
import { toggleVisit } from "@/lib/visits";
import type { ItineraryStep } from "@/types/itinerary";
import { Body, Display, IconButton, Overline, PrimaryButton, SecondaryButton } from "@/ui/kit";
import { Paper } from "@/ui/paper";
import { RouteMap } from "@/ui/route-map";
import { ContactButtons } from "@/ui/step-list";
import { colors, fonts, rule } from "@/ui/theme";

function openInMaps(step: ItineraryStep) {
  const query = encodeURIComponent([step.placeName, step.address].filter(Boolean).join(", "));
  void Linking.openURL(`https://maps.apple.com/?q=${query}&ll=${step.location.lat},${step.location.lng}`);
}

/**
 * Le mode « en sortie » — l'écran qu'on garde en main dehors.
 *
 * Le hook de rétention du produit est de cocher les étapes **pendant** la sortie ; or la liste des
 * étapes est faite pour choisir, pas pour avancer. Ici une seule étape à la fois, en gros : où
 * l'on va, combien de marche depuis la précédente, et deux gestes — « Y aller » (Plans) et
 * « J'y suis », qui coche, pose le lieu sur la carte, demande une note et passe à la suivante.
 * L'étape affichée est la première non cochée : on reprend là où l'on s'était arrêté.
 */
export default function EnSortieScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const saved = useSavedItineraries().find((entry) => entry.id === id);
  // Étape choisie à la main (« Passer ») ; sinon, la première qui n'est pas encore faite.
  const [chosen, setChosen] = useState<number | null>(null);

  if (!saved) {
    return (
      <Paper style={[styles.screen, { paddingTop: insets.top + 12, paddingHorizontal: 20, gap: 16 }]}>
        <IconButton label="Revenir" glyph="←" onPress={() => router.back()} />
        <Body>Cette sortie n’existe plus.</Body>
      </Paper>
    );
  }

  const { itinerary, doneStepIds } = saved;
  const steps = itinerary.steps;
  const firstPending = steps.findIndex((step) => !doneStepIds.includes(step.id));
  const index = chosen ?? firstPending;
  const finished = firstPending === -1 && chosen === null;

  if (finished || index < 0) {
    return (
      <Paper style={[styles.screen, { paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 20 }]}>
        <IconButton label="Revenir à la sortie" glyph="←" onPress={() => router.back()} />
        <View style={{ flex: 1, justifyContent: "center", gap: 14 }}>
          <Display size={48} color={colors.accent}>Sortie terminée</Display>
          <Body style={{ fontSize: 17, lineHeight: 24 }}>
            {steps.length} étape{steps.length > 1 ? "s" : ""}, toutes sur ta carte. Tes notes font remonter les bonnes adresses pour
            tout le monde.
          </Body>
        </View>
        <PrimaryButton label="Voir ma carte" onPress={() => router.navigate("/carte")} />
      </Paper>
    );
  }

  const step = steps[index]!;
  const previous = index > 0 ? steps[index - 1] : undefined;
  const trajet = previous ? trajetDepuis(previous, step) : null;
  const isDone = doneStepIds.includes(step.id);

  function arrived() {
    if (!isDone) {
      const stamps = earnedBy(() => {
        itineraryStore.toggleStepDone(saved!.id, step.id);
        toggleVisit(saved!.id, step, true);
      });
      noteVisit(step);
      const extra = stamps.length > 0 ? ` · Nouveau tampon : ${stamps.join(", ")}` : "";
      showToast(`${step.placeName} — ajouté à ta carte${extra}`, { itineraryId: saved!.id, step });
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // La suivante non faite, sinon l'écran de fin.
    const next = steps.findIndex((item, position) => position > index && !doneStepIds.includes(item.id));
    setChosen(next === -1 ? null : next);
  }

  return (
    <Paper style={styles.screen}>
      <View style={styles.map}>
        <RouteMap steps={steps} activeId={step.id} onSelect={(selected) => setChosen(steps.findIndex((item) => item.id === selected))} />
        <IconButton label="Revenir à la sortie" glyph="←" onPress={() => router.back()} style={{ position: "absolute", top: insets.top + 8, left: 16 }} />
      </View>

      {/* La progression : une case par étape, pleines pour les faites, vermillon pour la courante. */}
      <View style={styles.progress}>
        {steps.map((item, position) => (
          <View
            key={item.id}
            style={[
              styles.segment,
              doneStepIds.includes(item.id) && { backgroundColor: colors.blue, borderColor: colors.blue },
              position === index && { backgroundColor: colors.accent, borderColor: colors.accent },
            ]}
          />
        ))}
      </View>

      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 14, gap: 8 }}>
        <Overline>
          Étape {index + 1} sur {steps.length}
          {itinerary.totalDays > 1 ? ` · jour ${step.day}` : ""}
          {trajet ? ` · ${formatTrajet(trajet)} depuis la précédente` : ""}
        </Overline>
        <Display size={36} color={isDone ? colors.inkSoft : colors.ink}>{step.placeName}</Display>
        <Body style={{ fontSize: 16, lineHeight: 23 }}>{step.description}</Body>
        {step.address && <Overline color={colors.blue}>✓ {step.address}</Overline>}
        {isDone && <Overline color={colors.blue}>Déjà fait</Overline>}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          <ContactButtons step={step} />
        </View>
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 14 }]}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <SecondaryButton label="Y aller" onPress={() => openInMaps(step)} style={{ flex: 1 }} />
          <PrimaryButton label={isDone ? "Suivante" : "J’y suis"} onPress={arrived} style={{ flex: 1.4 }} />
        </View>
        {index < steps.length - 1 && (
          <Pressable accessibilityRole="button" onPress={() => setChosen(index + 1)} hitSlop={8} style={{ alignSelf: "center" }}>
            <Text style={styles.skip}>Passer cette étape</Text>
          </Pressable>
        )}
      </View>
    </Paper>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  map: { height: "32%", borderBottomWidth: rule.major, borderColor: colors.ink },
  progress: { flexDirection: "row", gap: 4, paddingHorizontal: 20, paddingTop: 12 },
  segment: { flex: 1, height: 8, borderWidth: rule.thin, borderColor: colors.ink },
  actions: { paddingHorizontal: 20, paddingTop: 12, gap: 12, borderTopWidth: rule.thin, borderColor: colors.ink },
  skip: { fontFamily: fonts.bodyHeavy, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: colors.inkMute, textDecorationLine: "underline" },
});
