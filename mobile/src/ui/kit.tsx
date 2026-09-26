import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import { colors, fonts, printShadow, rule } from "@/ui/theme";

/**
 * Les briques de l'interface, une seule définition chacune — la leçon des étiquettes du site,
 * qui existaient en quatre métriques dans quatre fichiers et en deux encres.
 */

export function Display({ children, size = 34, color = colors.ink, style }: {
  children: ReactNode;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  // Sur iOS, Anton dépasse de sa boîte au-dessus des capitales : l'interlignage serré du site
  // (1,04) y coupe le haut des lettres — premier retour sur Expo Go, « des mots coupés ».
  // 1,2 laisse passer les capitales sans décoller les lignes d'un titre sur deux lignes.
  return (
    <Text style={[{ fontFamily: fonts.display, fontSize: size, lineHeight: Math.round(size * 1.2), color, textTransform: "uppercase" }, style]}>
      {children}
    </Text>
  );
}

export function Overline({ children, color = colors.inkSoft, style }: {
  children: ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.overline, { color }, style]}>{children}</Text>;
}

export function Body({ children, color = colors.inkSoft, style }: {
  children: ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.body, { color }, style]}>{children}</Text>;
}

/** Masthead d'onglet : le titre et son filet, identique sur les quatre onglets. */
export function Masthead({ title }: { title: string }) {
  return (
    <View style={styles.masthead}>
      <Text style={styles.mastheadText}>{title}</Text>
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && { color: colors.paper }]}>{label}</Text>
    </Pressable>
  );
}

/** Action principale : encre pleine, le contraste le plus fort sur papier. */
export function PrimaryButton({ label, onPress, disabled, style }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => [styles.primary, disabled && { opacity: 0.4 }, pressed && { backgroundColor: colors.accentDeep }, style]}
    >
      <Text style={styles.primaryText}>{label}</Text>
      <Text style={styles.primaryText}>→</Text>
    </Pressable>
  );
}

export function IconButton({ label, glyph, onPress, style }: {
  label: string;
  glyph: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.iconButton, printShadow, style]}>
      <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 18, color: colors.ink }}>{glyph}</Text>
    </Pressable>
  );
}

/**
 * Curseur à cinq paliers, dessiné en cinq cases et non en piste continue : sur téléphone, un
 * palier se touche mieux qu'il ne se glisse, et le mot affiché change à chaque case — c'est ce
 * qui rendait les curseurs du site lisibles.
 */
export function StepPicker({ label, word, value, onChange }: {
  label: string;
  word: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const index = Math.round(value / 25);
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.pickerHead}>
        <Overline>{label}</Overline>
        <Display size={20}>{word}</Display>
      </View>
      <View style={styles.pickerRow} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ text: word }}>
        {[0, 1, 2, 3, 4].map((step) => (
          <Pressable
            key={step}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(step * 25);
            }}
            style={[styles.pickerCell, step > 0 && { borderLeftWidth: rule.thin }, step <= index && { backgroundColor: step === index ? colors.accent : colors.paper3 }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overline: { fontFamily: fonts.bodyHeavy, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase" },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  masthead: { borderBottomWidth: rule.major, borderColor: colors.ink, paddingBottom: 8 },
  mastheadText: { fontFamily: fonts.display, fontSize: 52, lineHeight: 64, color: colors.ink, textTransform: "uppercase" },
  chip: { height: 38, paddingHorizontal: 12, borderWidth: rule.thin, borderColor: colors.ink, justifyContent: "center" },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: colors.ink },
  primary: { height: 56, backgroundColor: colors.ink, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 },
  primaryText: { fontFamily: fonts.bodyHeavy, fontSize: 16, letterSpacing: 1, color: colors.paper, textTransform: "uppercase" },
  iconButton: { width: 44, height: 44, backgroundColor: colors.paper, borderWidth: rule.thin, borderColor: colors.ink, alignItems: "center", justifyContent: "center" },
  pickerHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  pickerRow: { flexDirection: "row", height: 30, borderWidth: rule.thin, borderColor: colors.ink },
  pickerCell: { flex: 1, borderColor: colors.ink },
});

/** Case à cocher « j'y suis allé » — carrée, comme tout le système ; le vermillon dit l'action faite. */
export function CheckBox({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => {
        void Haptics.impactAsync(checked ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
        onToggle();
      }}
      style={[checkStyles.box, checked && { backgroundColor: colors.accent, borderColor: colors.accent }]}
    >
      {checked && <Text style={checkStyles.mark}>✓</Text>}
    </Pressable>
  );
}

/** Bouton secondaire : filet d'encre, sans aplat. */
export function SecondaryButton({ label, onPress, style }: { label: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [checkStyles.secondary, pressed && { backgroundColor: colors.paper2 }, style]}>
      <Text style={checkStyles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

const checkStyles = StyleSheet.create({
  box: { width: 30, height: 30, borderWidth: rule.thin, borderColor: colors.ink, alignItems: "center", justifyContent: "center" },
  mark: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: colors.paper },
  secondary: { height: 48, borderWidth: rule.thin, borderColor: colors.ink, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  secondaryText: { fontFamily: fonts.bodyHeavy, fontSize: 13, letterSpacing: 0.8, textTransform: "uppercase", color: colors.ink },
});
