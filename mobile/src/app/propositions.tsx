import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { vibeLabel } from "@shared/vibe-labels";
import { trajetDepuis } from "@shared/walking";
import { patchDraft } from "@/lib/draft";
import { startGeneration, useGeneration } from "@/lib/generation";
import type { GenerateItineraryRequest } from "@/types/itinerary";
import type { Itinerary } from "@/types/itinerary";
import { Body, Display, IconButton, Overline } from "@/ui/kit";
import { RouteThumb } from "@/ui/route-thumb";
import { Paper } from "@/ui/paper";
import { colors, fonts, printShadow, rule } from "@/ui/theme";

const MODE_TITLE = { tonight: "ce soir", weekend: "ce week-end", trip: "ton voyage" } as const;

/**
 * « La même, mais… » — refaire les propositions en ne bougeant qu'un réglage d'un cran, sans
 * repasser par Créer. On le voit en regardant les idées, pas avant : c'est devant un programme
 * qu'on sait qu'on le voudrait plus festif ou moins cher. Un raccourci qui ne changerait rien (déjà
 * au bout du curseur) n'est pas proposé.
 */
const VARIANTES: { label: string; key: "budget" | "ambiance" | "distance"; delta: number }[] = [
  { label: "Plus festive", key: "ambiance", delta: 25 },
  { label: "Plus calme", key: "ambiance", delta: -25 },
  { label: "Moins cher", key: "budget", delta: -25 },
  { label: "Plus chic", key: "budget", delta: 25 },
  { label: "Plus près", key: "distance", delta: -25 },
  { label: "Plus loin", key: "distance", delta: 25 },
];

function relaunch(request: GenerateItineraryRequest, key: "budget" | "ambiance" | "distance", delta: number) {
  const value = Math.min(100, Math.max(0, request[key] + delta));
  // Reporté dans Créer : en y revenant, on retrouve le réglage qui a donné ces idées.
  patchDraft({ [key]: value });
  startGeneration({ ...request, [key]: value });
  router.replace("/attente");
}
const COUNT = ["Zéro", "Une", "Deux", "Trois"];

/**
 * Choix en deux temps, comme sur le site : ici on compare, le détail s'ouvre ensuite. La carte
 * du parcours sert d'image — elle dit ce qu'une photo ne dirait pas : un parcours de quartier
 * et un parcours qui traverse la ville ne se ressemblent pas.
 */
export default function PropositionsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { request, proposals, expected, status } = useGeneration();
  const waiting = status === "loading" ? Math.max(0, expected - proposals.length) : 0;
  const total = proposals.length + waiting;
  const cardWidth = width - 40;

  return (
    <Paper style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", paddingHorizontal: 20 }}>
          <IconButton label="Revenir aux réglages" glyph="←" onPress={() => router.dismissAll()} />
          <View style={{ flex: 1, gap: 6 }}>
            <Display size={30}>{`${COUNT[total] ?? total} idée${total > 1 ? "s" : ""} pour ${request ? MODE_TITLE[request.mode] : "toi"}`}</Display>
            {request && (
              <Body>
                {"city" in request.location ? request.location.city : "Autour de toi"} · {vibeLabel("budget", request.budget)} ·{" "}
                {vibeLabel("ambiance", request.ambiance)} · {vibeLabel("distance", request.distance)}
              </Body>
            )}
          </View>
        </View>

        {request && status !== "loading" && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.variants}>
            <Overline style={{ alignSelf: "center" }}>La même, mais</Overline>
            {VARIANTES.filter(({ key, delta }) => {
              const next = request[key] + delta;
              return next >= 0 && next <= 100;
            }).map(({ label, key, delta }) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityLabel={`Refaire, ${label.toLowerCase()}`}
                onPress={() => relaunch(request, key, delta)}
                style={({ pressed }) => [styles.variant, pressed && { backgroundColor: colors.ink }]}
              >
                {({ pressed }) => <Text style={[styles.variantText, pressed && { color: colors.paper }]}>{label}</Text>}
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={{ borderTopWidth: rule.major, borderColor: colors.ink, marginTop: 14, paddingTop: 16, paddingHorizontal: 20, gap: 18 }}>
          {proposals.map((proposal) => (
            <ProposalCard key={proposal.id} proposal={proposal} width={cardWidth} />
          ))}
          {/* L'emplacement d'attente a la forme exacte d'une carte remplie : sinon la liste saute
              au moment où l'on pose le doigt dessus (leçon du site). */}
          {Array.from({ length: waiting }, (_, index) => (
            <View key={index} style={[styles.placeholder, { height: 150 + 96 }]}>
              <Overline color={colors.inkMute}>Idée suivante en route…</Overline>
            </View>
          ))}
        </View>
      </ScrollView>
    </Paper>
  );
}

function walkingMinutes(proposal: Itinerary): number {
  let minutes = 0;
  proposal.steps.forEach((step, index) => {
    if (index === 0) return;
    const trajet = trajetDepuis(proposal.steps[index - 1]!, step);
    if (trajet?.aPied) minutes += trajet.minutes;
  });
  return minutes;
}

function ProposalCard({ proposal, width }: { proposal: Itinerary; width: number }) {
  const recognized = proposal.steps.filter((step) => step.recognized).length;
  const minutes = walkingMinutes(proposal);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/proposition/[id]", params: { id: proposal.id } })}
      style={({ pressed }) => [styles.card, printShadow, pressed && { backgroundColor: colors.paper2 }]}
    >
      <View style={{ height: 150, overflow: "hidden", borderBottomWidth: rule.thin, borderColor: colors.ink }}>
        <RouteThumb steps={proposal.steps} width={width - 4} height={150} />
        <View style={styles.band}>
          <Display size={21} color={colors.paper}>{proposal.tripName}</Display>
        </View>
      </View>
      <View style={{ padding: 12, gap: 6 }}>
        <Body>{proposal.summary}</Body>
        <Overline color={colors.inkSoft}>
          {proposal.steps.length} étapes{minutes > 0 ? ` · ${minutes} min à pied au total` : ""}
        </Overline>
        {recognized > 0 && <Overline color={colors.blue}>★ {recognized} adresse{recognized > 1 ? "s" : ""} reconnue{recognized > 1 ? "s" : ""}</Overline>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: rule.thin, borderColor: colors.ink, backgroundColor: colors.paper },
  band: { position: "absolute", left: 0, bottom: 0, maxWidth: "92%", backgroundColor: colors.ink, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 },
  variants: { gap: 6, paddingHorizontal: 20, paddingTop: 14 },
  variant: { height: 36, paddingHorizontal: 12, borderWidth: rule.thin, borderColor: colors.ink, justifyContent: "center" },
  variantText: { fontFamily: fonts.bodyHeavy, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", color: colors.ink },
  placeholder: { borderWidth: rule.thin, borderStyle: "dashed", borderColor: colors.inkMute, alignItems: "center", justifyContent: "center" },
});
