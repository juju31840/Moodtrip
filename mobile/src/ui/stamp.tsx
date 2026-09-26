import { StyleSheet, Text, View } from "react-native";

import type { Stamp } from "@/lib/stamps";
import { colors, fonts } from "@/ui/theme";

/**
 * Un tampon, dessiné comme un coup de tampon d'imprimerie : double filet, capitales, légère
 * inclinaison qui varie d'un tampon à l'autre. Outremer pour les villes, encre de surimpression
 * pour les premières fois ; en pointillé gris tant qu'il n'est pas gagné, avec ce qu'il faut faire.
 */
export function StampView({ stamp, isNew = false, size = 104 }: { stamp: Stamp; isNew?: boolean; size?: number }) {
  const ink = !stamp.earned ? colors.inkMute : stamp.kind === "city" ? colors.blue : colors.overprint;
  // Inclinaison stable pour un même tampon, entre -4° et 4° : plus, et les filets se crénelaient.
  const tilt = ((stamp.id.split("").reduce((sum, c) => sum + c.charCodeAt(0), 0) % 9) - 4).toFixed(1);
  // Taille fixée par le mot le plus long, pour qu'aucun mot ne soit coupé en deux (« MARSEIL / LE »,
  // retour du 26/09/2026) : le texte ne revient à la ligne qu'entre deux mots. Anton est étroit —
  // une capitale y occupe environ la moitié de sa hauteur.
  const inner = size - 30;
  const longest = Math.max(...stamp.title.split(/\s+/).map((word) => word.length));
  const fontSize = Math.min(18, Math.floor(inner / (longest * 0.52)));
  return (
    <View
      accessible
      accessibilityLabel={stamp.earned ? `Tampon ${stamp.title}` : `Tampon à gagner : ${stamp.title}. ${stamp.hint}`}
      style={{ width: size, alignItems: "center", gap: 4 }}
    >
      <View
        style={[
          styles.outer,
          { width: size, height: size * 0.78, borderColor: ink, transform: [{ rotate: `${tilt}deg` }] },
          !stamp.earned && { borderStyle: "dashed", opacity: 0.7 },
        ]}
      >
        <View style={[styles.inner, { borderColor: ink }, !stamp.earned && { borderStyle: "dashed" }]}>
          {stamp.kind === "first" && <Text style={[styles.kicker, { color: ink }]}>{stamp.earned ? "Fait" : "À faire"}</Text>}
          <Text style={[styles.title, { color: ink, fontSize, lineHeight: Math.round(fontSize * 1.2) }]} numberOfLines={3}>
            {stamp.title}
          </Text>
        </View>
      </View>
      {isNew && (
        <View style={styles.new}>
          <Text style={styles.newText}>Nouveau</Text>
        </View>
      )}
      {!stamp.earned && stamp.hint ? <Text style={styles.hint}>{stamp.hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { borderWidth: 3, padding: 3 },
  inner: { flex: 1, borderWidth: 1.5, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  kicker: { fontFamily: fonts.bodyHeavy, fontSize: 8, letterSpacing: 1.2, textTransform: "uppercase" },
  title: { fontFamily: fonts.display, textAlign: "center", textTransform: "uppercase" },
  new: { position: "absolute", top: -6, right: -4, backgroundColor: colors.accent, paddingHorizontal: 5, paddingVertical: 2 },
  newText: { fontFamily: fonts.bodyHeavy, fontSize: 8, letterSpacing: 1, textTransform: "uppercase", color: colors.paper },
  hint: { fontFamily: fonts.body, fontSize: 11, lineHeight: 14, color: colors.inkMute, textAlign: "center" },
});
