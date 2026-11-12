#!/bin/bash
# Lance le serveur MCP Supabase avec le jeton lu dans le trousseau macOS (service « moodtrip »),
# pour qu'il ne soit écrit en clair nulle part.
#
# L'identifiant du projet n'est pas un secret (il est dans l'URL publique) : faute de variable
# d'environnement, il est tiré de NEXT_PUBLIC_SUPABASE_URL dans .env.local. Sans ce repli, .mcp.json
# transmettait littéralement « ${SUPABASE_PROJECT_REF} » et le MCP refusait tout (11/11/2026).
cd "$(dirname "$0")/.." || exit 1
case "$SUPABASE_PROJECT_REF" in
  ""|\$*) SUPABASE_PROJECT_REF="$(sed -n 's#^NEXT_PUBLIC_SUPABASE_URL=["]*https://\([a-z0-9]*\)\.supabase\.co.*#\1#p' .env.local)" ;;
esac
# Lecture seule par défaut, version figée (audit du 12/11/2026) : le jeton donne accès à tout le
# compte, et un paquet `@latest` compromis ou une erreur d'agent pourrait écrire en production.
# Pour une écriture ponctuelle, lancer la session avec MOODTRIP_MCP_ECRITURE=1.
MODE="--read-only"
[ "$MOODTRIP_MCP_ECRITURE" = "1" ] && MODE=""
SUPABASE_ACCESS_TOKEN="$(security find-generic-password -s moodtrip -a SUPABASE_ACCESS_TOKEN -w)" \
  exec npx -y @supabase/mcp-server-supabase@0.15.0 --project-ref="$SUPABASE_PROJECT_REF" $MODE
