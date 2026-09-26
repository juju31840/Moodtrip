import { router } from "expo-router";
import { useEffect } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ratingsStore } from "@/lib/ratings";
import { computeStamps, seenStampsStore } from "@/lib/stamps";
import { useSavedItineraries } from "@/lib/storage";
import { visitsStore } from "@/lib/visits";
import { Body, Display, IconButton, Overline } from "@/ui/kit";
import { Paper } from "@/ui/paper";
import { StampView } from "@/ui/stamp";

/** Tous les tampons : ceux gagnés, puis ceux à gagner — en pointillé, avec ce qu'il faut faire. */
export default function TamponsScreen() {
  const insets = useSafeAreaInsets();
  const places = visitsStore.useValue();
  const outings = useSavedItineraries();
  const rated = ratingsStore.useValue().length;
  const seen = seenStampsStore.useValue();
  const stamps = computeStamps(places, outings, rated);
  const earned = stamps.filter((stamp) => stamp.earned);

  // Vus ici, ils perdent leur mention « nouveau ».
  useEffect(() => {
    const ids = earned.map((stamp) => stamp.id);
    if (ids.some((id) => !seenStampsStore.get().includes(id))) seenStampsStore.set([...new Set([...seenStampsStore.get(), ...ids])]);
  }, [earned.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Paper style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 30, gap: 16 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <IconButton label="Revenir à ma carte" glyph="←" onPress={() => router.back()} />
          <View style={{ flex: 1, gap: 4 }}>
            <Display size={34}>Tes tampons</Display>
            <Overline>
              {earned.length} gagnés · {stamps.length - earned.length} à gagner
            </Overline>
          </View>
        </View>
        <Body>Chaque première fois laisse un tampon : une nouvelle ville, un premier voyage, une sortie bouclée jusqu’au bout.</Body>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 22 }}>
          {stamps.map((stamp) => (
            <StampView key={stamp.id} stamp={stamp} isNew={stamp.earned && !seen.includes(stamp.id)} />
          ))}
        </View>
      </ScrollView>
    </Paper>
  );
}
