import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { MODE_LABELS } from "@shared/trip-modes";
import { isRated, ratingsStore, saveRating } from "@/lib/ratings";
import { rateStep } from "@/lib/signals";
import { useSavedItineraries, type SavedItinerary } from "@/lib/storage";
import { cityLabel } from "@/lib/visits";
import type { ItineraryStep } from "@/types/itinerary";
import { ModeIcon, StarIcon } from "@/ui/icons";
import { Body, Display, Masthead, Overline } from "@/ui/kit";
import { Paper } from "@/ui/paper";
import { OutingThumb, photoRanks } from "@/ui/city-photo";
import { colors, fonts, printShadow, rule } from "@/ui/theme";

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

export default function SortiesScreen() {
  const saved = useSavedItineraries();
  ratingsStore.useValue(); // se redessine quand une note est donnée
  const ranks = photoRanks(saved.map((entry) => ({ id: entry.id, steps: entry.itinerary.steps })));

  return (
    <Paper style={{ flex: 1 }}>
      <ScrollView style={{ backgroundColor: "transparent" }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: 40, gap: 14 }}>
        <Masthead title="Sorties" />
        {saved.length === 0 ? (
          <Body>Valide une proposition dans « Créer » : elle se range ici, avec ses étapes à cocher sur place.</Body>
        ) : (
          <>
            <ToRate items={saved} />
            {saved.map((entry) => (
              <OutingRow key={entry.id} entry={entry} rank={ranks.get(entry.id) ?? 0} />
            ))}
          </>
        )}
      </ScrollView>
    </Paper>
  );
}

/**
 * Une sortie, en carte : un bandeau photo de sa ville (retours du 26/09/2026 — « un carré blanc
 * moche », puis « améliore la qualité »), son mode en pastille, son titre posé en bande d'encre
 * comme sur les propositions, et où on en est.
 */
function OutingRow({ entry, rank }: { entry: SavedItinerary; rank: number }) {
  const { width } = useWindowDimensions();
  const { id, itinerary, savedAt, doneStepIds } = entry;
  const total = itinerary.steps.length;
  const done = doneStepIds.length;
  const city = itinerary.steps.find((step) => step.city)?.city ?? null;
  const cardWidth = width - 40;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/sortie/[id]", params: { id } })}
      style={({ pressed }) => [styles.card, printShadow, pressed && { backgroundColor: colors.paper2 }]}
    >
      <View style={{ height: 150, overflow: "hidden", borderBottomWidth: rule.thin, borderColor: colors.ink }}>
        <OutingThumb steps={itinerary.steps} rank={rank} width={cardWidth - 4} height={150} />
        <View style={styles.modeChip}>
          <ModeIcon mode={itinerary.mode} size={14} color={colors.paper} />
          <Text style={styles.modeText}>{MODE_LABELS[itinerary.mode]}</Text>
        </View>
        <View style={styles.titleBand}>
          <Display size={19} color={colors.paper}>{itinerary.tripName}</Display>
        </View>
      </View>
      <View style={{ padding: 12, gap: 6 }}>
        <Overline>
          {DATE.format(new Date(savedAt))} · {total} étapes{city ? ` · ${cityLabel(city)}` : ""}
        </Overline>
        {/* Une sortie jamais entamée n'est pas « 0/8 » : un zéro sur une barre vide se lit comme
            un échec alors que c'est un programme en attente. */}
        {done === 0 ? (
          <Overline color={colors.inkMute}>Pas encore faite</Overline>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${(done / total) * 100}%` }]} />
            </View>
            <Overline color={colors.blue}>{done === total ? "Faite" : `${done}/${total}`}</Overline>
          </View>
        )}
      </View>
    </Pressable>
  );
}

/**
 * Le rattrapage des notes, comme sur le site : la note est demandée au moment de cocher, mais on
 * est alors dehors et on passe. « Sorties » est l'écran où l'on revient au calme. Le bloc
 * disparaît dès qu'il n'y a plus rien à noter.
 */
function ToRate({ items }: { items: SavedItinerary[] }) {
  const [skipped, setSkipped] = useState<string[]>([]);
  // La note choisie reste visible un instant avant que la ligne ne s'efface : sans ce retour, le
  // geste ne se distinguait pas d'un toucher perdu.
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const pending: { itineraryId: string; step: ItineraryStep }[] = [];
  for (const item of items) {
    for (const step of item.itinerary.steps) {
      if (item.doneStepIds.includes(step.id) && !isRated(item.id, step.id) && !skipped.includes(`${item.id}:${step.id}`)) {
        pending.push({ itineraryId: item.id, step });
      }
    }
  }
  if (pending.length === 0) return null;

  return (
    <View style={styles.rate}>
      <View style={styles.rateHead}>
        <Text style={styles.rateHeadText}>Tu y es allé — ton avis ?</Text>
      </View>
      {pending.slice(0, 4).map(({ itineraryId, step }) => (
        <View key={`${itineraryId}:${step.id}`} style={styles.rateRow}>
          <Display size={17}>{step.placeName}</Display>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[1, 2, 3, 4, 5].map((note) => (
                <Pressable
                  key={note}
                  accessibilityRole="button"
                  accessibilityLabel={`Noter ${step.placeName} ${note} sur 5`}
                  hitSlop={4}
                  onPress={() => {
                    const ref = `${itineraryId}:${step.id}`;
                    setChosen((current) => ({ ...current, [ref]: note }));
                    rateStep(step, note);
                    setTimeout(() => saveRating(itineraryId, step.id, step.placeName, note), 650);
                  }}
                >
                  <StarIcon filled={note <= (chosen[`${itineraryId}:${step.id}`] ?? 0)} size={28} />
                </Pressable>
              ))}
            </View>
            <Pressable hitSlop={8} onPress={() => setSkipped((current) => [...current, `${itineraryId}:${step.id}`])}>
              <Text style={styles.skip}>Plus tard</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: rule.thin, borderColor: colors.ink, backgroundColor: colors.paper, marginBottom: 6 },
  // Encre noire et non vermillon : le vermillon reste à l'action et à la sélection.
  modeChip: { position: "absolute", top: 10, left: 10, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.ink, paddingHorizontal: 8, paddingVertical: 5 },
  modeText: { fontFamily: fonts.bodyHeavy, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: colors.paper },
  titleBand: { position: "absolute", left: 0, bottom: 0, maxWidth: "92%", backgroundColor: colors.ink, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 },
  track: { flex: 1, height: 10, borderWidth: rule.thin, borderColor: colors.blue },
  fill: { height: "100%", backgroundColor: colors.blue },
  rate: { borderWidth: rule.thin, borderColor: colors.ink },
  rateHead: { backgroundColor: colors.ink, paddingHorizontal: 12, paddingVertical: 8 },
  rateHeadText: { fontFamily: fonts.bodyHeavy, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase", color: colors.paper },
  rateRow: { padding: 12, gap: 8, borderTopWidth: rule.thin, borderColor: colors.ink },
  skip: { fontFamily: fonts.bodyHeavy, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: colors.inkMute, textDecorationLine: "underline" },
});
