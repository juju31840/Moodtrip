import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { formatTrajet, trajetDepuis } from "@shared/walking";
import type { ItineraryStep } from "@/types/itinerary";
import { Body, CheckBox, Display, Overline } from "@/ui/kit";
import { colors, fonts, rule } from "@/ui/theme";

const PERIOD = { morning: "Matin", midday: "Midi", evening: "Soir" } as const;

/**
 * La fin de la boucle, c'est que l'utilisateur **s'y rende vraiment** : chaque étape s'ouvre
 * dans Plans, sur le nom et l'adresse réels tirés du socle.
 */
function openInMaps(step: ItineraryStep) {
  const query = encodeURIComponent([step.placeName, step.address].filter(Boolean).join(", "));
  void Linking.openURL(`https://maps.apple.com/?q=${query}&ll=${step.location.lat},${step.location.lng}`);
}

/**
 * Les étapes d'un parcours, partagées par le détail d'une proposition et celui d'une sortie.
 * Une ligne se sélectionne (la carte la met en avant) ; « Y aller » n'apparaît que sur l'étape
 * sélectionnée — quatre boutons permanents faisaient de l'écran un formulaire (revue du site,
 * 24/09/2026).
 */
export function StepList({ steps, showDay, activeId, onSelect, done, onToggleDone }: {
  steps: ItineraryStep[];
  showDay: boolean;
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Présent sur une sortie enregistrée : la case « j'y suis allé ». */
  done?: string[];
  onToggleDone?: (step: ItineraryStep) => void;
}) {
  return (
    <View>
      {steps.map((step, index) => {
        const active = step.id === activeId;
        const previous = index > 0 ? steps[index - 1] : undefined;
        const trajet = previous ? trajetDepuis(previous, step) : null;
        const isDone = done?.includes(step.id) ?? false;
        return (
          <View key={step.id}>
            {/* Le seul élément que le modèle n'a pas écrit : il sort des coordonnées, et répond
                à la question qu'on se pose vraiment — est-ce que ça se fait à pied ? */}
            {trajet && (
              <View style={styles.walk}>
                <View style={styles.walkRule} />
                <Overline color={colors.inkMute} style={{ fontSize: 10 }}>{formatTrajet(trajet)}</Overline>
              </View>
            )}
            <Pressable onPress={() => onSelect(step.id)} style={[styles.row, active && { backgroundColor: colors.paper2 }]}>
              <Text style={[styles.number, isDone && { color: colors.inkMute }]}>{index + 1}</Text>
              <View style={{ flex: 1, gap: 4 }}>
                <Overline>{showDay ? `Jour ${step.day} · ` : ""}{PERIOD[step.period]}</Overline>
                <Display size={20} color={isDone ? colors.inkSoft : colors.ink}>{step.placeName}</Display>
                <Body>{step.description}</Body>
                {step.recognized && <Overline color={colors.blue}>★ Recommandé par la presse ou les guides</Overline>}
                {/* L'outremer dit le confirmé ; le doute ne prend aucune encre. */}
                {step.verified && <Overline color={colors.blue}>✓ {step.address ?? "Adresse confirmée"}</Overline>}
                {step.verified === false && <Overline color={colors.inkMute}>Adresse à confirmer sur place</Overline>}
                {active && (
                  <Pressable accessibilityRole="link" onPress={() => openInMaps(step)} style={styles.go}>
                    <Text style={styles.goText}>Y aller →</Text>
                  </Pressable>
                )}
              </View>
              {onToggleDone && <CheckBox checked={isDone} onToggle={() => onToggleDone(step)} label={`J'y suis allé : ${step.placeName}`} />}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, borderTopWidth: rule.thin, borderColor: colors.ink, paddingVertical: 12, paddingHorizontal: 6 },
  number: { width: 24, fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.accent },
  walk: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5, paddingLeft: 36 },
  walkRule: { width: 2, height: 12, backgroundColor: colors.inkMute },
  go: { alignSelf: "flex-start", marginTop: 6, height: 36, paddingHorizontal: 12, borderWidth: rule.thin, borderColor: colors.ink, justifyContent: "center" },
  goText: { fontFamily: fonts.bodyHeavy, fontSize: 12, letterSpacing: 0.8, textTransform: "uppercase", color: colors.ink },
});
