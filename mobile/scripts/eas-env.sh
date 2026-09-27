#!/usr/bin/env bash
# Déclare côté EAS les variables publiques lues dans mobile/.env (non versionné).
#
# Les builds EAS tournent dans le cloud : elles ne voient pas le .env local, et une build sans
# ces trois clés démarre sans carte ni base — sans message d'erreur. Ces valeurs sont publiques
# par nature (EXPO_PUBLIC_*, embarquées dans l'app) : `plaintext` est la bonne visibilité.
#
# À lancer une fois après `npx eas-cli@latest login` et `npx eas-cli@latest init`, puis à chaque
# changement de clé. Relançable : `env:set` crée ou remplace.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "mobile/.env introuvable"; exit 1; }

for name in EXPO_PUBLIC_MAPBOX_TOKEN EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY; do
  value=$(grep -E "^${name}=" .env | head -1 | cut -d= -f2- | tr -d '"')
  [ -n "$value" ] || { echo "$name absent de .env"; exit 1; }
  for env in development preview production; do
    npx eas-cli@latest env:set --name "$name" --value "$value" --environment "$env" \
      --visibility plaintext --non-interactive
  done
done
# Facultatif : le DSN Sentry, s'il est renseigné dans .env (sinon le suivi reste éteint).
dsn=$(grep -E "^EXPO_PUBLIC_SENTRY_DSN=" .env | head -1 | cut -d= -f2- | tr -d '"' || true)
if [ -n "$dsn" ]; then
  for env in preview production; do
    npx eas-cli@latest env:set --name EXPO_PUBLIC_SENTRY_DSN --value "$dsn" --environment "$env" \
      --visibility plaintext --non-interactive
  done
fi
echo "Variables déclarées pour development, preview et production."
