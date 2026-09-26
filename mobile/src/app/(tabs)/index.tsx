import * as Location from "expo-location";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SafeAreaView } from "react-native-screens/experimental";

import { THEMES } from "@shared/themes";
import { vibeLabel } from "@shared/vibe-labels";
import { draftStore, patchDraft } from "@/lib/draft";
import { startGeneration } from "@/lib/generation";
import { cityShortcuts, preferencesUseful, profileStore, recentCitiesStore, rememberCity } from "@/lib/profile";
import type { TripMode } from "@/types/itinerary";
import { CheckBox, Chip, Masthead, Overline, PrimaryButton, StepPicker } from "@/ui/kit";
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
  const canStart = position !== null || city.trim().length > 1;
  const cta = MODES.find((item) => item.id === mode)!.cta;
  const shortcuts = cityShortcuts(profile.cities, recent);

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
    });
    router.push("/attente");
  }

  return (
    <Paper style={{ flex: 1 }}>
      {/* Défilement réglé à la main (« never ») : le bouton fixe est posé sous la liste, dans le
          flux, et c'est lui qui porte la marge de la barre d'onglets. */}
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 24, gap: 20 }}
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
        </View>

        {showPrefs && (
          <Pressable onPress={togglePrefs} style={styles.prefsRow} accessibilityRole="checkbox" accessibilityState={{ checked: followsPrefs }}>
            <CheckBox checked={followsPrefs} onToggle={togglePrefs} label="Partir de mes préférences" />
            <Text style={styles.prefsText}>Partir de mes préférences</Text>
          </Pressable>
        )}

        <View style={{ gap: 8 }}>
          <Overline>Au départ de</Overline>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              value={position ? "Ma position" : city}
              onChangeText={(text) => patchDraft({ position: null, city: text })}
              placeholder="Une ville"
              placeholderTextColor={colors.inkMute}
              accessibilityLabel="Ville de départ"
              autoCapitalize="words"
              autoCorrect={false}
              style={styles.input}
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
          {/* Raccourcis : les villes du profil, puis les dernières utilisées, puis les grandes
              villes pour un premier lancement. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
            {shortcuts.map((item) => (
              <Chip
                key={item}
                label={item}
                selected={!position && city.trim().toLowerCase() === item.toLowerCase()}
                onPress={() => patchDraft({ position: null, city: item })}
              />
            ))}
          </ScrollView>
        </View>

        <View style={{ borderTopWidth: rule.major, borderColor: colors.ink }} />

        <StepPicker label="Budget" word={vibeLabel("budget", budget)} value={budget} onChange={(value) => patchDraft({ budget: value })} />
        <StepPicker label="Ambiance" word={vibeLabel("ambiance", ambiance)} value={ambiance} onChange={(value) => patchDraft({ ambiance: value })} />
        <StepPicker label="Distance" word={vibeLabel("distance", distance)} value={distance} onChange={(value) => patchDraft({ distance: value })} />

        <View style={{ gap: 8 }}>
          <Overline>Envies — facultatif</Overline>
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

      {/* Premier essai sur Expo Go : le bouton, posé en absolu, passait sous la barre d'onglets —
          sur iOS le contenu d'un onglet s'étend dessous. La marge sûre « all » inclut la barre. */}
      <SafeAreaView edges={{ bottom: true }} insetType="all" style={styles.footer}>
        <PrimaryButton label={cta} onPress={start} disabled={!canStart} />
      </SafeAreaView>
    </Paper>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: "row", borderWidth: rule.thin, borderColor: colors.ink },
  segmentCell: { flex: 1, height: 48, alignItems: "center", justifyContent: "center", borderColor: colors.ink },
  segmentText: { fontFamily: fonts.bodyHeavy, fontSize: 13, letterSpacing: 0.8, textTransform: "uppercase", color: colors.ink },
  prefsRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  prefsText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  input: { flex: 1, height: 48, borderWidth: rule.thin, borderColor: colors.ink, paddingHorizontal: 12, fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  locate: { width: 48, height: 48, borderWidth: rule.thin, borderColor: colors.ink, alignItems: "center", justifyContent: "center" },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, borderTopWidth: rule.thin, borderColor: colors.ink, backgroundColor: colors.paper },
});
