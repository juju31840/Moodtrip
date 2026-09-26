import { Anton_400Regular } from "@expo-google-fonts/anton";
import { Archivo_400Regular, Archivo_700Bold, Archivo_800ExtraBold } from "@expo-google-fonts/archivo";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";

import { toastStore } from "@/lib/toast";
import { Cover } from "@/ui/cover";
import { ToastView } from "@/ui/toast-view";

import { colors } from "@/ui/theme";

SplashScreen.preventAutoHideAsync();

/**
 * La page de garde s'affiche à chaque lancement, comme sur le site à chaque visite : c'est elle
 * qui dit ce que fait le produit. Gardée au niveau du module pour ne pas revenir quand la pile
 * de navigation se remonte pendant la session.
 */
let coverSeen = false;

/**
 * Une pile au-dessus des onglets : la génération (attente, propositions, détail) s'ouvre en
 * plein écran, sans barre d'onglets — comme sur le site, où l'écran de résultat n'en avait pas.
 */
export default function RootLayout() {
  const [loaded] = useFonts({ Anton_400Regular, Archivo_400Regular, Archivo_700Bold, Archivo_800ExtraBold });
  const [started, setStarted] = useState(coverSeen);

  // Une confirmation restée d'une session précédente n'a plus de sens.
  useEffect(() => {
    toastStore.set(null);
  }, []);

  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="attente" options={{ gestureEnabled: false, animation: "fade" }} />
        <Stack.Screen name="propositions" />
        <Stack.Screen name="proposition/[id]" />
        <Stack.Screen name="sortie/[id]" />
      </Stack>
      <ToastView />
      {!started && (
        <Cover
          onStart={() => {
            coverSeen = true;
            setStarted(true);
          }}
        />
      )}
    </>
  );
}
