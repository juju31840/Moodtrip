import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useSavedItineraries } from "@/lib/storage";
import { colors } from "@/ui/theme";

/**
 * Barre d'onglets **native** : sur iOS, un utilisateur reconnaît la sienne au premier coup d'œil,
 * et c'est l'un des traits qui distinguent une application d'un site emballé (Apple refuse ces
 * derniers, règle 4.2). Libellés courts, choisis sur le site pour tenir à 320 px de large.
 */
export default function TabsLayout() {
  const saved = useSavedItineraries();

  return (
    <NativeTabs tintColor={colors.accent} backgroundColor={colors.paper} iconColor={{ default: colors.inkSoft, selected: colors.accent }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: "plus.square", selected: "plus.square.fill" }} />
        <NativeTabs.Trigger.Label>Créer</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="sorties">
        <NativeTabs.Trigger.Icon sf={{ default: "list.bullet", selected: "list.bullet" }} />
        <NativeTabs.Trigger.Label>Sorties</NativeTabs.Trigger.Label>
        {saved.length > 0 && <NativeTabs.Trigger.Badge>{String(saved.length)}</NativeTabs.Trigger.Badge>}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="carte">
        <NativeTabs.Trigger.Icon sf={{ default: "mappin.and.ellipse", selected: "mappin.and.ellipse" }} />
        <NativeTabs.Trigger.Label>Ma carte</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profil">
        <NativeTabs.Trigger.Icon sf={{ default: "person", selected: "person.fill" }} />
        <NativeTabs.Trigger.Label>Profil</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
