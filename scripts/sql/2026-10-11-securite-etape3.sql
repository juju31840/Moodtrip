-- Audit du 11/10/2026, étape 3 : à lancer SEULEMENT après le déploiement du code qui utilise
-- SUPABASE_SECRET_KEY, et une fois la variable posée dans Vercel (Production).
-- Si on la lance avant, le quota retombe sur le compteur en mémoire, qui ne limite rien en serverless.

-- Le quota et le comptage des propositions ne sont plus appelables avec la clé publique :
-- seul le serveur (clé secrète = rôle service_role) peut les utiliser. Les fonctions internes
-- (vt_vote_autorise) continuent de les appeler, avec les droits de leur propriétaire.
revoke execute on function public.consommer_quota(text, integer) from public, anon, authenticated;
revoke execute on function public.noter_propositions(text[]) from public, anon, authenticated;
grant execute on function public.consommer_quota(text, integer) to service_role;
grant execute on function public.noter_propositions(text[]) to service_role;

-- Ensuite, dans Vercel → Settings → Environment Variables : supprimer SUPABASE_ACCESS_TOKEN
-- (le cron n'en a plus besoin), puis révoquer ce jeton sur supabase.com/dashboard/account/tokens.
