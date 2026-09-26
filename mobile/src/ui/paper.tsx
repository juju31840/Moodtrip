import type { ReactNode } from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors } from "@/ui/theme";

/**
 * Le papier journal Riso : gris froid et trame de points, comme la classe `.grain` du site. La
 * direction repose autant sur ce grain que sur ses deux encres — un fond uni la faisait passer
 * pour une interface quelconque. Une tuile de 4 points répétée, au lieu du dégradé CSS du site,
 * que React Native ne connaît pas.
 */
export function Paper({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: colors.paper }, style]}>
      {/* Décoratif : ni cible de toucher, ni lu par VoiceOver. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image source={require("../../assets/images/grain.png")} resizeMode="repeat" alt="" accessibilityElementsHidden style={StyleSheet.absoluteFill} />
      </View>
      {children}
    </View>
  );
}
