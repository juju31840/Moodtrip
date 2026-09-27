import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { THEMES } from "@shared/themes";
import { patchDraft } from "@/lib/draft";
import { pickProfilePhoto } from "@/lib/photo";
import { DEFAULT_CITIES, profileStore, recentCitiesStore, type Preferences } from "@/lib/profile";
import { ratingsStore } from "@/lib/ratings";
import { useSavedItineraries } from "@/lib/storage";
import { readTaste, visitsStore, VISITS_MINIMUM } from "@/lib/visits";
import { photoFor, photoRanks, type CreditedPhoto } from "@/ui/city-photo";
import { CameraIcon, StarIcon } from "@/ui/icons";
import { Body, Chip, Display, Masthead, Overline, SecondaryButton } from "@/ui/kit";
import { VibeSlider } from "@/ui/vibe-slider";
import { Paper } from "@/ui/paper";
import { colors, fonts, rule } from "@/ui/theme";

/** Exigée par l'App Store, et accessible depuis l'app, pas seulement depuis la fiche. */
const PRIVACY_URL = "https://vibetrip-schuft.vercel.app/confidentialite";

/**
 * Profil — trois registres, comme sur le site (29/08/2026) :
 * 1. la fiche, en encre pleine : ce qu'on **est** (photo, prénom, âge, villes) ;
 * 2. les préférences, papier assombri et encadré : ce qu'on **veut** ;
 * 3. les habitudes, après une bande d'encre : ce qu'on **fait**, observé, jamais demandé — et les
 *    notes qu'on a données, rendues à qui les a données.
 * Préférences et habitudes ne sont jamais fondues : l'écart entre elles est un fait sur la personne.
 */
export default function ProfilScreen() {
  const profile = profileStore.useValue();
  const places = visitsStore.useValue();
  const recent = recentCitiesStore.useValue();
  const ratings = ratingsStore.useValue();
  const saved = useSavedItineraries();
  const [showCredits, setShowCredits] = useState(false);
  // Les photos affichées dans « Sorties », créditées ici plutôt que sous la liste (retour du
  // 26/09/2026) : les licences CC BY et CC BY-SA imposent de citer l'auteur, pas l'endroit.
  const ranks = photoRanks(saved.map((entry) => ({ id: entry.id, steps: entry.itinerary.steps })));
  const credited = [
    ...new Map(
      saved
        .map((entry) => photoFor(entry.itinerary.steps, ranks.get(entry.id) ?? 0))
        .filter((photo): photo is CreditedPhoto => photo !== null)
        .map((photo) => [photo.url, photo])
    ).values(),
  ];
  const taste = readTaste(places);
  const [newCity, setNewCity] = useState("");
  const [photoError, setPhotoError] = useState<string | null>(null);

  const setPrefs = (patch: Partial<Preferences>) => profileStore.set({ ...profile, preferences: { ...profile.preferences, ...patch } });
  const prefs = profile.preferences;
  const missing = Math.max(0, VISITS_MINIMUM - taste.total);
  // Deux habitudes au plus sont reportées : en présélectionner davantage revient à tout cocher.
  const tastes = taste.shares.filter((share) => share.share >= 0.25).slice(0, 2);
  // Suggestions : les villes déjà utilisées, puis les grandes villes — un geste pour en ajouter une.
  const suggestions = [...new Set([...recent, ...DEFAULT_CITIES])]
    .filter((city) => !profile.cities.some((item) => item.toLowerCase() === city.toLowerCase()))
    .slice(0, 8);

  function addCity(value: string) {
    const city = value.trim();
    if (city.length < 2 || profile.cities.length >= 4) return;
    profileStore.set({ ...profile, cities: [...profile.cities.filter((item) => item.toLowerCase() !== city.toLowerCase()), city] });
    setNewCity("");
  }

  async function choosePhoto() {
    setPhotoError(null);
    try {
      const photo = await pickProfilePhoto();
      if (!photo) return;
      // L'échec d'écriture est dit, pas tu : sur le site, une photo refusée restait affichée et
      // disparaissait au lancement suivant sans explication.
      if (!profileStore.set({ ...profile, photo })) setPhotoError("La photo n’a pas pu être enregistrée : l’appareil manque de place.");
    } catch {
      setPhotoError("Cette image n’a pas pu être lue. Essaie une autre photo.");
    }
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
          <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={profile.photo ? "Changer la photo" : "Ajouter une photo"}
              onPress={choosePhoto}
              style={styles.photo}
            >
              {profile.photo ? <Image source={{ uri: profile.photo }} alt="" style={StyleSheet.absoluteFill} contentFit="cover" /> : <CameraIcon />}
            </Pressable>
            <View style={{ flex: 1, gap: 4 }}>
              <TextInput
                value={profile.firstName}
                onChangeText={(firstName) => profileStore.set({ ...profile, firstName })}
                placeholder="Ton prénom"
                placeholderTextColor={colors.inkMute}
                accessibilityLabel="Prénom"
                style={styles.name}
              />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <TextInput
                  value={profile.age ? String(profile.age) : ""}
                  onChangeText={(text) => {
                    const age = Number(text.replace(/\D/g, ""));
                    profileStore.set({ ...profile, age: age > 0 && age < 120 ? age : null });
                  }}
                  placeholder="Âge"
                  placeholderTextColor={colors.inkMute}
                  keyboardType="number-pad"
                  maxLength={3}
                  accessibilityLabel="Ton âge"
                  style={styles.age}
                />
                {profile.age ? <Text style={styles.ans}>ans</Text> : null}
              </View>
            </View>
          </View>
          {photoError && <Text style={styles.error}>{photoError}</Text>}
          <Overline color={colors.paper3} style={{ marginTop: 10 }}>
            {profile.cities.length > 0 ? `Sort à ${profile.cities.join(" · ")}` : "Où sors-tu ? Tes villes seront proposées en premier dans Créer."}
          </Overline>
          {profile.cities.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {profile.cities.map((city) => (
                <Pressable
                  key={city}
                  accessibilityLabel={`Retirer ${city}`}
                  onPress={() => profileStore.set({ ...profile, cities: profile.cities.filter((item) => item !== city) })}
                  style={[styles.cityChip, { backgroundColor: colors.accent, borderColor: colors.accent }]}
                >
                  <Text style={styles.cityChipText}>{city} ✕</Text>
                </Pressable>
              ))}
            </View>
          )}
          {profile.cities.length < 4 && (
            <>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {suggestions.map((city) => (
                  <Pressable key={city} accessibilityLabel={`Ajouter ${city}`} onPress={() => addCity(city)} style={styles.cityChip}>
                    <Text style={styles.cityChipText}>+ {city}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                <TextInput
                  value={newCity}
                  onChangeText={setNewCity}
                  onSubmitEditing={() => addCity(newCity)}
                  placeholder="Une autre ville"
                  placeholderTextColor={colors.inkMute}
                  accessibilityLabel="Ajouter une ville de référence"
                  returnKeyType="done"
                  style={styles.cityInput}
                />
                <Pressable accessibilityRole="button" onPress={() => addCity(newCity)} style={styles.cityAdd}>
                  <Text style={styles.cityChipText}>Ajouter</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        {/* 2. Les préférences */}
        <View style={styles.prefs}>
          <Display size={22}>Tes préférences</Display>
          <Body>Ce que tu veux. Elles préremplissent « Créer » quand tu coches « Partir de mes préférences ».</Body>
          <VibeSlider kind="budget" label="Budget" value={prefs.budget} onChange={(budget) => setPrefs({ budget })} />
          <VibeSlider kind="ambiance" label="Ambiance" value={prefs.ambiance} onChange={(ambiance) => setPrefs({ ambiance })} />
          <VibeSlider kind="distance" label="Distance" value={prefs.distance} onChange={(distance) => setPrefs({ distance })} />
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

        {/* 3. Les habitudes — « Ce qu'on a compris » ne se comprenait pas (retour du 26/09/2026). */}
        {/* Titre posé sans interlignage ajouté : sur iOS, l'espace d'interligne se loge au-dessus du
            texte, qui paraissait décentré dans sa bande (retour du 26/09/2026). */}
        <View style={styles.band}>
          <Text style={styles.bandTitle}>Tes habitudes</Text>
        </View>
        <Body>
          Ce que tu fais vraiment, d’après les étapes que tu coches pendant tes sorties — à côté de ce que tu déclares au-dessus.
          On peut les reporter dans ta prochaine sortie.
        </Body>
        {missing > 0 ? (
          // Il se tait tant qu'il ne sait pas, et dit combien il en manque : le vide devient un
          // objectif atteignable en une sortie.
          <View style={styles.empty}>
            <Overline color={colors.ink}>
              Encore {missing} étape{missing > 1 ? "s" : ""} à cocher
            </Overline>
            <View style={{ flexDirection: "row", gap: 4 }}>
              {Array.from({ length: VISITS_MINIMUM }, (_, index) => (
                <View key={index} style={[styles.dot, index < taste.total && { backgroundColor: colors.blue }]} />
              ))}
            </View>
          </View>
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
            {tastes.length > 0 && (
              <SecondaryButton
                label="Reporter dans ma prochaine sortie"
                onPress={() => {
                  patchDraft({ themes: tastes.map((share) => share.theme) });
                  router.navigate("/");
                }}
              />
            )}
          </>
        )}

        {ratings.length > 0 && (
          <View style={{ gap: 8 }}>
            <Overline color={colors.ink}>Tes notes</Overline>
            {ratings.slice(0, 6).map((rating) => (
              <View key={rating.ref} style={styles.ratingRow}>
                <Text style={styles.ratingName} numberOfLines={1}>
                  {rating.placeName}
                </Text>
                <View style={{ flexDirection: "row", gap: 2 }}>
                  {[1, 2, 3, 4, 5].map((note) => (
                    <StarIcon key={note} filled={note <= rating.note} size={16} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={{ marginTop: 12, gap: 6 }}>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(PRIVACY_URL)} hitSlop={8}>
            <Text style={styles.creditsToggle}>Confidentialité</Text>
          </Pressable>
          {credited.length > 0 && (
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showCredits }} onPress={() => setShowCredits((value) => !value)} hitSlop={8}>
              <Text style={styles.creditsToggle}>{showCredits ? "Masquer les crédits photos" : "Crédits photos"}</Text>
            </Pressable>
          )}
          {showCredits &&
            credited.map((photo) => (
              <Text key={photo.url} style={styles.credit}>
                {photo.ville} — {photo.auteur}, {photo.licence}, via Wikimedia Commons
              </Text>
            ))}
        </View>
      </ScrollView>
    </Paper>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.ink, padding: 14, gap: 8 },
  photo: { width: 76, height: 76, borderWidth: rule.thin, borderColor: colors.paper3, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  name: { fontFamily: fonts.display, fontSize: 28, lineHeight: 36, color: colors.paper, textTransform: "uppercase", padding: 0 },
  age: { minWidth: 44, fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.paper, padding: 0 },
  ans: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.paper3 },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accent },
  cityChip: { height: 32, paddingHorizontal: 10, borderWidth: rule.thin, borderColor: colors.paper3, justifyContent: "center" },
  cityChipText: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: colors.paper },
  cityInput: { flex: 1, height: 40, borderWidth: rule.thin, borderColor: colors.paper3, paddingHorizontal: 10, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.paper },
  cityAdd: { height: 40, paddingHorizontal: 12, backgroundColor: colors.accent, justifyContent: "center" },
  prefs: { backgroundColor: colors.paper2, borderWidth: rule.thin, borderColor: colors.ink, padding: 14, gap: 12 },
  band: { backgroundColor: colors.ink, paddingHorizontal: 12, paddingVertical: 10, justifyContent: "center" },
  bandTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.paper, textTransform: "uppercase" },
  empty: { borderWidth: rule.thin, borderStyle: "dashed", borderColor: colors.inkMute, padding: 12, gap: 8 },
  dot: { flex: 1, height: 10, borderWidth: rule.thin, borderColor: colors.blue },
  track: { height: 10, borderWidth: rule.thin, borderColor: colors.blue },
  fill: { height: "100%", backgroundColor: colors.blue },
  creditsToggle: { fontFamily: fonts.bodyHeavy, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: colors.inkMute, textDecorationLine: "underline" },
  credit: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.inkMute },
  ratingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderColor: colors.paper3, paddingVertical: 8, gap: 10 },
  ratingName: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
});
