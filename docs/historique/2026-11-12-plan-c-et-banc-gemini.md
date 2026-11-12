# Plan C et banc Claude / Gemini (11-12/11/2026)

## Banc Claude contre Gemini (11/11)

Même code, même schéma contraint, 7 scénarios (`npm run eval`), mesures lues dans le journal du
serveur.

| | Claude Haiku 4.5 | Gemini 3.5 Flash (offre gratuite) |
|---|---|---|
| Propositions livrées | 17 / 19 | 9 / 19 |
| Contrat | 0 anomalie | 0 anomalie |
| Temps moyen par appel | 7,3 s | 43,6 s |
| Erreurs | 2 sorties hors schéma | 6 × 503 (surcharge), 4 × 429 (quota) |
| Coût | 0,148 $ les 17 appels | 0 |

- Claude : ~5 750 jetons en entrée, ~480 en sortie par proposition, soit ~0,8 centime ; une
  recherche (3 propositions) ~2,5 centimes.
- Gemini gratuit : `GenerateRequestsPerDayPerProjectPerModel-FreeTier` = **20 requêtes par jour**,
  soit ~6 recherches par jour pour toute l'application. Écarté. `gemini-2.5-flash` renvoyait
  NOT_FOUND, `gemini-flash-latest` et les 3.7/3.8 ne répondaient pas. Code sur `bench-gemini`.
- Les 2 propositions Claude perdues : `messages.parse` **lève** sur une sortie hors schéma au lieu
  de rendre `parsed_output: null`, donc le nouvel essai ne partait jamais. Corrigé le 12/11.

## Plan C : gratuit, perte plafonnée (12/11)

Trois modèles envisagés : freemium, affiliation, perte plafonnée. Retenu : la perte plafonnée tant
qu'on ne sait pas si les gens reviennent ; freemium ou affiliation ensuite, selon la mesure.

- Ancien quota : 5 par heure et par appareil, 20 par heure et par IP, soit jusqu'à 480 recherches
  par jour pour une seule adresse (~12 $).
- Nouveau : 3 par appareil et par jour, 12 par IP, 20 par jour au total (`consommer_quota_jour`,
  `scripts/sql/2026-11-12-quota-jour.sql`). Le global n'est décompté qu'après les deux autres.
- Mesure du retour (`scripts/sql/2026-11-12-mesure-retour.sql`) : l'appareil envoie son ancienneté
  (`x-vibetrip-anciennete`), la base ne garde que le jour et ce nombre. Choisi plutôt que de garder
  l'identifiant 90 jours, pour tenir la promesse de la page confidentialité sans changer la fiche
  App Store. Limite : on compte des recherches d'appareils anciens, pas des personnes.
- Frais fixes à garder en tête avant d'encaisser : le plan Hobby de Vercel est réservé à un usage
  non commercial (à vérifier dans leurs conditions), le compte Apple coûte 99 $ par an.
