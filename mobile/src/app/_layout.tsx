import { Anton_400Regular } from "@expo-google-fonts/anton";
import { Archivo_400Regular, Archivo_700Bold, Archivo_800ExtraBold } from "@expo-google-fonts/archivo";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { colors } from "@/ui/theme";

SplashScreen.preventAutoHideAsync();

/**
 * Une pile au-dessus des onglets : la génération (attente, propositions, détail) s'ouvre en
 * plein écran, sans barre d'onglets — comme sur le site, où l'écran de résultat n'en avait pas.
 */
export default function RootLayout() {
  const [loaded] = useFonts({ Anton_400Regular, Archivo_400Regular, Archivo_700Bold, Archivo_800ExtraBold });

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
      </Stack>
    </>
  );
}
