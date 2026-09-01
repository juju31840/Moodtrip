# Sécurité

Audit du 1er septembre 2026. Ce document consigne les décisions, y compris
celles de ne rien faire : un risque écarté sans trace revient au premier doute.

## Corrigé

**Route `/api/cron/verify-places` ouverte à tous.** La garde s'écrivait
`if (secret && en-tête invalide)`. `CRON_SECRET` n'étant défini nulle part, la
condition n'était jamais vraie et la route répondait à n'importe qui. Elle
consomme le quota Google Places, facturé, et écrit en base avec un jeton
d'administration.

L'absence de secret ferme désormais la route par un 503 au lieu de l'ouvrir.
Les quatre variables de la tâche planifiée — `CRON_SECRET`,
`GOOGLE_PLACES_API_KEY`, `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN` —
figurent maintenant dans `.env.local.example` ; leur absence de ce fichier
expliquait l'oubli.

**À faire côté Vercel :** définir `CRON_SECRET` et configurer le cron pour
qu'il envoie l'en-tête `Authorization: Bearer <secret>`. Tant que la variable
manque, la route renvoie 503 et la vérification des lieux ne tourne pas.

## Écarté, avec sa raison

**`npm audit` signale deux vulnérabilités hautes sur `next` 14.2.35**, toutes
deux corrigées uniquement en 16.3.4 — deux versions majeures d'écart.

La montée n'est pas faite, pour ces raisons :

- *DoS via Image Optimizer* : l'application n'importe `next/image` nulle part et
  ne déclare aucune configuration d'images. L'optimiseur n'est pas servi.
- *XSS postcss via `</style>` non échappé* : postcss n'intervient qu'à la
  compilation. Exploiter la faille supposerait qu'un tiers fournisse le CSS
  compilé, ce qui n'est pas le cas ici.
- 14.2.35 est la dernière de sa branche : aucun correctif sans changement majeur.

Ce raisonnement tient tant que ces deux conditions tiennent. **Si
`next/image` est introduit, ou si du CSS d'origine externe entre dans la
compilation, la montée devient nécessaire.**

## Vérifié et sain

- Aucun secret en dur : recherche sur `sk-`, `eyJ`, `AKIA`, `ghp_`, `xoxb-` et
  toute chaîne de plus de quarante caractères dans le code.
- `.env.local` ignoré, jamais commité, y compris dans l'historique. Le
  `.env.local.example` versionné ne porte que des valeurs vides.
- La clé Anthropic n'est jamais préfixée `NEXT_PUBLIC_`, et les sept modules
  sensibles portent `server-only`.
- Seule la clé publiable Supabase est utilisée ; la clé `service_role`
  n'apparaît nulle part.
- Le quota de génération est persisté en base par `consommer_quota`, en un seul
  aller-retour. Le compteur mémoire n'est qu'un repli hors ligne.
- Validation Zod par `safeParse` sur la route de génération, quota décompté
  après validation pour qu'une requête malformée ne le consomme pas.
- Aucun SQL concaténé, aucun `dangerouslySetInnerHTML`, pas de source maps en
  production.

## Ce que l'audit n'a pas pu vérifier

Les politiques RLS réelles dans la console Supabase, et les variables
d'environnement configurées côté Vercel. Le code affirme que `places` est en
lecture publique par RLS ; cela se vérifie table par table dans le tableau de
bord, pas depuis le dépôt.
