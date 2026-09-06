# Sécurité

Audit du 1er septembre 2026, mené sur la grille en quarante points « Security
For Vibe-Coded Apps » (huit sections : secrets, base, authentification,
validation serveur, dépendances, limitation de débit, CORS, téléversement).

Ce document consigne les décisions, y compris celles de ne rien faire : un
risque écarté sans trace revient au premier doute.

Un premier passage avait eu lieu le matin même. Il rangeait les droits d'accès à
la base dans « ce que l'audit n'a pas pu vérifier », au motif que « cela se
vérifie table par table dans le tableau de bord, pas depuis le dépôt ». **Le
motif était mauvais** : les droits de table se mesurent de l'extérieur avec la
seule clé publiable, celle-là même que l'application livre au navigateur. C'est
d'ailleurs par là qu'on entrerait. La mesure est faite ci-dessous, et elle
change le tableau.

## 🔴 La clé publique détient les droits d'écriture sur toutes les tables

**Constat établi.** Le rôle `anon`, dont la clé est livrée dans le bundle client
et donc lisible par n'importe qui, détient les **privilèges de table**
`INSERT`, `UPDATE` et `DELETE` sur `places` et `communes`, et `DELETE` sur
`quotas` et `sante_journal`.

**Ce qui reste à trancher, et il faut le dire avant les mesures** : un privilège
de table n'est que le premier des deux verrous. Si la RLS est active sur ces
tables sans politique d'écriture, la requête est autorisée mais ne touche aucune
ligne, et rend la même réponse qu'une écriture réussie. **Les mesures ci-dessous
prouvent le droit de table, pas le franchissement de la RLS.** La distinction
est faite plus bas.

Mesuré depuis l'extérieur, avec la seule clé publiable, sur des requêtes
choisies pour ne pouvoir modifier aucune ligne :

| Requête | Réponse | Ce que ça prouve |
|---|---|---|
| `PATCH /places?fsq_id=eq.__aucune_ligne__` | **204** | droit `UPDATE` accordé |
| `DELETE /places?fsq_id=eq.__aucune_ligne__` | **204** | droit `DELETE` accordé |
| `POST /places` (colonne inexistante) | **400** « column not found » | droit `INSERT` accordé, seul le corps est refusé |
| idem sur `communes` | mêmes réponses | idem |
| `DELETE /quotas?id=eq.-999999` | **400** « column does not exist » | droit `DELETE` accordé |
| `DELETE /sante_journal?id=eq.-999999` | **400** « column does not exist » | droit `DELETE` accordé |
| `GET /quotas` | **401** `42501` | droit `SELECT` refusé |
| `PATCH /quotas` | **401** `42501` | droit `UPDATE` refusé |

Le contraste est ce qui rend la lecture certaine : un droit manquant donne un
**401 `42501`**, comme sur la lecture de `quotas`. Un 204 ou un 400 sur le
contenu signifie que le contrôle de privilège est passé et que seule la requête
elle-même n'avait rien à faire. Ce contrôle s'exécute **avant** la RLS, d'où la
limite énoncée plus haut.

### Ce qui décide entre « grave » et « sans conséquence »

Une seule question : **la RLS est-elle active sur ces quatre tables ?**

- **Si elle ne l'est pas** — c'est l'état par défaut d'une table créée en SQL
  sans `enable row level security`, et la première cause d'exposition des bases
  Supabase — alors les droits ci-dessus s'exercent réellement, et la section
  suivante décrit ce qui peut arriver.
- **Si elle l'est**, avec une politique de lecture seule, les écritures sont
  arrêtées au second verrou. Le risque redevient latent : il suffirait d'ajouter
  un jour une politique permissive, ou de désactiver la RLS le temps d'une
  manipulation, pour que les droits de table reprennent tout leur effet.

Un indice, sans être une preuve : `places` et `communes` rendent bien leurs
lignes à `anon`. Une table sous RLS **sans** politique de lecture rendrait un
tableau vide. Il existe donc au moins une politique de lecture permissive, ou
pas de RLS du tout.

**La question se tranche en une requête**, dans l'éditeur SQL :

```sql
select relname, relrowsecurity as rls_active, relforcerowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('places', 'communes', 'quotas', 'sante_journal');
```

Le correctif ci-dessous est à appliquer **dans les deux cas** : il coûte quatre
lignes, ne casse rien, et referme aussi bien la porte ouverte que celle qui
n'attend qu'un faux mouvement.

### Ce qu'un attaquant pourrait faire si la RLS n'est pas active

Récupérer la clé dans le bundle — c'est une ligne de `curl` — puis :

- `DELETE /rest/v1/places?fsq_id=neq.x` efface les **575 206 lieux**, c'est-à-dire
  le socle entier, celui dont dépend l'inversion du pipeline. Il faudrait le
  recharger depuis Foursquare, dont le jeu de données n'est plus rattaché au
  compte (voir « Rechargement Foursquare — bloqué côté compte »).
- `DELETE /rest/v1/quotas?...` efface les compteurs de quota. Le quota étant
  précisément ce qui protège le crédit Anthropic, sa suppression rend les
  générations illimitées **aux frais du propriétaire du compte**.
- une écriture ciblée sur `places` remplacerait des adresses réelles par des
  adresses fausses. C'est le pire des trois pour ce produit-là : la promesse est
  que l'utilisateur **s'y rend vraiment**, et rien à l'écran ne distinguerait un
  lieu falsifié d'un lieu vérifié.

**Pourquoi ces droits existent.** Supabase accorde par défaut les droits de
table au rôle `anon` sur le schéma public, et c'est la RLS qui est censée
reprendre ce qu'ils donnent. Compter sur elle seule fait tenir toute la sécurité
de la base sur un réglage qui ne se voit pas dans le dépôt — c'est ce que
décrit le point 2.1 de la grille, et ce que mesure le chiffre qu'elle cite :
83 % des bases Supabase exposées le sont par une RLS mal configurée.

**Le correctif ne casse rien, et c'est vérifié.** L'application n'écrit jamais
en direct : toutes ses écritures passent par des fonctions `security definer`
(`consommer_quota`, `noter_propositions`, `noter_visite`, `noter_lieu`), dont on
sait qu'elles contournent les droits de table puisque `consommer_quota`
fonctionne alors que `quotas` est illisible pour `anon`. Les alimentations du
socle (`scripts/ingest-places.py`, `scripts/verify-google.mjs`, la route cron)
passent, elles, par l'API d'administration avec `SUPABASE_ACCESS_TOKEN`. Le rôle
`anon` n'a besoin que de **lire** `places` et `communes`.

**À exécuter dans l'éditeur SQL Supabase** :

```sql
-- 1. Retirer les droits d'ecriture au role public.
revoke insert, update, delete, truncate on public.places        from anon, authenticated;
revoke insert, update, delete, truncate on public.communes      from anon, authenticated;
revoke insert, update, delete, truncate on public.quotas        from anon, authenticated;
revoke insert, update, delete, truncate on public.sante_journal from anon, authenticated;

-- 2. Activer la RLS, en second rang de defense.
alter table public.places        enable row level security;
alter table public.communes      enable row level security;
alter table public.quotas        enable row level security;
alter table public.sante_journal enable row level security;

-- 3. La seule ouverture voulue : la lecture du socle.
drop policy if exists lecture_publique on public.places;
create policy lecture_publique on public.places
  for select to anon, authenticated using (true);

drop policy if exists lecture_publique on public.communes;
create policy lecture_publique on public.communes
  for select to anon, authenticated using (true);

-- quotas et sante_journal restent sans politique : aucun acces direct.
-- Les fonctions security definer continuent d'y ecrire.
```

Ne pas ajouter `force row level security` : les fonctions `security definer`
s'exécutent avec les droits de leur propriétaire et cesseraient de fonctionner.

**Après exécution**, deux vérifications valent mieux qu'une supposition : que
`DELETE` sur `places` réponde désormais 401, et qu'une génération complète
aboutisse encore — elle consomme un quota et écrit `proposed_count`.

## Corrigé dans le dépôt

**Couverture `.gitignore` incomplète** (point 1.2). Les trois motifs `.env`,
`.env.local` et `.env*.local` laissaient passer **`.env.production` et
`.env.development`** — deux noms qu'un outil ou une habitude produisent sans y
penser, et qui porteraient les secrets de production. Remplacés par `.env*`
avec `!.env.local.example`. Vérifié nom par nom avec `git check-ignore`, et le
modèle est toujours suivi par git.

**Route `/api/cron/verify-places` ouverte à tous** (corrigé le matin même). La
garde s'écrivait `if (secret && en-tête invalide)`. `CRON_SECRET` n'étant défini
nulle part, la condition n'était jamais vraie et la route répondait à n'importe
qui. Elle consomme le quota Google Places, facturé, et écrit en base avec un
jeton d'administration. L'absence de secret ferme désormais la route par un 503.

**À faire côté Vercel :** définir `CRON_SECRET` et configurer le cron pour qu'il
envoie l'en-tête `Authorization: Bearer <secret>`. Tant que la variable manque,
la route renvoie 503 et la vérification des lieux ne tourne pas.

## Correction d'une décision précédente

**Le raisonnement du matin sur `next` était trop étroit.** Il écartait la montée
de version sur deux vulnérabilités seulement — DoS de l'Image Optimizer et XSS
postcss — et concluait que l'application n'était pas exposée puisqu'elle
n'importe pas `next/image`.

L'avis complet en compte **vingt-deux**, dont plusieurs visent précisément
l'architecture utilisée ici — App Router, Server Components, Server Actions :

- déni de service via les Server Components et via les Server Actions ;
- empoisonnement de cache par collision dans le cache-busting RSC ;
- confusion de corps de réponse pour les requêtes avec corps ;
- **divulgation non authentifiée des points d'entrée internes des Server Functions**.

Plusieurs autres restent hors de portée, et il faut le dire aussi : pas de
middleware, pas de `rewrites`, pas d'i18n, pas de serveur personnalisé, pas de
nonce CSP.

La conclusion ne change pas encore — la montée demande **deux versions
majeures** (14 → 16), et `14.2.35` est la dernière de sa branche, donc il n'y a
pas de correctif sans réécriture — mais le motif change, et il faut qu'il soit
juste : ce n'est plus « l'application n'est pas concernée », c'est **« une
branche sans mainteneur de sécurité, dont on accepte le risque en connaissance
de cause »**. Ce risque est à rouvrir avant toute mise en avant publique de
l'application, et non à considérer comme réglé.

## Vérifié et sain

- **Aucun secret en dur** : recherche sur `sk_live_`, `sk-`, `pk_live_`, `ghp_`,
  `gho_`, `github_pat_`, `xoxb-`, `xoxp-`, `AKIA`, `eyJ`, et sur toute chaîne
  d'au moins trente-deux caractères alphanumériques entre guillemets.
- **Aucun `.env` dans l'historique git**, vérifié sur toutes les branches. Le
  `.env.local.example` versionné ne porte que des noms de variables.
- **Préfixes publics corrects** (1.3) : seules trois variables portent
  `NEXT_PUBLIC_` — l'URL Supabase, la clé publiable et le jeton Mapbox, toutes
  publiques par conception. `ANTHROPIC_API_KEY`, `CRON_SECRET`,
  `GOOGLE_PLACES_API_KEY` et `SUPABASE_ACCESS_TOKEN` ne le sont pas, et les
  modules qui les lisent portent `server-only`.
- **Aucune fuite par la console** : aucun `console.*` ne prend `process.env` en
  argument ; les fichiers `"use client"` ne lisent que des variables publiques.
- **Pas de source maps en production** — non activées dans `next.config.mjs`.
- **Aucun SQL concaténé** : les appels passent par `rest/v1/rpc/` avec un corps
  JSON, donc paramétrés.
- **La clé `service_role` n'apparaît nulle part.**
- **Validation Zod par `safeParse`** sur `/api/generate-itinerary`, avec le quota
  décompté **après** validation pour qu'une requête malformée ne le consomme pas.
- **Quota persisté en base** par `consommer_quota`, en un seul aller-retour ; le
  compteur mémoire n'est qu'un repli hors ligne. Deux compteurs, par appareil et
  par adresse (point 6.3 : le stockage n'est pas en mémoire de processus).
- **Aucun `dangerouslySetInnerHTML`**, aucune écriture d'`innerHTML`.
- **Aucun en-tête CORS permissif** posé : les routes ne répondent qu'à leur
  propre origine, ce qui est le défaut de Next (points 7.1 et 7.2).
- **Verrou de version présent et versionné.**

## Sans objet, et pourquoi

**Authentification (section 3, huit points).** L'application n'a ni compte, ni
session, ni identité. Tout ce qu'un utilisateur produit — itinéraires, lieux
cochés, notes, profil — vit dans son `localStorage`, sur son appareil. Il n'y a
donc ni JWT à valider, ni cookie `httpOnly` à vérifier, ni `getUser()` contre
`getSession()`, ni flux OAuth ou de réinitialisation de mot de passe.

Cela vaut tant que la persistance reste locale. **Le jour où les itinéraires
passent en base** — c'est le chantier `supabaseItineraryStore` — cette section
entière redevient applicable d'un coup, et avec elle les points 2.3 (clauses
`WITH CHECK`) et 4.2 (identité tirée de la session, jamais du corps de requête).

**Téléversement de fichiers (section 8).** La photo de profil est lue par
`FileReader` dans le navigateur, réduite à 320 px, et écrite en `data:` URI dans
`localStorage`. Aucun octet n'atteint un serveur : il n'y a ni type MIME à
vérifier côté serveur, ni répertoire d'envoi, ni exécution possible.

**Signature de webhook (4.6).** L'application ne reçoit aucun webhook.

## Réserves, sans correctif

**Comparaison de secret non constante en temps** (`app/api/cron/verify-places`) :
`request.headers.get("authorization") !== \`Bearer ${secret}\`` s'arrête au
premier octet différent. L'attaque par mesure de temps suppose ici des milliers
de requêtes à travers l'infrastructure Vercel, pour un bruit qui dépasse de
plusieurs ordres de grandeur le signal. Réserve notée, correctif non appliqué.

**Verbe HTTP de la route cron** (4.4) : elle écrit en base sur un `GET`, ce que
la grille proscrit. C'est imposé par Vercel Cron, qui n'émet que des `GET`. Le
secret porté en en-tête tient lieu de protection, et un `GET` déclenché par une
balise d'image n'emporterait pas cet en-tête.

**Les messages d'erreur PostgREST nomment les tables voisines** (« Perhaps you
meant the table `public.quotas` »). C'est ce qui a servi à énumérer le schéma
ci-dessus. Comportement de PostgREST, non désactivable côté application, et sans
conséquence une fois les droits repris : connaître le nom d'une table qu'on ne
peut ni lire ni écrire n'avance à rien.

## Ce que l'audit n'a pas pu vérifier

**L'état de la RLS sur les quatre tables** — la seule inconnue qui décide de la
gravité du point ci-dessus. Deux moyens de la lever : la requête sur `pg_class`
donnée plus haut, ou une écriture témoin réassignant à une ligne sa propre
valeur, qui distingue une écriture réussie d'une écriture arrêtée par la RLS.
Cette seconde voie n'a pas été empruntée : c'est une écriture sur une base de
production, et elle demande un accord explicite.

**Les variables d'environnement côté Vercel** — dont `CRON_SECRET`, toujours
absente au moment de l'audit.

**Le corps des fonctions `security definer`** (points 2.8 et 2.3). Leur
comportement est déduit de l'extérieur : `consommer_quota` fonctionne alors que
`quotas` est illisible, donc elle contourne bien les droits de table. Ce qu'elle
fait de ses arguments — en particulier si `p_cle` et `p_max` peuvent être
détournés pour épuiser le quota d'un tiers — demande de lire le SQL dans le
tableau de bord.
