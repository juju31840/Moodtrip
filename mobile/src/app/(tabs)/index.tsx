import * as Location from "expo-location";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { THEMES } from "@shared/themes";
import { availableStarts, draftStore, patchDraft, startDate } from "@/lib/draft";
import { startGeneration } from "@/lib/generation";
import { preferencesUseful, profileStore, recentCitiesStore, rememberCity } from "@/lib/profile";
import { CityField } from "@/ui/city-field";
import type { TripMode } from "@/types/itinerary";
import { CheckBox, Chip, Masthead, Overline, PrimaryButton } from "@/ui/kit";
import { VibeSlider } from "@/ui/vibe-slider";
import { Paper } from "@/ui/paper";
import { colors, fonts, rule } from "@/ui/theme";

const MODES: { id: TripMode; label: string; cta: string }[] = [
  { id: "tonight", label: "Ce soir", cta: "Trouver ma soirée" },
  { id: "weekend", label: "Week-end", cta: "Trouver mon week-end" },
  { id: "trip", label: "Voyage", cta: "Trouver mon voyage" },
];

/**
 * Réglages, dans l'ordre de la décision (leçon du site, 29/08/2026) : quand, où, un filet, puis
 * les nuances. Budget et ambiance ne veulent pas dire la même chose pour une soirée et pour un
 * voyage de six jours — on les règle une fois qu'on sait duquel il s'agit.
 */
export default function CreerScreen() {
  const insets = useSafeAreaInsets();
  const draft = draftStore.useValue();
  const profile = profileStore.useValue();
  const recent = recentCitiesStore.useValue();
  const [locating, setLocating] = useState(false);

  const { mode, city, position, budget, ambiance, distance, themes } = draft;
  const starts = availableStarts();
  // Un choix d'heure resté d'une autre fois peut être passé depuis : on retombe sur « tout de suite ».
  const startChoice = starts.some((item) => item.id === draft.start) ? (draft.start ?? "now") : "now";
  const canStart = position !== null || city.trim().length > 1;
  const cta = MODES.find((item) => item.id === mode)!.cta;

  // La case est **déduite** du brouillon, jamais gardée à part : toucher un curseur la décoche
  // d'elle-même, parce que le réglage a cessé de suivre les préférences.
  const prefs = profile.preferences;
  const showPrefs = preferencesUseful(prefs);
  const followsPrefs =
    showPrefs &&
    budget === prefs.budget &&
    ambiance === prefs.ambiance &&
    distance === prefs.distance &&
    themes.length === prefs.themes.length &&
    themes.every((theme) => prefs.themes.includes(theme));

  function togglePrefs() {
    if (followsPrefs) {
      patchDraft({ budget: 50, ambiance: 50, distance: 25, themes: [] });
    } else {
      patchDraft({
        budget: prefs.budget,
        ambiance: prefs.ambiance,
        distance: prefs.distance,
        themes: prefs.themes,
        ...(profile.cities[0] && !position ? { city: profile.cities[0] } : {}),
      });
    }
  }

  async function locate() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      patchDraft({ position: { lat: coords.latitude, lng: coords.longitude }, city: "" });
    } finally {
      setLocating(false);
    }
  }

  function start() {
    if (!position) rememberCity(city);
    startGeneration({
      mode,
      budget,
      ambiance,
      distance,
      location: position ?? { city: city.trim() },
      themes: themes.length > 0 ? themes : undefined,
      startAt: mode === "tonight" ? startDate(startChoice).toISOString() : undefined,
    });
    router.push("/attente");
  }

  return (
    <Paper style={{ flex: 1 }}>
      {/* Défilement réglé à la main (« never ») : la marge basse laisse passer la barre d'onglets. */}
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: insets.bottom + TAB_BAR + 110, gap: 20 }}
      >
        <Masthead title="Vibetrip" />

        <View style={{ gap: 8 }}>
          <Overline>Quand</Overline>
          <View style={styles.segment}>
            {MODES.map((item, index) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === item.id }}
                onPress={() => patchDraft({ mode: item.id })}
                style={[styles.segmentCell, index > 0 && { borderLeftWidth: rule.thin }, mode === item.id && { backgroundColor: colors.ink }]}
              >
                <Text style={[styles.segmentText, mode === item.id && { color: colors.paper }]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          {/* L'heure, pour « ce soir » seulement : partir à 22 h ou demain ne compose pas le même
              parcours, et c'est aussi l'heure que la météo regarde. */}
          {mode === "tonight" && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {starts.map((item) => (
                <Chip key={item.id} label={item.label} selected={startChoice === item.id} onPress={() => patchDraft({ start: item.id })} />
              ))}
            </ScrollView>
          )}
        </View>

        {showPrefs && (
          <Pressable onPress={togglePrefs} style={styles.prefsRow} accessibilityRole="checkbox" accessibilityState={{ checked: followsPrefs }}>
            <CheckBox checked={followsPrefs} onToggle={togglePrefs} label="Partir de mes préférences" />
            <Text style={styles.prefsText}>Partir de mes préférences</Text>
          </Pressable>
        )}

        <View style={{ gap: 8 }}>
          <Overline>Au départ de</Overline>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
            {/* Liste de suggestions qui s'affine à chaque lettre (demande du 26/09/2026), à la
                place des pastilles de villes : les villes du profil et les dernières utilisées
                y passent en premier, et seules quand le champ est vide. */}
            <CityField
              value={city}
              usingPosition={position !== null}
              preferred={[...profile.cities, ...recent]}
              onChangeText={(text) => patchDraft({ position: null, city: text })}
              onPick={(picked) => patchDraft({ position: null, city: picked })}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Utiliser ma position"
              onPress={locate}
              style={[styles.locate, position && { backgroundColor: colors.ink }]}
            >
              <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 18, color: position ? colors.paper : colors.ink }}>{locating ? "…" : "◎"}</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ borderTopWidth: rule.major, borderColor: colors.ink }} />
        <Overline>Pour affiner — facultatif</Overline>

        <VibeSlider kind="budget" label="Budget" value={budget} onChange={(value) => patchDraft({ budget: value })} />
        <VibeSlider kind="ambiance" label="Ambiance" value={ambiance} onChange={(value) => patchDraft({ ambiance: value })} />
        <VibeSlider kind="distance" label="Distance" value={distance} onChange={(value) => patchDraft({ distance: value })} />

        <View style={{ gap: 8 }}>
          <Overline>Envies</Overline>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {THEMES.map((theme) => (
              <Chip
                key={theme.id}
                label={theme.label}
                selected={themes.includes(theme.id)}
                onPress={() => patchDraft({ themes: themes.includes(theme.id) ? themes.filter((id) => id !== theme.id) : [...themes, theme.id] })}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* L'action en pied fixe, **au-dessus** de la barre d'onglets flottante. Deux essais
          ratés : collée au bas de l'écran, elle passait dessous ; remontée dans la liste, elle se
          perdait entre les réglages (retours des 24 et 26/09/2026). La barre d'iOS 26 occupe
          ~83 points du bas de l'écran, mesurés sur une capture d'iPhone. */}
      <View style={[styles.footer, { bottom: insets.bottom + TAB_BAR - 34 }]}>
        <PrimaryButton label={cta} onPress={start} disabled={!canStart} />
      </View>
    </Paper>
  );
}

/** Hauteur de la barre d'onglets flottante au-dessus de la zone sûre du bas, plus un léger jour. */
const TAB_BAR = 91;

const styles = StyleSheet.create({
  segment: { flexDirection: "row", borderWidth: rule.thin, borderColor: colors.ink },
  segmentCell: { flex: 1, height: 48, alignItems: "center", justifyContent: "center", borderColor: colors.ink },
  segmentText: { fontFamily: fonts.bodyHeavy, fontSize: 13, letterSpacing: 0.8, textTransform: "uppercase", color: colors.ink },
  prefsRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  prefsText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  footer: { position: "absolute", left: 16, right: 16 },
  locate: { width: 48, height: 48, borderWidth: rule.thin, borderColor: colors.ink, alignItems: "center", justifyContent: "center" },
});
