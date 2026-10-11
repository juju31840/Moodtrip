#!/bin/bash
# Lance le serveur MCP Supabase avec le jeton lu dans le trousseau macOS (service « moodtrip »),
# pour qu'il ne soit écrit en clair nulle part.
SUPABASE_ACCESS_TOKEN="$(security find-generic-password -s moodtrip -a SUPABASE_ACCESS_TOKEN -w)" \
  exec npx -y @supabase/mcp-server-supabase@latest --project-ref="$SUPABASE_PROJECT_REF"
