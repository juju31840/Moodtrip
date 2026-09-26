import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { THEMES } from "@shared/themes";
import { vibeLabel } from "@shared/vibe-labels";
import { patchDraft } from "@/lib/draft";
import { profileStore, type Preferences } from "@/lib/profile";
import { readTaste, visitsStore, VISITS_MINIMUM } from "@/lib/visits";
import { Body, Chip, Display, Masthead, Overline, SecondaryButton, StepPicker } from "@/ui/kit";
import { Paper } from "@/ui/paper";
import { colors, fonts, rule } from "@/ui/theme";

/**
 * Profil — trois registres, et la distinction porte du sens (site, 29/08/2026) :
 * 1. la fiche, en encre pleine : ce qu'on **est** ;
 * 2. les préférences, papier assombri et encadré : ce qu'on **veut** ;
 * 3. « Ce qu'on a compris », après une bande d'encre : ce qu'on **fait**, observé, jamais demandé.
 * Les deux derniers ne sont jamais fondus : l'écart entre eux est un fait sur la personne.
 */
export default function ProfilScreen() {
  const profile = profileStore.useValue();
  const places = visitsStore.useValue();
  const taste = readTaste(places);
  const [newCity, setNewCity] = useState("");

  const setPrefs = (patch: Partial<Preferences>) => profileStore.set({ ...profile, preferences: { ...profile.preferences, ...patch } });
  const prefs = profile.preferences;
  const missing = Math.max(0, VISITS_MINIMUM - taste.total);
  // Goûts nommés : au-dessus d'un quart des passages. Deux au plus sont reportés — en
  // présélectionner davantage revient à tout cocher, ce qui ne dirige plus rien.
  const tastes = taste.shares.filter((share) => share.share >= 0.25).slice(0, 2);

  function addCity() {
    const city = newCity.trim();
    if (city.length < 2 || profile.cities.length >= 4) return;
    profileStore.set({ ...profile, cities: [...profile.cities.filter((item) => item.toLowerCase() !== city.toLowerCase()), city] });
    setNewCity("");
  }

  function applyTastes() {
    patchDraft({ themes: tastes.map((share) => share.theme) });
    router.navigate("/");
  }

  return (
    <Paper style={{ flex: 1 }}>
    <ScrollView
      style={{ backgroundColor: "transparent" }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: 40, gap: 16 }}
    >
      <Masthead title="Profil" />

      {/* 1. La fiche */}
      <View style={styles.card}>
        <TextInput
          value={profile.firstName}
          onChangeText={(firstName) => profileStore.set({ ...profile, firstName })}
          placeholder="Ton prénom"
          placeholderTextColor={colors.inkMute}
          accessibilityLabel="Prénom"
          style={styles.name}
        />
        <Overline color={colors.paper3}>
          {profile.cities.length > 0 ? `Sort à ${profile.cities.join(" · ")}` : "Ajoute les villes où tu sors"}
        </Overline>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          {profile.cities.map((city) => (
            <Pressable
              key={city}
              accessibilityLabel={`Retirer ${city}`}
              onPress={() => profileStore.set({ ...profile, cities: profile.cities.filter((item) => item !== city) })}
              style={styles.cityChip}
            >
              <Text style={styles.cityChipText}>{city} ✕</Text>
            </Pressable>
          ))}
        </View>
        {profile.cities.length < 4 && (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <TextInput
              value={newCity}
              onChangeText={setNewCity}
              onSubmitEditing={addCity}
              placeholder="Une ville"
              placeholderTextColor={colors.inkMute}
              accessibilityLabel="Ajouter une ville de référence"
              returnKeyType="done"
              style={styles.cityInput}
            />
            <Pressable accessibilityRole="button" onPress={addCity} style={styles.cityAdd}>
              <Text style={styles.cityChipText}>Ajouter</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* 2. Les préférences */}
      <View style={styles.prefs}>
        <Display size={22}>Tes préférences</Display>
        <Body>Elles préremplissent « Créer » quand tu coches « Partir de mes préférences ».</Body>
        <StepPicker label="Budget" word={vibeLabel("budget", prefs.budget)} value={prefs.budget} onChange={(budget) => setPrefs({ budget })} />
        <StepPicker label="Ambiance" word={vibeLabel("ambiance", prefs.ambiance)} value={prefs.ambiance} onChange={(ambiance) => setPrefs({ ambiance })} />
        <StepPicker label="Distance" word={vibeLabel("distance", prefs.distance)} value={prefs.distance} onChange={(distance) => setPrefs({ distance })} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {THEMES.map((theme) => (
            <Chip
              key={theme.id}
              label={theme.label}
              selected={prefs.themes.includes(theme.id)}
              onPress={() =>
                setPrefs({ themes: prefs.themes.includes(theme.id) ? prefs.themes.filter((id) => id !== theme.id) : [...prefs.themes, theme.id] })
              }
            />
          ))}
        </View>
      </View>

      {/* 3. Ce qu'on a compris */}
      <View style={styles.band}>
        <Display size={22} color={colors.paper}>Ce qu’on a compris</Display>
      </View>
      {missing > 0 ? (
        // Il se tait tant qu'il ne sait pas — et dit combien il en manque : le vide devient un
        // objectif atteignable en une sortie.
        <Body>
          Coche encore {missing} étape{missing > 1 ? "s" : ""} pendant tes sorties : on te dira ce que tu aimes vraiment.
        </Body>
      ) : (
        <>
          {tastes.length > 0 && (
            <Body color={colors.ink} style={{ fontSize: 17, lineHeight: 24 }}>
              Tu sors surtout pour {tastes.map((share) => share.label.toLowerCase()).join(" et ")}.
            </Body>
          )}
          {/* Une barre seule ne compare rien : la répartition n'apparaît qu'à partir de deux. */}
          {taste.shares.length >= 2 &&
            taste.shares.map((share) => (
              <View key={share.theme} style={{ gap: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Overline color={colors.ink}>{share.label}</Overline>
                  <Overline>{share.count}</Overline>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.round(share.share * 100)}%` }]} />
                </View>
              </View>
            ))}
          {tastes.length > 0 && <SecondaryButton label="Appliquer à mes réglages" onPress={applyTastes} />}
        </>
      )}
    </ScrollView>
    </Paper>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.ink, padding: 14, gap: 4 },
  name: { fontFamily: fonts.display, fontSize: 30, lineHeight: 38, color: colors.paper, textTransform: "uppercase", padding: 0 },
  cityChip: { height: 32, paddingHorizontal: 10, borderWidth: rule.thin, borderColor: colors.paper3, justifyContent: "center" },
  cityChipText: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: colors.paper },
  cityInput: { flex: 1, height: 40, borderWidth: rule.thin, borderColor: colors.paper3, paddingHorizontal: 10, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.paper },
  cityAdd: { height: 40, paddingHorizontal: 12, backgroundColor: colors.accent, justifyContent: "center" },
  prefs: { backgroundColor: colors.paper2, borderWidth: rule.thin, borderColor: colors.ink, padding: 14, gap: 12 },
  band: { backgroundColor: colors.ink, paddingHorizontal: 12, paddingVertical: 8 },
  track: { height: 10, borderWidth: rule.thin, borderColor: colors.blue },
  fill: { height: "100%", backgroundColor: colors.blue },
});
