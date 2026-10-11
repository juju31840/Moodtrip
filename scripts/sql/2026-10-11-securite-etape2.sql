-- Audit du 11/10/2026, étape 2 : à lancer dans Supabase → SQL Editor AVANT de déployer le code
-- qui utilise SUPABASE_SECRET_KEY. Compatible avec le code actuel : rien ne casse si on s'arrête là.
-- (L'étape 1 est 2026-10-11-securite-audit.sql ; l'étape 3, 2026-10-11-securite-etape3.sql.)

-- A. Adresse IP de l'appelant, telle que la passerelle Supabase la transmet à PostgREST.
--    Null quand l'appel ne vient pas de l'API REST (SQL Editor, cron) : pas de limite dans ce cas.
create or replace function public.vt_ip_appelant()
 returns text
 language sql
 stable
 set search_path to 'public'
as $$
  select nullif(trim(coalesce(
    current_setting('request.headers', true)::json ->> 'cf-connecting-ip',
    split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1)
  )), '');
$$;

-- B. Votes plafonnés par adresse IP : 20 signaux par heure (visites et notes confondues ; 20 est
--    aussi le plafond maximal de consommer_quota depuis l'étape 1). Une soirée, c'est 3 étapes
--    cochées et notées (6 signaux) ; un script qui gonfle le classement d'un lieu est arrêté au 21e.
create or replace function public.vt_vote_autorise()
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare v_ip text := vt_ip_appelant(); v_ok boolean;
begin
  if v_ip is null then return true; end if;
  select autorise into v_ok from consommer_quota('vote:' || v_ip, 20);
  return coalesce(v_ok, false);
end;
$$;
revoke execute on function public.vt_vote_autorise() from public, anon, authenticated;

create or replace function public.noter_lieu(p_nom text, p_lat double precision, p_lng double precision, p_note integer)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_id text;
begin
  -- Une note hors échelle est une erreur d'appel, pas une opinion : on l'ignore plutôt que
  -- de laisser un 12 sur 5 fausser une moyenne pour toujours.
  if p_note is null or p_note < 1 or p_note > 5 then return; end if;
  if length(p_nom) > 200 or not vt_vote_autorise() then return; end if;

  select fsq_id into v_id from places
  where ST_DWithin(location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, 150)
    and regexp_replace(lower(vt_unaccent(name)), '[^a-z0-9]', '', 'g')
      = regexp_replace(lower(vt_unaccent(p_nom)), '[^a-z0-9]', '', 'g')
  limit 1;

  if v_id is not null then
    update places
       set rating_sum = rating_sum + p_note, rating_count = rating_count + 1
     where fsq_id = v_id;
  end if;
end;
$function$;

create or replace function public.noter_visite(p_nom text, p_lat double precision, p_lng double precision)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_id text;
begin
  if length(p_nom) > 200 or not vt_vote_autorise() then return; end if;

  select fsq_id into v_id from places
  where ST_DWithin(location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, 150)
    and regexp_replace(lower(vt_unaccent(name)), '[^a-z0-9]', '', 'g')
      = regexp_replace(lower(vt_unaccent(p_nom)), '[^a-z0-9]', '', 'g')
  limit 1;

  if v_id is not null then
    update places set visited_count = visited_count + 1 where fsq_id = v_id;
  end if;
end;
$function$;

-- C. noter_propositions : appelée seulement par le serveur. Tableau borné (2 propositions × 18
--    étapes au plus en voyage = 36 ; marge à 60). Le droit de la clé publique est retiré à l'étape 3.
create or replace function public.noter_propositions(p_ids text[])
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  update places set proposed_count = proposed_count + 1
  where fsq_id = any(p_ids) and coalesce(cardinality(p_ids), 0) <= 60;
$function$;

-- D. Cron de vérification Google : deux fonctions réservées au serveur (clé secrète), pour ne plus
--    passer par le jeton d'administration de l'API de gestion (qui ouvre tout le compte Supabase)
--    ni construire du SQL par concaténation.
create or replace function public.file_verification_google(p_lot integer)
 returns table(fsq_id text, nom text, adresse text, commune text, lat double precision, lng double precision)
 language sql
 stable
 set search_path to 'public'
as $$
  select fsq_id, name, address, locality,
         ST_Y(location::geometry), ST_X(location::geometry)
  from places
  where (google_checked_at is null or google_checked_at < now() - interval '180 days')
    and not coord_douteuse and not est_chaine and not nom_douteux
  order by proposed_count desc, (refreshed_at < date '2022-01-01') desc, google_checked_at nulls first
  limit least(greatest(p_lot, 1), 200);
$$;

create or replace function public.enregistrer_verdict_google(p_fsq_id text, p_statut text, p_place_id text)
 returns void
 language sql
 set search_path to 'public'
as $$
  update places
     set google_status = p_statut, google_checked_at = now(), google_place_id = p_place_id
   where fsq_id = p_fsq_id and p_statut in ('exists', 'closed', 'not_found');
$$;

revoke execute on function public.file_verification_google(integer) from public, anon, authenticated;
revoke execute on function public.enregistrer_verdict_google(text, text, text) from public, anon, authenticated;
grant execute on function public.file_verification_google(integer) to service_role;
grant execute on function public.enregistrer_verdict_google(text, text, text) to service_role;
