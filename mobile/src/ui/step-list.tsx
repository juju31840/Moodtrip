import { useEffect, useState, type ReactNode } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { formatTrajet, trajetDepuis } from "@shared/walking";
import { contactFor, type Contact } from "@/lib/contact";
import type { ItineraryStep } from "@/types/itinerary";
import { GlobeIcon, GoIcon, PhoneIcon, SwapIcon } from "@/ui/icons";
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
export function StepList({ steps, showDay, activeId, onSelect, done, onToggleDone, editingId, onToggleEdit, renderEdit, closed }: {
  steps: ItineraryStep[];
  showDay: boolean;
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Présent sur une sortie enregistrée : la case « j'y suis allé ». */
  done?: string[];
  onToggleDone?: (step: ItineraryStep) => void;
  /** Présent sur une proposition non validée : « Changer » et son panneau. */
  editingId?: string | null;
  onToggleEdit?: (step: ItineraryStep) => void;
  renderEdit?: (step: ItineraryStep) => ReactNode;
  /** Noms des lieux fermés depuis l'enregistrement. */
  closed?: Set<string>;
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
                {/* Le seul endroit où le vermillon sort de son rôle d'action, comme sur le site : un
                    lieu fermé est rare et sans appel — ne pas le distinguer laisserait partir
                    quelqu'un devant une porte close pour préserver une règle graphique. */}
                {closed?.has(step.placeName) && <Overline color={colors.accent}>Fermé depuis — à remplacer</Overline>}
                {step.recognized && <Overline color={colors.blue}>★ Adresse reconnue</Overline>}
                {/* L'outremer dit le confirmé ; le doute ne prend aucune encre. */}
                {step.verified && <Overline color={colors.blue}>✓ {step.address ?? "Adresse confirmée"}</Overline>}
                {step.verified === false && <Overline color={colors.inkMute}>Adresse à confirmer sur place</Overline>}
                {(active || editingId === step.id) && (
                  // Une rangée d'icônes sans cadres plutôt que quatre boutons encadrés (« trop de
                  // carrés », 26/09/2026). « Y aller » en vermillon : c'est l'action principale.
                  <View style={styles.actions}>
                    <Action icon={<GoIcon color={colors.accent} />} label="Y aller" color={colors.accent} onPress={() => openInMaps(step)} role="link" />
                    <ContactButtons step={step} />
                    {onToggleEdit && (
                      <Action
                        icon={<SwapIcon color={editingId === step.id ? colors.accent : colors.ink} />}
                        label={editingId === step.id ? "Annuler" : "Changer"}
                        color={editingId === step.id ? colors.accent : colors.ink}
                        onPress={() => onToggleEdit(step)}
                      />
                    )}
                  </View>
                )}
              </View>
              {onToggleDone && <CheckBox checked={isDone} onToggle={() => onToggleDone(step)} label={`J'y suis allé : ${step.placeName}`} />}
            </Pressable>
            {editingId === step.id && renderEdit?.(step)}
          </View>
        );
      })}
    </View>
  );
}

/**
 * « Appeler » et « Site » — le geste entre « ça me tente » et « j'y vais » : réserver une table.
 * Lus à la demande, seulement pour l'étape sélectionnée, et absents quand le lieu n'en a pas.
 */
export function ContactButtons({ step }: { step: ItineraryStep }) {
  const [contact, setContact] = useState<Contact | null>(null);
  useEffect(() => {
    if (!step.placeId) return;
    let cancelled = false;
    void contactFor(step.placeId).then((found) => {
      if (!cancelled) setContact(found);
    });
    return () => {
      cancelled = true;
    };
  }, [step.placeId]);
  if (!contact) return null;
  return (
    <>
      {contact.tel && (
        <Action
          icon={<PhoneIcon />}
          label="Appeler"
          role="link"
          onPress={() => void Linking.openURL(`tel:${contact.tel!.replace(/[^\d+]/g, "")}`)}
        />
      )}
      {contact.website && (
        <Action
          icon={<GlobeIcon />}
          label="Site"
          role="link"
          onPress={() => void Linking.openURL(contact.website!.startsWith("http") ? contact.website! : `https://${contact.website}`)}
        />
      )}
    </>
  );
}

/** Une action d'étape : une icône et un mot dessous, sans cadre ; 48 points de haut au toucher. */
function Action({ icon, label, onPress, color = colors.ink, role = "button" }: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  color?: string;
  role?: "button" | "link";
}) {
  return (
    <Pressable accessibilityRole={role} accessibilityLabel={label} onPress={onPress} hitSlop={6} style={({ pressed }) => [styles.action, pressed && { opacity: 0.5 }]}>
      {icon}
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, borderTopWidth: rule.thin, borderColor: colors.ink, paddingVertical: 12, paddingHorizontal: 6 },
  number: { width: 24, fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.accent },
  walk: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5, paddingLeft: 36 },
  walkRule: { width: 2, height: 12, backgroundColor: colors.inkMute },
  actions: { flexDirection: "row", gap: 22, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: colors.paper3 },
  action: { minHeight: 48, minWidth: 44, alignItems: "center", justifyContent: "center", gap: 4 },
  actionText: { fontFamily: fonts.bodyHeavy, fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase" },
});
