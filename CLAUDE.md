# CLAUDE.md — Moodtrip

Règles et repères stables. L'historique daté (décisions, mesures, pièges résolus) est dans
`docs/historique/` : chercher par titre (`grep -n "^## " docs/historique/*.md`), ne pas tout relire.
Les nouvelles décisions datées vont là-bas ; ce fichier ne garde que ce qui reste vrai.

## État actuel (au 12/11/2026)

- Web en production (https://moodtrip-schuft.vercel.app) depuis le 28/08/2026, sur Next 16 / React 19.
- **Plan C** (gratuit, perte plafonnée) : 3 recherches par appareil et par jour, 12 par IP, 20 par
  jour pour toute l'application (au pire ~0,50 $/jour). Mesure du retour sans identifiant (vue
  `retour_par_semaine`). Décision et chiffres : `docs/historique/2026-11-12-plan-c-et-banc-gemini.md`.
- Modèle : Claude Haiku 4.5, ~2,5 centimes par recherche (mesuré). Gemini gratuit écarté (20
  requêtes par jour) ; son code reste sur la branche `bench-gemini`.
- App mobile Expo SDK 57 dans `mobile/` : prête pour l'App Store, **pas encore testée sur téléphone**
  ni envoyée sur TestFlight.
- Qualité : 17 tests vitest + CI GitHub (lint, types, tests) à chaque push.

## Prochaine action

1. Tester l'app mobile sur un vrai téléphone (`cd mobile && npx expo start`, Expo Go).
2. Trancher le copyright (Jules) contre le vendeur (Nathan), puis TestFlight avec 5 testeurs.
3. Après 2-3 semaines : lire `retour_par_semaine` et décider freemium ou affiliation.

## Produit

L'utilisateur règle 3 curseurs (Budget / Ambiance / Distance) et choisit un mode (Tonight /
Weekend / Trip) ; Claude compose un itinéraire structuré (JSON) parmi des lieux réels, affiché sur
une carte Mapbox et une bottom sheet (vaul). Brief d'origine : `brief.md`.

- L'utilisateur **s'y rend vraiment** : l'exactitude des lieux est existentielle, et chaque étape
  doit être ouvrable dans Maps.
- Un push sur `main` redéploie la production. Procédure et pièges : `DEPLOIEMENT.md`.
- `mobile/` a son propre `CLAUDE.md`. App Store : `docs/app-store/fiche.md`. Sécurité :
  `docs/SECURITE.md`. Autres docs : `docs/design/`, `docs/conception/`, `docs/commercialisation/`.

## Stack et dossiers

Next.js, React, Tailwind, Mapbox (`react-map-gl`), vaul, Zod, SDK Anthropic, Supabase
(PostgreSQL + PostGIS).

- `app/` pages et routes API · `components/` · `hooks/` · `lib/` (`claude.ts`, `prompt.ts`,
  `itinerary-schema.ts`, `places-db.ts`, `verify-places.ts`, `rate-limit.ts`, `mesure-retour.ts`) ·
  `scripts/` (dont `scripts/sql/`, à coller dans le SQL Editor de Supabase) · `tests/`.

## Commandes

    npm run dev                  # développement
    npm run build && npm start   # production locale
    npm run lint && npm test     # ce que lance la CI (avec npx tsc --noEmit)
    npm run eval -- --out rapport.md [--only N]   # banc d'essai de génération
    npm run check:match | verify:google | refresh:places | routine:places | check:prod

- **Ne jamais lancer `npm run build` pendant que `next dev` tourne** : le build écrase `.next`.
  Correctif : `rm -rf .next`, relancer.
- `VIBETRIP_MOCK=1` dans `.env.local` : itérer sur l'UI sans consommer de crédit API.
- Banc d'essai : une IP distincte par scénario, mais le plafond global (20/jour) s'applique ; en
  local, monter `VIBETRIP_PLAFOND_GLOBAL` dans `.env.local`. Le coût de chaque appel est écrit dans
  le journal du serveur (`[usage]`).
- Les téléphones de test doivent voir la **production**, pas `next dev`.
- La géolocalisation exige HTTPS (ou localhost).

## Règles d'architecture (ne pas enfreindre)

- **Les faits ne sont jamais produits par un modèle** (le lieu existe, ses coordonnées, son adresse,
  s'il est ouvert). Le jugement l'est, mais toujours à partir d'une fiche factuelle.
- Le remède aux lieux faux est une **vérification contre une base réelle**, pas un meilleur prompt.
  Les homonymes se départagent **par proximité**, jamais par le nom seul.
- Le socle de lieux est **Foursquare OS Places** dans Supabase. Google Places n'est pas une base
  (seul le `place_id` est conservable) : il sert à la vérification à la volée. Les colonnes
  `google_*` et `proposed_count` appartiennent à l'app : l'ingestion ne doit jamais les toucher.
- Catégories : **liste blanche, pas liste noire**. L'ancienneté d'une fiche est une priorité de
  re-vérification, jamais un critère d'exclusion.
- Toute requête par ville passe par `locality_norm` (wrapper `vt_unaccent`).
- Le quota vit **en base**, pas en mémoire : en serverless chaque instance froide repartirait de zéro.
- Aucune donnée personnelle conservée au-delà d'un jour (promesse de `app/confidentialite`) : la
  mesure du retour passe par l'ancienneté calculée sur l'appareil, pas par un identifiant.
- Avant de conclure à une régression des données, **vérifier l'outil de mesure**.

## Design — direction « Riso »

Papier `#E7E5DF` avec trame (`.grain`), vermillon `#DD3B2E`, outremer `#2B44A8`, noir `#17161A`,
surimpression `#7A2E63`. Titres Anton, texte Archivo. Détail : `docs/design/design-system.md`.

- Aucun angle arrondi, aucune ombre diffuse : filets noirs 2 px (3 px pour les séparations
  majeures). Seul relief : `shadow-print`. Les marqueurs de carte gardent le cercle.
- **Vermillon = l'action et la sélection.** **Outremer = le factuel confirmé.**
- **Un lieu non confirmé ne reçoit aucune encre** : capitales grises, soulignées d'un pointillé.
- Titres sur plusieurs lignes : `leading-[1.04]`.
- Vérifier au rendu à 390×844, 390×667 et 320×568 (skills `check-ui`, `check-mobile-responsive`).

## Production et maintenance

- Secrets : `.env.local` pour l'app ; trousseau macOS (service `moodtrip`) pour les scripts et le
  MCP (`security add-generic-password -U -s moodtrip -a NOM -w VALEUR`). Jamais dans le dépôt.
- Toute règle du contrat d'itinéraire ajoutée au schéma reçoit son test.
- Vercel protège par défaut toutes les URLs de prévisualisation : un 302 vers une connexion ne veut
  pas dire que le site est cassé.
- Routine mensuelle du socle : `scripts/routine-places.sh` (launchd, le 1er à 9 h, journal
  `~/Library/Logs/moodtrip-places.log`). Elle alerte quand le jeton Foursquare expire mais ne peut
  pas le régénérer.
- Santé du socle (skill `check-places-db`) : si `sans_theme` dépasse 5 %, la correspondance des
  catégories est cassée.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
