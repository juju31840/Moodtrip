# Fiche App Store — Moodtrip

Tout ce qu'App Store Connect demande à la première soumission, prêt à coller. Les réponses
sur les données sont tirées du code (comme `app/confidentialite/page.tsx`) et doivent rester
alignées avec le manifeste `ios.privacyManifests` de `mobile/app.json` : une contradiction entre
la fiche, la page et le binaire est un motif de refus classique.

Rédigé le 27/09/2026.

---

## Informations de l'app

| Champ | Valeur |
|---|---|
| Nom (30 max) | Moodtrip |
| Sous-titre (30 max) | Sorties, week-ends et voyages |
| Catégorie principale | Voyages |
| Catégorie secondaire | Style de vie |
| Langue principale | Français |
| URL d'assistance | https://moodtrip-schuft.vercel.app/support |
| URL marketing | https://moodtrip-schuft.vercel.app |
| URL de confidentialité | https://moodtrip-schuft.vercel.app/confidentialite |
| Copyright | 2026 Jules Schuft |
| Identifiant | fr.moodtrip.app (à confirmer avec le titulaire du compte) |

## Texte promotionnel (170 max)

> Une soirée, un week-end ou quelques jours ailleurs : dis d'où tu pars et ce dont tu as envie, Moodtrip te propose des programmes avec de vraies adresses.

## Mots-clés (100 max, séparés par des virgules, sans espace)

```
soirée,bar,restaurant,sortir,idée,itinéraire,balade,que faire,city guide,escapade,apéro,vacances
```

Les mots du nom et du sous-titre (« sorties », « week-ends », « voyages ») sont déjà indexés : les répéter
gaspillerait la place.

## Description (4 000 max)

Réécrite trois fois le 27/09/2026 : « texte d'IA », puis « notice », puis trop centrée sur la
soirée. Celle-ci couvre les trois modes, en phrases qu'on dirait à voix haute.

```
On a tous déjà passé plus de temps à chercher quoi faire qu'à le faire. Moodtrip s'occupe de cette partie-là.

Que ce soit pour ce soir, pour un week-end ou pour quelques jours de voyage, tu dis d'où tu pars et ce dont tu as envie : plutôt calme ou plutôt animé, petit budget ou envie de te faire plaisir, pas loin ou un peu plus loin. Moodtrip te propose deux ou trois programmes, avec les étapes sur une carte.

Ce sont de vraies adresses, choisies pour valoir le détour. Tu compares, tu gardes celui qui te plaît, et si un endroit ne te dit rien, tu en changes.

Une fois dehors, l'app t'emmène d'une étape à l'autre. Et chaque endroit où tu passes s'ajoute à ta carte, ville après ville. Au bout de quelques mois, c'est un peu le carnet de tes sorties et de tes voyages.

Pas de compte à créer, pas de pub. Pour l'instant, Moodtrip fonctionne en France.
```

## Nouveautés de la version (1.0)

```
Première version. Dis-nous ce que tu en penses depuis la page d'aide.
```

---

## Confidentialité de l'app (« App Privacy »)

**Suivi (tracking) : non.** Aucune donnée n'est utilisée pour suivre l'utilisateur d'une app ou
d'un site à l'autre, aucun SDK publicitaire.

**Données collectées : oui**, toutes **non liées à l'identité** (aucun compte, aucun nom, aucune
adresse e-mail ne quitte le téléphone).

| Catégorie Apple | Type | Pourquoi c'est déclaré | Usage | Liée | Suivi |
|---|---|---|---|---|---|
| Localisation | Position précise | Le point de départ part au serveur puis au modèle d'Anthropic, qui peut garder les requêtes quelque temps : c'est plus que le « temps réel » qu'Apple exempte | Fonctionnalité de l'app | Non | Non |
| Identifiants | Identifiant d'appareil | Tiré au sort à l'installation, envoyé pour le quota, effacé au bout d'un jour | Fonctionnalité de l'app | Non | Non |
| Utilisation | Interactions avec le produit | « J'y suis allé » et les notes incrémentent un compteur anonyme sur le lieu | Fonctionnalité de l'app | Non | Non |
| Diagnostics | Données de plantage | Sentry, sans IP ni position | Fonctionnalité de l'app | Non | Non |

**Non collecté**, bien que présent dans l'app : prénom, âge et photo du profil (restent sur le
téléphone), historique des sorties, lieux visités, préférences.

Même liste dans `NSPrivacyCollectedDataTypes` (`mobile/app.json`). Si l'une change, changer
l'autre et la page de confidentialité.

---

## Classification par âge

| Question | Réponse |
|---|---|
| Alcool, tabac, drogues (références) | **Fréquentes** — des bars figurent dans la plupart des soirées |
| Violence, contenu sexuel, grossièretés, horreur | Aucun |
| Jeux d'argent, concours | Non |
| Accès web non restreint | Non (on n'ouvre que le site d'un lieu) |
| Contenu généré par les utilisateurs | Non (les notes ne sont montrées à personne) |
| Messagerie, partage de position avec d'autres | Non |
| Contenu généré par IA | Oui : descriptions et titres des programmes |

La classification est calculée par Apple à partir de ces réponses ; les références fréquentes à
l'alcool devraient donner **13+ ou 16+**. Ne pas les minorer : un relecteur qui voit « bar » à
chaque écran refusera une app classée 4+.

---

## Notes pour la revue (en anglais, lues par le relecteur)

```
Moodtrip builds an evening, weekend or trip itinerary from real venues. No account or sign-in is required.

IMPORTANT — coverage is France only. The venue database contains places in France. If you test from outside France, please do not tap the location button (◎) next to the city field: type a French city in the departure field instead, for example "Paris" or "Lyon".

How to test:
1. On the first screen, tap "Commencer".
2. Pick "Ce soir" (tonight), type "Paris" as the departure city, keep the default sliders, and tap "Trouver ma soirée".
3. Proposals arrive within about 5 to 10 seconds. Open one to see the route on the map; "Y aller" opens Apple Maps.
4. Tap "Valider" to save it; it appears in the "Sorties" tab, where it can be followed step by step.

Location permission is optional and used only to start an itinerary from the user's current position. The photo library is opened only if the user chooses a profile picture. An internet connection is required to generate itineraries.

Itinerary texts are written by an AI model (Anthropic Claude) from a list of verified venues; venue names and addresses always come from the database, never from the model.
```

---

## Captures d'écran à fournir

Format exigé : iPhone 6,9 pouces (1320 × 2868) — Apple les réduit pour les autres tailles.
Cinq à six captures, dans cet ordre, chacune avec une légende courte en haut :

1. **Réglages** (Créer, « Ce soir », curseurs visibles) — « Trois curseurs, pas de formulaire »
2. **Propositions** (liste de trois idées) — « Trois programmes, tu choisis »
3. **Détail d'une proposition** (carte + étapes, adresses reconnues) — « De vraies adresses, vérifiées »
4. **En sortie** (une étape, « Y aller » / « J'y suis ») — « Une étape à la fois »
5. **Ma carte** (vue d'une ville avec des points) — « Ta carte se remplit »
6. **Tampons ou profil** — « Tes premières fois »

À prendre sur un iPhone récent dans Expo Go, de préférence avec une vraie sortie à Lyon ou Paris ;
la mise au format et les légendes aux encres Riso se font ensuite.
