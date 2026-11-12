-- Mesure du retour (plan C, 12/11/2026) : est-ce que les gens reviennent ? À coller dans
-- Supabase → SQL Editor.
--
-- Aucun identifiant n'est stocké. L'appareil calcule lui-même son ancienneté (jours depuis sa
-- première recherche) et l'envoie ; la base ne garde que le jour, cette ancienneté et « première
-- recherche ou non ». La promesse de la page confidentialité (identifiant effacé au bout d'un
-- jour) tient donc toujours. Limite assumée : on sait combien de recherches viennent d'appareils
-- anciens, pas combien de personnes distinctes.

create table if not exists public.recherches (
  jour date not null default (now() at time zone 'Europe/Paris')::date,
  anciennete smallint not null check (anciennete between 0 and 3650),
  premiere boolean not null default false
);
alter table public.recherches enable row level security;
revoke all on public.recherches from anon, authenticated;

create or replace function public.noter_recherche(p_anciennete integer, p_premiere boolean)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  insert into recherches (anciennete, premiere)
  values (least(greatest(coalesce(p_anciennete, 0), 0), 3650), coalesce(p_premiere, false));
$function$;

revoke execute on function public.noter_recherche(integer, boolean) from public, anon, authenticated;
grant execute on function public.noter_recherche(integer, boolean) to service_role;

-- La lecture, par semaine : nouveaux appareils, et recherches venant d'appareils revenus après
-- au moins 7 jours. C'est ce second chiffre qui dira si le produit retient.
create or replace view public.retour_par_semaine as
select date_trunc('week', jour)::date as semaine,
       count(*) as recherches,
       count(*) filter (where premiere) as nouveaux_appareils,
       count(*) filter (where anciennete >= 7) as recherches_apres_7_jours,
       count(*) filter (where anciennete >= 28) as recherches_apres_28_jours
from public.recherches
group by 1
order by 1;
revoke all on public.retour_par_semaine from anon, authenticated;
