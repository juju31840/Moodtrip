# CLAUDE.md — Moodtrip

Règles et repères stables. L'historique daté (décisions, mesures, pièges résolus) est dans
`docs/historique/CLAUDE-journal-2026-10-09.md` : ne pas le relire en entier, chercher la section
par son titre (`grep -n "^## " docs/historique/CLAUDE-journal-2026-10-09.md`). Les nouvelles
décisions datées vont dans `docs/historique/`, pas ici ; ce fichier ne garde que ce qui reste vrai.

## État actuel (au 11/10/2026)

- Web en production (https://moodtrip-schuft.vercel.app) depuis le 28/08/2026 ; dernière fonctionnalité visible le 27/09.
- App mobile Expo SDK 57 dans `mobile/` : préparation App Store faite (EAS, icône, confidentialité, Sentry), pas encore testée sur téléphone ni envoyée sur TestFlight. `eas-cli` installé ; pas de Xcode (inutile avec EAS).
- Qualité : 8 tests vitest du contrat d'itinéraire + CI GitHub (lint, types, tests) à chaque push.
- Secrets des scripts et du MCP : trousseau macOS (service `moodtrip`).

## Prochaine action

Tester l'app mobile sur un vrai téléphone (`cd mobile && npx expo start`, QR code dans Expo Go), puis lancer `/audit-securite` avant TestFlight et 5 testeurs.

## Produit

Application mobile-first : l'utilisateur règle 3 curseurs (Budget / Ambiance / Distance) et choisit
un mode (Tonight / Weekend / Trip) ; Claude génère un itinéraire structuré (JSON), affiché sur une
carte Mapbox et une bottom sheet (vaul). Brief d'origine : `brief.md`.

- Ambition : vrai produit, vrais utilisateurs. L'utilisateur **s'y rend vraiment** : l'exactitude
  des lieux est existentielle, et chaque étape doit être ouvrable dans Maps.
- En production : https://moodtrip-schuft.vercel.app (depuis le 28/08/2026). Un push sur `main`
  redéploie. Procédure et pièges : `DEPLOIEMENT.md`.
- `mobile/` : application mobile, avec son propre `CLAUDE.md`.
- App Store : `docs/app-store/fiche.md`. Autres docs : `docs/SECURITE.md`, `docs/design/`,
  `docs/conception/`, `docs/commercialisation/`.

## Stack et dossiers

Next.js, React, Tailwind, Mapbox (`react-map-gl`), vaul, Zod, SDK Anthropic, Supabase
(PostgreSQL + PostGIS).

- `app/` pages et routes API · `components/` (étiquettes cliquables : `components/ui/chip.ts`) ·
  `hooks/` · `lib/` (`claude.ts`, `prompt.ts`, `itinerary-schema.ts`, `place-match.ts`,
  `verify-places.ts`, `places-db.ts`, `closed-places.ts`, `rate-limit.ts`) · `scripts/`.

## Commandes

    npm run dev              # développement
    npm run build && npm start   # production locale
    npm run lint && npm test     # ce que lance la CI (avec npx tsc --noEmit)
    npm run eval -- --out rapport.md   # banc d'essai de génération (contrat + qualité)
    npm run check:match | verify:google | refresh:places | routine:places | check:prod

- **Ne jamais lancer `npm run build` pendant que `next dev` tourne** : le build écrase `.next` et
  le serveur de dev répond `missing required error components`. Correctif : `rm -rf .next`, relancer.
- `VIBETRIP_MOCK=1` dans `.env.local` : itérer sur l'UI sans consommer de crédit API
  (`lib/mock-itinerary.ts`, lu par `lib/claude.ts` qui teste `=== "1"`). Vide = vrais appels.
- Le banc `scripts/eval-itineraries.mjs` utilise une IP distincte par scénario pour ne pas
  déclencher le rate limit (5/h) : à garder en tête si le quota change.
- Les téléphones de test doivent voir la **production**, pas `next dev` (recompile chaque écran).
- La géolocalisation exige HTTPS (ou localhost) : impossible en HTTP sur le réseau local.

## Règles d'architecture (ne pas enfreindre)

- **Les faits ne sont jamais produits par un modèle** (le lieu existe, ses coordonnées, son adresse,
  s'il est ouvert). Le jugement l'est, mais toujours à partir d'une fiche factuelle. Un lieu inventé
  écrit en base serait pire qu'un lieu inventé à la volée : il aurait l'autorité d'une donnée stockée.
- Le remède aux lieux faux est une **vérification contre une base réelle**, pas un meilleur prompt.
  Les homonymes se départagent **par proximité** à la coordonnée proposée, jamais par le nom seul.
- Le socle de lieux est **Foursquare OS Places** chargé dans Supabase. Google Places n'est pas une
  base (seul le `place_id` est conservable, coordonnées 30 jours) : il sert à la vérification à la
  volée. Les colonnes `google_*` et `proposed_count` appartiennent à l'app : l'ingestion
  (`scripts/ingest-places.py`, `on conflict do update`) ne doit jamais les toucher.
- Catégories : **liste blanche, pas liste noire**. L'ancienneté d'une fiche est une priorité de
  re-vérification (`refreshed_at`), jamais un critère d'exclusion (elle écartait de vraies adresses
  de quartier).
- Toute requête par ville passe par `locality_norm` (le champ brut écrit « Paris » sous 7 casses).
  `unaccent` n'étant pas `IMMUTABLE`, la colonne passe par le wrapper `vt_unaccent`.
- Le quota (rate limit) vit **en base**, pas en mémoire de processus : en serverless chaque
  instance froide repartirait d'un compteur neuf.
- Avant de conclure à une régression des données, **vérifier l'outil de mesure** : les fausses
  alertes sont venues trois fois du script de contrôle.

## Design — direction « Riso » (en place sur toute l'application)

Affiche sérigraphiée : papier gris-froid `#E7E5DF` avec trame (`.grain`, `app/globals.css`),
vermillon `#DD3B2E`, outremer `#2B44A8`, noir `#17161A`, surimpression `#7A2E63`. Titres Anton,
texte Archivo. Détail et historique : `docs/design/design-system.md` et le journal.

- Aucun angle arrondi, aucune ombre diffuse, aucune carte flottante : filets noirs 2 px (3 px pour
  les séparations majeures), aplats d'encre. Seul relief : `shadow-print`. `card`, `sheet` et
  `pill` restent à 0 dans la config Tailwind. Les marqueurs de carte gardent le cercle.
- **Vermillon = l'action et la sélection**, jamais décoratif. **Outremer = le factuel confirmé.**
- **Un lieu non confirmé ne reçoit aucune encre** : capitales grises, soulignées d'un pointillé.
- Titres susceptibles de passer à la ligne : `leading-[1.04]` (`0.95` fait mordre les lignes).
- Vérifier au rendu à 390×844, 390×667 et 320×568 (skills `check-ui`, `check-mobile-responsive`).

## Production et maintenance

- Secrets : `.env.local` (ignoré par git) pour l'app ; trousseau macOS, service `moodtrip`, pour les jetons des scripts et du MCP (`security add-generic-password -U -s moodtrip -a NOM -w VALEUR`). Jamais dans
  le dépôt, jamais dans un fichier de documentation.
- Tests : vitest, dossier `tests/`. Toute règle du contrat d'itinéraire ajoutée au schéma reçoit
  son test.
- Vercel : les sous-domaines `.vercel.app` sont globaux, et Vercel protège par défaut toutes les
  URLs (API comprise) : un 302 vers une page de connexion ne veut pas dire que le site est cassé.
- Routine mensuelle du socle : `scripts/routine-places.sh` via launchd, le 1er de chaque mois à
  9 h, journal `~/Library/Logs/moodtrip-places.log`. Elle alerte (notification macOS) quand le jeton
  Foursquare expire dans moins de 8 jours mais **ne peut pas le régénérer** (un mois, page
  authentifiée). Elle tourne en local, délibérément : 2,4 Go de Parquet, ~40 minutes.
- Santé du socle (skill `check-places-db`) : si `sans_theme` dépasse 5 %, la correspondance des
  catégories est cassée (panneau « Changer » vide, sans erreur).

## Où chercher dans le journal

Titres de sections utiles dans `docs/historique/CLAUDE-journal-2026-10-09.md` : « Vérification des
lieux (étape 2) », « Socle de lieux — Supabase », « Ce que la vérification Google trouve réellement »,
« En production depuis le 28/08/2026 », « Routine mensuelle du socle », « Onglet Profil »,
« Retour du test et passage à l'App Store », « Préparation App Store », « Soirées : ce que la
curation avait cassé », « Points ouverts », « Reste à faire ».
