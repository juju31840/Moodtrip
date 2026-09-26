import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

import { MODE_LABELS } from "@shared/trip-modes";
import { useSavedItineraries } from "@/lib/storage";
import { cityLabel, visitsStore, type VisitedPlace } from "@/lib/visits";
import { Body, Display, Masthead, Overline } from "@/ui/kit";
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
  const mapRef = useRef<MapView>(null);

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
    mapRef.current?.fitToCoordinates(
      shown.map((place) => ({ latitude: place.location.lat, longitude: place.location.lng })),
      { edgePadding: { top: 60, right: 50, bottom: 60, left: 50 }, animated: true }
    );
    // `shown` change d'identité à chaque rendu : on ne recadre que quand la zone ou le nombre de
    // lieux change, sinon la carte se recadrerait en boucle.
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
    <ScrollView style={{ backgroundColor: colors.paper }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingTop: 12, paddingBottom: 40 }}>
      <View style={{ paddingHorizontal: 20 }}>
        <Masthead title="Ma carte" />
        <View style={styles.stats}>
          <Stat value={places.length} label={places.length > 1 ? "lieux" : "lieu"} />
          <Stat value={cities.length} label={cities.length > 1 ? "villes" : "ville"} />
          <Stat value={passages} label={passages > 1 ? "passages" : "passage"} />
        </View>
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
  outing: { borderTopWidth: rule.thin, borderColor: colors.ink, paddingVertical: 12, gap: 4, marginTop: 8 },
  placeRow: { borderTopWidth: 1, borderColor: colors.paper3, paddingVertical: 8 },
});
