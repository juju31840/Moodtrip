-- Correctifs de l'audit de sécurité du 11/10/2026 (rapport : carnet, « Sécurité des apps vibe-codées »).
-- À coller dans Supabase → SQL Editor, puis Run. Rejouable sans risque.

-- 1. Le quota se contournait : consommer_quota est appelable avec la clé publique et prenait le
--    plafond fourni par l'appelant. Un appel avec p_max = 1 000 000 levait toute limite, payée sur
--    le crédit Anthropic. Le plafond est désormais borné en base, quoi que l'appelant demande
--    (20 = MAX_PAR_ADRESSE, le plus haut plafond utilisé par lib/rate-limit.ts), et un compteur
--    déjà gonflé est ramené sous ce plafond au premier appel.
--    Solution complète, plus tard : appel avec la clé secrète côté serveur, puis retrait du droit à anon.
create or replace function public.consommer_quota(p_cle text, p_max integer)
 returns table(autorise boolean, restant integer)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_jetons integer;
begin
  p_max := least(greatest(coalesce(p_max, 1), 1), 20);
  insert into quotas (cle, jetons, recharge_a) values (p_cle, p_max - 1, now())
  on conflict (cle) do update set
    jetons = case when quotas.recharge_a < now() - interval '1 hour' then p_max - 1
                  else least(greatest(quotas.jetons - 1, -1), p_max - 1) end,
    recharge_a = case when quotas.recharge_a < now() - interval '1 hour' then now()
                      else quotas.recharge_a end
  returning quotas.jetons into v_jetons;

  return query select v_jetons >= 0, greatest(v_jetons, 0);
end;
$function$;

-- 2. spatial_ref_sys (PostGIS) et points_repli : la clé publique pouvait écrire, effacer et vider
--    les tables (TRUNCATE ne passe pas par la RLS). Lecture conservée, écriture retirée.
--    Si la première ligne est refusée (table possédée par supabase_admin), lancer les autres quand même.
revoke insert, update, delete, truncate on public.spatial_ref_sys from anon, authenticated;
revoke insert, update, delete, truncate on public.points_repli from anon, authenticated;

-- 3. Politiques de lecture en double (même règle sous deux noms) sur communes et places.
drop policy if exists "lecture publique" on public.communes;
drop policy if exists "lecture publique" on public.places;
