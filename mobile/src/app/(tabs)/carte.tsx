import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

import { MODE_LABELS } from "@shared/trip-modes";
import { useSavedItineraries } from "@/lib/storage";
import { cityProgress } from "@/lib/city-progress";
import { cityAt } from "@/lib/geocode";
import { ratingsStore } from "@/lib/ratings";
import { computeStamps, seenStampsStore } from "@/lib/stamps";
import { StampView } from "@/ui/stamp";
import { cityLabel, resolveMissingCities, visitsStore, type VisitedPlace } from "@/lib/visits";
import { Body, Display, Masthead, Overline } from "@/ui/kit";
import { Paper } from "@/ui/paper";
import { colors, fonts, rule } from "@/ui/theme";

const FRANCE = { latitude: 46.6, longitude: 2.4, latitudeDelta: 10.5, longitudeDelta: 10.5 };

/**
 * « Ma carte » — chaque étape cochée y pose un point, et elle ne se vide jamais. Mêmes choix que
 * sur le site : vue France par défaut, qui donne la mesure de la collection (combien de villes,
 * où l'on n'est jamais allé) ; un marqueur par ville portant son nombre de lieux, touché pour y
 * entrer ; et sous une ville, les sorties qu'on y a faites — la carte ramène à la sortie.
 */
export default function CarteScreen() {
  const places = visitsStore.useValue();
  const saved = useSavedItineraries();
  const [zone, setZone] = useState<string | null>(null);
  const rated = ratingsStore.useValue().length;
  const seen = seenStampsStore.useValue();
  const stamps = computeStamps(places, saved, rated);
  const earnedStamps = stamps.filter((stamp) => stamp.earned);
  const [progress, setProgress] = useState<{ city: string; done: number; total: number } | null>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    void resolveMissingCities(cityAt);
  }, [places.length]);

  const cities = useMemo(() => {
    const groups = new Map<string, VisitedPlace[]>();
    for (const place of places) {
      const key = cityLabel(place.city);
      groups.set(key, [...(groups.get(key) ?? []), place]);
    }
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [places]);

  // Une ville dont on a décoché le dernier lieu disparaît : l'onglet retombe sur la France.
  const current = zone && cities.some(([name]) => name === zone) ? zone : null;
  const shown = current ? cities.find(([name]) => name === current)![1] : places;
  const passages = places.reduce((sum, place) => sum + place.refs.length, 0);

  useEffect(() => {
    if (!current) {
      mapRef.current?.animateToRegion(FRANCE, 400);
      return;
    }
    // Cadre sur les lieux de la ville, mais jamais plus serré qu'un quartier : avec un seul lieu,
    // le recadrage descendait au ras du point (retour du 26/09/2026, Toulouse).
    const lats = shown.map((place) => place.location.lat);
    const lngs = shown.map((place) => place.location.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    mapRef.current?.animateToRegion(
      {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max(0.035, (maxLat - minLat) * 1.6),
        longitudeDelta: Math.max(0.035, (maxLng - minLng) * 1.6),
      },
      500
    );
    // `shown` change d'identité à chaque rendu : on ne recadre que quand la zone ou le nombre de
    // lieux change, sinon la carte se recadrerait en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, shown.length]);

  // La progression dans la ville ouverte : ses adresses reconnues déjà faites.
  useEffect(() => {
    setProgress(null);
    if (!current) return;
    let cancelled = false;
    void cityProgress(current, shown).then((found) => {
      if (!cancelled && found) setProgress({ city: current, ...found });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, shown.length]);

  // Les sorties rattachées à la ville : par un passage coché (preuve directe), ou par une étape
  // située dans la commune — pour retrouver aussi celles enregistrées et jamais entamées.
  const outings = current
    ? saved.filter(
        ({ id, itinerary }) =>
          shown.some((place) => place.refs.some((ref) => ref.startsWith(`${id}:`))) ||
          itinerary.steps.some((step) => cityLabel(step.city ?? null) === current)
      )
    : [];

  return (
    <Paper style={{ flex: 1 }}>
    <ScrollView
 style={{ backgroundColor: "transparent" }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingTop: 12, paddingBottom: 40 }}>
      <View style={{ paddingHorizontal: 20 }}>
        <Masthead title="Ma carte" />
        <View style={styles.stats}>
          <Stat value={places.length} label={places.length > 1 ? "lieux" : "lieu"} />
          <Stat value={cities.length} label={cities.length > 1 ? "villes" : "ville"} />
          <Stat value={passages} label={passages > 1 ? "passages" : "passage"} />
        </View>

        {/* Les tampons : les gagnés d'abord, sinon trois à gagner — c'est ce qui donne envie de
            remplir la carte. Toute la collection est sur sa propre page. */}
        <Pressable accessibilityRole="button" onPress={() => router.push("/tampons")} style={styles.stampsHead}>
          <Overline color={colors.ink}>Tes tampons · {earnedStamps.length} / {stamps.length}</Overline>
          <Text style={styles.link}>Tout voir →</Text>
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingTop: 14, paddingBottom: 10, paddingLeft: 4, paddingRight: 24 }}>
          {(earnedStamps.length > 0 ? earnedStamps.slice(0, 8) : stamps.slice(0, 3)).map((stamp) => (
            <Pressable key={stamp.id} onPress={() => router.push("/tampons")}>
              <StampView stamp={stamp} size={88} isNew={stamp.earned && !seen.includes(stamp.id)} />
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {places.length === 0 ? (
        <Body style={{ paddingHorizontal: 20, marginTop: 16 }}>
          Pendant une sortie, coche les étapes où tu es allé : chacune posera ici un point, rangé par ville.
        </Body>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={{ paddingHorizontal: 12 }}>
            {[null, ...cities.map(([name]) => name)].map((name) => (
              <Pressable key={name ?? "france"} onPress={() => setZone(name)} style={[styles.tab, current === name && styles.tabActive]}>
                <Text style={[styles.tabText, current === name && { color: colors.ink }]}>{name ?? "France"}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.map}>
            <MapView ref={mapRef} style={StyleSheet.absoluteFill} initialRegion={FRANCE} showsPointsOfInterests={false}>
              {current
                ? shown.map((place) => (
                    <Marker key={place.key} coordinate={{ latitude: place.location.lat, longitude: place.location.lng }} title={place.name} tracksViewChanges={false}>
                      {/* Pas de numéro : les lieux visités sont une collection, pas un trajet. */}
                      <View style={styles.dot} />
                    </Marker>
                  ))
                : cities.map(([name, group]) => {
                    const lat = group.reduce((sum, place) => sum + place.location.lat, 0) / group.length;
                    const lng = group.reduce((sum, place) => sum + place.location.lng, 0) / group.length;
                    return (
                      <Marker key={name} coordinate={{ latitude: lat, longitude: lng }} onPress={() => setZone(name)} tracksViewChanges={false}>
                        <View style={styles.cityPin}>
                          <Text style={styles.cityPinText}>{group.length}</Text>
                        </View>
                      </Marker>
                    );
                  })}
            </MapView>
          </View>

          <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
            {current ? (
              <>
                {progress?.city === current && (
                  <View style={{ gap: 6, marginBottom: 14 }}>
                    <Overline color={colors.ink}>
                      {current} : {progress.done} adresse{progress.done > 1 ? "s" : ""} reconnue{progress.done > 1 ? "s" : ""} sur {progress.total}
                    </Overline>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${Math.max(2, (progress.done / progress.total) * 100)}%` }]} />
                    </View>
                  </View>
                )}
                <Overline>Tes sorties à {current}</Overline>
                {outings.map(({ id, itinerary, doneStepIds }) => (
                  <Pressable
                    key={id}
                    onPress={() => router.push({ pathname: "/sortie/[id]", params: { id } })}
                    style={({ pressed }) => [styles.outing, pressed && { backgroundColor: colors.paper2 }]}
                  >
                    <Display size={20}>{itinerary.tripName}</Display>
                    <Overline color={doneStepIds.length > 0 ? colors.blue : colors.inkMute}>
                      {MODE_LABELS[itinerary.mode]} ·{" "}
                      {doneStepIds.length > 0 ? `${doneStepIds.length}/${itinerary.steps.length} faites` : "Pas encore faite"}
                    </Overline>
                  </Pressable>
                ))}
                {shown.map((place) => (
                  <Body key={place.key} style={styles.placeRow}>
                    {place.name}
                  </Body>
                ))}
              </>
            ) : (
              <Body>Touche une ville pour retrouver les sorties que tu y as faites.</Body>
            )}
          </View>
        </>
      )}
    </ScrollView>
    </Paper>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
      <Display size={30}>{String(value)}</Display>
      <Overline>{label}</Overline>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", gap: 18, marginTop: 10 },
  tabs: { marginTop: 8, borderBottomWidth: rule.thin, borderColor: colors.ink, flexGrow: 0 },
  tab: { height: 40, paddingHorizontal: 12, justifyContent: "center", borderBottomWidth: 3, borderColor: "transparent" },
  tabActive: { borderColor: colors.accent },
  tabText: { fontFamily: fonts.bodyHeavy, fontSize: 12, letterSpacing: 0.9, textTransform: "uppercase", color: colors.inkSoft },
  map: { height: 340, borderBottomWidth: rule.thin, borderColor: colors.ink },
  dot: { width: 12, height: 12, backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.paper },
  cityPin: { minWidth: 34, height: 34, paddingHorizontal: 6, backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.paper, alignItems: "center", justifyContent: "center" },
  cityPinText: { fontFamily: fonts.display, fontSize: 18, color: colors.paper },
  stampsHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 },
  link: { fontFamily: fonts.bodyHeavy, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: colors.inkSoft },
  track: { height: 10, borderWidth: rule.thin, borderColor: colors.blue },
  fill: { height: "100%", backgroundColor: colors.blue },
  outing: { borderTopWidth: rule.thin, borderColor: colors.ink, paddingVertical: 12, gap: 4, marginTop: 8 },
  placeRow: { borderTopWidth: 1, borderColor: colors.paper3, paddingVertical: 8 },
});
