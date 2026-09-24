import { ScrollView } from "react-native";

import { Body, Masthead } from "@/ui/kit";
import { colors } from "@/ui/theme";

/** Squelette : l'onglet existe pour que la navigation soit celle de l'application finale. */
export default function CarteScreen() {
  return (
    <ScrollView style={{ backgroundColor: colors.paper }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 20 }}>
      <Masthead title="Ma carte" />
      <Body style={{ marginTop: 16 }}>Chaque étape cochée pendant une sortie posera ici un point, rangé par ville. À venir dans l’application : l’écran existe sur le site et suivra.</Body>
    </ScrollView>
  );
}
