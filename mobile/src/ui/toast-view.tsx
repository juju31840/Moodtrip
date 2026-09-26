import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { saveRating } from "@/lib/ratings";
import { rateStep } from "@/lib/signals";
import { showToast, toastStore } from "@/lib/toast";
import { StarIcon } from "@/ui/icons";
import { colors, fonts } from "@/ui/theme";

/**
 * La confirmation, posée au-dessus de la barre d'onglets. Deux secondes et demie pour un simple
 * message ; plus longtemps quand elle demande une note, qu'on a le temps de donner. Annoncée à
 * VoiceOver (`liveRegion`), sans bouton de fermeture : elle s'efface seule.
 */
export function ToastView() {
  const insets = useSafeAreaInsets();
  const toast = toastStore.useValue();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      if (toastStore.get()?.id === toast.id) toastStore.set(null);
    }, toast.rate ? 9000 : 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  return (
    <View style={[styles.toast, { bottom: insets.bottom + 72 }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Text style={styles.message}>{toast.message}</Text>
      {toast.rate && (
        <View style={{ gap: 6 }}>
          <Text style={styles.question}>Ton avis ?</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {[1, 2, 3, 4, 5].map((note) => (
              <Pressable
                key={note}
                accessibilityRole="button"
                accessibilityLabel={`Noter ${note} sur 5`}
                hitSlop={6}
                onPress={() => {
                  const { itineraryId, step } = toast.rate!;
                  rateStep(step, note);
                  // Gardée localement, sans quoi « Sorties » redemanderait le même avis : la base
                  // ne retient aucun registre de qui a noté quoi.
                  saveRating(itineraryId, step.id, step.placeName, note);
                  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  showToast("Merci, c’est noté");
                }}
              >
                <StarIcon filled={false} size={32} color={colors.accent} />
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toast: { position: "absolute", left: 16, right: 16, backgroundColor: colors.ink, padding: 14, gap: 10 },
  message: { fontFamily: fonts.bodyHeavy, fontSize: 14, letterSpacing: 0.4, color: colors.paper },
  question: { fontFamily: fonts.bodyHeavy, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase", color: colors.paper3 },
});
