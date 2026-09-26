import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

/**
 * Choisir une photo de profil, **réduite avant d'être écrite** (320 px, JPEG 0,82, ~25 Ko) — même
 * règle que `lib/identity.ts` du site : une photo de téléphone pèse 4 à 8 Mo, et l'écrire telle
 * quelle ferait échouer l'enregistrement du profil. Recadrage carré à la sélection, sans quoi
 * les visages s'étirent.
 *
 * Rend `null` si l'on annule, et lève une erreur si l'image n'a pas pu être lue : l'écran doit le
 * dire (leçon du site — une photo refusée qui restait affichée faisait croire qu'elle l'était).
 */
export async function pickProfilePhoto(): Promise<string | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 });
  if (picked.canceled || !picked.assets[0]) return null;
  const context = ImageManipulator.manipulate(picked.assets[0].uri);
  context.resize({ width: 320, height: 320 });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.82, base64: true });
  if (!saved.base64) throw new Error("Image illisible");
  return `data:image/jpeg;base64,${saved.base64}`;
}
