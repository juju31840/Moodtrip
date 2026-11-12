-- Quota par jour et plafond global (plan C, 12/11/2026) : la perte maximale est connue d'avance.
-- À coller dans Supabase → SQL Editor. Additif : ne touche pas à consommer_quota (fenêtre d'une heure).
--
-- Même mécanique que consommer_quota, sur une fenêtre d'un jour. Trois clés l'utilisent :
-- l'appareil (3/jour), l'adresse IP (12/jour) et « global » (20/jour pour toute l'application).
-- Le plafond est borné ici (50 max) : l'appelant ne peut pas s'accorder un quota arbitraire.
--
-- La page de confidentialité promet que l'identifiant d'appareil et l'IP sont effacés au bout d'un
-- jour : chaque appel purge donc les lignes dont la fenêtre est échue (la table reste minuscule).

create or replace function public.consommer_quota_jour(p_cle text, p_max integer)
 returns table(autorise boolean, restant integer)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_jetons integer;
begin
  p_max := least(greatest(coalesce(p_max, 1), 1), 50);
  delete from quotas where recharge_a < now() - interval '1 day';
  insert into quotas (cle, jetons, recharge_a) values ('jour:' || p_cle, p_max - 1, now())
  on conflict (cle) do update set
    jetons = least(greatest(quotas.jetons - 1, -1), p_max - 1)
  returning quotas.jetons into v_jetons;

  return query select v_jetons >= 0, greatest(v_jetons, 0);
end;
$function$;

revoke execute on function public.consommer_quota_jour(text, integer) from public, anon, authenticated;
grant execute on function public.consommer_quota_jour(text, integer) to service_role;
