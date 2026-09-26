import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MODE_LABELS } from "@shared/trip-modes";
import { itineraryStore, useSavedItineraries } from "@/lib/storage";
import { findClosed, noteVisit } from "@/lib/signals";
import { earnedBy } from "@/lib/stamps";
import { showToast } from "@/lib/toast";
import { toggleVisit } from "@/lib/visits";
import { Body, Display, IconButton, Overline, PrimaryButton, SecondaryButton } from "@/ui/kit";
import { RouteMap } from "@/ui/route-map";
import { StepList } from "@/ui/step-list";
import { Paper } from "@/ui/paper";
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
  const [closed, setClosed] = useState<Set<string>>(new Set());

  // Un itinéraire enregistré la veille garde ses lieux : on vérifie qu'ils n'ont pas fermé
  // depuis. Sans signal, on se tait.
  useEffect(() => {
    if (!saved) return;
    let cancelled = false;
    void findClosed(saved.itinerary.steps).then((names) => {
      if (!cancelled) setClosed(names);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.id]);

  if (!saved) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 12, paddingHorizontal: 20, gap: 16 }]}>
        <IconButton label="Revenir" glyph="←" onPress={() => router.back()} />
        <Body>Cette sortie n’existe plus.</Body>
      </View>
    );
  }

  const { itinerary, doneStepIds } = saved;

  /**
   * Une sortie se fait rarement seul : le partage envoie le programme lisible tel quel dans un
   * message — titre, étapes dans l'ordre, et pour chacune un lien Plans. Aucun compte requis, ni
   * pour qui l'envoie ni pour qui le reçoit.
   */
  function share() {
    const lines = itinerary.steps.map((step, index) => {
      const query = encodeURIComponent([step.placeName, step.address].filter(Boolean).join(", "));
      return `${index + 1}. ${step.placeName}${step.address ? ` — ${step.address}` : ""}\nhttps://maps.apple.com/?q=${query}&ll=${step.location.lat},${step.location.lng}`;
    });
    void Share.share({ message: [`${itinerary.tripName} — composé avec VibeTrip`, "", ...lines].join("\n") });
  }

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
    <Paper style={styles.screen}>
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
        {/* Le mode « en sortie » : une étape à la fois, en gros, pour avancer dehors. */}
        {doneStepIds.length < itinerary.steps.length && (
          <PrimaryButton
            label={doneStepIds.length === 0 ? "Commencer la sortie" : "Reprendre la sortie"}
            onPress={() => router.push({ pathname: "/en-sortie/[id]", params: { id: saved.id } })}
            style={{ marginBottom: 14 }}
          />
        )}

        <StepList
          steps={itinerary.steps}
          showDay={itinerary.totalDays > 1}
          activeId={activeId}
          onSelect={setActiveId}
          done={doneStepIds}
          closed={closed}
          onToggleDone={(step) => {
            const willBeDone = !doneStepIds.includes(step.id);
            const stamps = earnedBy(() => {
              itineraryStore.toggleStepDone(saved.id, step.id);
              toggleVisit(saved.id, step, willBeDone);
            });
            if (willBeDone) {
              // Le même geste nourrit le compteur collectif, qui fera remonter les bons lieux, et
              // la confirmation nomme le lieu — et le tampon gagné, s'il y en a un.
              noteVisit(step);
              const extra = stamps.length > 0 ? ` · Nouveau tampon : ${stamps.join(", ")}` : "";
              showToast(`${step.placeName} — ajouté à ta carte${extra}`, { itineraryId: saved.id, step });
            }
          }}
        />

        <SecondaryButton label="Partager cette sortie" onPress={share} style={{ marginTop: 24 }} />
        <SecondaryButton label="Supprimer cette sortie" onPress={remove} style={{ marginTop: 8, borderColor: colors.inkMute }} />
      </ScrollView>
    </Paper>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  map: { height: "34%", borderBottomWidth: rule.major, borderColor: colors.ink },
  saved: { alignSelf: "flex-start", backgroundColor: colors.blue, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 6 },
});
