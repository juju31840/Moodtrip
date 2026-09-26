import { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { flat, localSuggestions, remoteSuggestions, type CitySuggestion } from "@/lib/city-search";
import { PinIcon } from "@/ui/icons";
import { colors, fonts, rule } from "@/ui/theme";

/**
 * Le champ de ville avec sa liste de suggestions, qui s'affine à chaque lettre. Les villes connues
 * répondent aussitôt ; la recherche en ligne attend une courte pause entre deux frappes, et une
 * réponse périmée (lettre suivante déjà tapée) est abandonnée plutôt qu'affichée à tort.
 */
export function CityField({ value, usingPosition, preferred, onChangeText, onPick }: {
  value: string;
  usingPosition: boolean;
  /** Villes du profil puis dernières utilisées : proposées en premier, et seules quand le champ est vide. */
  preferred: string[];
  onChangeText: (text: string) => void;
  onPick: (city: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [remote, setRemote] = useState<CitySuggestion[]>([]);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    controller.current?.abort();
    setRemote([]);
    if (!focused || value.trim().length < 2) return;
    const current = new AbortController();
    controller.current = current;
    const timer = setTimeout(() => {
      remoteSuggestions(value, current.signal)
        .then((found) => {
          if (!current.signal.aborted) setRemote(found);
        })
        .catch(() => {
          // Hors ligne ou requête abandonnée : les villes connues suffisent.
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      current.abort();
    };
  }, [value, focused]);

  // Les villes connues d'abord, complétées par la recherche en ligne ; un même nom n'apparaît
  // qu'une fois, avec son département quand la recherche en ligne le donne.
  const local = localSuggestions(usingPosition ? "" : value, preferred);
  const merged: CitySuggestion[] = [];
  for (const item of [...local, ...remote]) {
    const existing = merged.find((other) => flat(other.name) === flat(item.name));
    if (!existing) merged.push(item);
    else if (!existing.context && item.context) existing.context = item.context;
  }
  const suggestions = merged.slice(0, 7);
  const showList = focused && suggestions.length > 0 && !(suggestions.length === 1 && flat(suggestions[0]!.name) === flat(value));

  function pick(city: string) {
    onPick(city);
    setFocused(false);
    Keyboard.dismiss();
  }

  return (
    <View style={{ flex: 1 }}>
      <TextInput
        value={usingPosition ? "Ma position" : value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={() => suggestions[0] && pick(suggestions[0].name)}
        placeholder="Une ville"
        placeholderTextColor={colors.inkMute}
        accessibilityLabel="Ville de départ"
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        style={[styles.input, focused && { borderColor: colors.accent }]}
      />
      {showList && (
        <View style={styles.list} accessibilityRole="list">
          {suggestions.map((suggestion, index) => (
            <Pressable
              key={`${suggestion.name}-${suggestion.context ?? ""}`}
              accessibilityRole="button"
              accessibilityLabel={suggestion.context ? `${suggestion.name}, ${suggestion.context}` : suggestion.name}
              onPress={() => pick(suggestion.name)}
              style={({ pressed }) => [styles.row, index > 0 && styles.rowRule, pressed && { backgroundColor: colors.paper2 }]}
            >
              <PinIcon size={16} color={colors.inkSoft} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{suggestion.name}</Text>
                {suggestion.context && <Text style={styles.context}>{suggestion.context}</Text>}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { height: 48, borderWidth: rule.thin, borderColor: colors.ink, paddingHorizontal: 12, fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  list: { borderWidth: rule.thin, borderTopWidth: 0, borderColor: colors.ink, backgroundColor: colors.paper },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, minHeight: 48, paddingVertical: 8 },
  rowRule: { borderTopWidth: 1, borderColor: colors.paper3 },
  name: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  context: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMute },
});
