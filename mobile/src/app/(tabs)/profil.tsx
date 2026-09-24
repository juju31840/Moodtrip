import { ScrollView } from "react-native";

import { Body, Masthead } from "@/ui/kit";
import { colors } from "@/ui/theme";

/** Squelette : l'onglet existe pour que la navigation soit celle de l'application finale. */
export default function ProfilScreen() {
  return (
    <ScrollView style={{ backgroundColor: colors.paper }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 20 }}>
      <Masthead title="Profil" />
      <Body style={{ marginTop: 16 }}>Préférences déclarées et goûts observés, comme sur le site. À venir dans l’application.</Body>
    </ScrollView>
  );
}
