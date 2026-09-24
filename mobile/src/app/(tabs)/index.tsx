import * as Location from "expo-location";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-screens/experimental";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { THEMES } from "@shared/themes";
import { vibeLabel } from "@shared/vibe-labels";
import { startGeneration } from "@/lib/generation";
import type { GeoPoint, ThemeId, TripMode } from "@/types/itinerary";
import { Chip, Masthead, Overline, PrimaryButton, StepPicker } from "@/ui/kit";
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
  const [mode, setMode] = useState<TripMode>("tonight");
  const [city, setCity] = useState("");
  const [position, setPosition] = useState<GeoPoint | null>(null);
  const [locating, setLocating] = useState(false);
  const [budget, setBudget] = useState(50);
  const [ambiance, setAmbiance] = useState(50);
  const [distance, setDistance] = useState(25);
  const [themes, setThemes] = useState<ThemeId[]>([]);

  const canStart = position !== null || city.trim().length > 1;
  const cta = MODES.find((item) => item.id === mode)!.cta;

  async function locate() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPosition({ lat: coords.latitude, lng: coords.longitude });
      setCity("");
    } finally {
      setLocating(false);
    }
  }

  function start() {
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
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      {/* Défilement réglé à la main ici (« never ») : le bouton fixe est posé sous la liste,
          dans le flux, et c'est lui qui porte la marge de la barre d'onglets. */}
      <ScrollView contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 24, gap: 20 }}>
        <Masthead title="Vibetrip" />

        <View style={{ gap: 8 }}>
          <Overline>Quand</Overline>
          <View style={styles.segment}>
            {MODES.map((item, index) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === item.id }}
                onPress={() => setMode(item.id)}
                style={[styles.segmentCell, index > 0 && { borderLeftWidth: rule.thin }, mode === item.id && { backgroundColor: colors.ink }]}
              >
                <Text style={[styles.segmentText, mode === item.id && { color: colors.paper }]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Overline>Au départ de</Overline>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              value={position ? "Ma position" : city}
              onChangeText={(text) => {
                setPosition(null);
                setCity(text);
              }}
              placeholder="Une ville"
              placeholderTextColor={colors.inkMute}
              accessibilityLabel="Ville de départ"
              autoCapitalize="words"
              style={styles.input}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Utiliser ma position" onPress={locate} style={[styles.locate, position && { backgroundColor: colors.ink }]}>
              <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 18, color: position ? colors.paper : colors.ink }}>{locating ? "…" : "◎"}</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ borderTopWidth: rule.major, borderColor: colors.ink }} />

        <StepPicker label="Budget" word={vibeLabel("budget", budget)} value={budget} onChange={setBudget} />
        <StepPicker label="Ambiance" word={vibeLabel("ambiance", ambiance)} value={ambiance} onChange={setAmbiance} />
        <StepPicker label="Distance" word={vibeLabel("distance", distance)} value={distance} onChange={setDistance} />

        <View style={{ gap: 8 }}>
          <Overline>Envies — facultatif</Overline>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {THEMES.map((theme) => (
              <Chip
                key={theme.id}
                label={theme.label}
                selected={themes.includes(theme.id)}
                onPress={() =>
                  setThemes((current) => (current.includes(theme.id) ? current.filter((id) => id !== theme.id) : [...current, theme.id]))
                }
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Pied fixe : 947 px de réglages pour 767 visibles sur le site, et l'action se retrouvait
          sous la ligne de flottaison sans que rien ne dise qu'il fallait défiler. */}
      {/* Premier essai sur Expo Go : le bouton, posé en absolu en bas d'écran, passait sous la
          barre d'onglets — sur iOS le contenu d'un onglet s'étend dessous. La marge sûre de type
          « all » inclut la hauteur de la barre, quelle qu'elle soit selon la version d'iOS. */}
      <SafeAreaView edges={{ bottom: true }} insetType="all" style={styles.footer}>
        <PrimaryButton label={cta} onPress={start} disabled={!canStart} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: "row", borderWidth: rule.thin, borderColor: colors.ink },
  segmentCell: { flex: 1, height: 48, alignItems: "center", justifyContent: "center", borderColor: colors.ink },
  segmentText: { fontFamily: fonts.bodyHeavy, fontSize: 13, letterSpacing: 0.8, textTransform: "uppercase", color: colors.ink },
  input: { flex: 1, height: 48, borderWidth: rule.thin, borderColor: colors.ink, paddingHorizontal: 12, fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  locate: { width: 48, height: 48, borderWidth: rule.thin, borderColor: colors.ink, alignItems: "center", justifyContent: "center" },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, borderTopWidth: rule.thin, borderColor: colors.ink, backgroundColor: colors.paper },
});
