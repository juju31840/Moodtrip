-- 27/09/2026 : candidats_autour et candidats_voyage renvoient jour_seulement, lu dans la
-- catégorie Foursquare (culte, bibliothèque, château, mémorial, cimetière, université).
-- Appliquée en production par l'API de gestion. Voir periodesOuvertes (lib/places-db.ts).
begin;
drop function public.candidats_autour;
CREATE FUNCTION public.candidats_autour(p_lat double precision, p_lng double precision, p_rayon_km double precision, p_themes text[] DEFAULT NULL::text[], p_par_theme integer DEFAULT 12, p_graine text DEFAULT ''::text, p_meme_commune boolean DEFAULT false)
 RETURNS TABLE(ref text, fsq_id text, nom text, lat double precision, lng double precision, adresse text, type_lieu text, themes text[], distance_m integer, commune text, notoriete smallint, raison text, gamme text, jour_seulement boolean)
 LANGUAGE sql
 STABLE PARALLEL SAFE
AS $function$
  -- Les lieux reconnus (sources éditoriales, Wikidata) passent en tête, à l'intérieur de chaque
  -- envie. Jusqu'au 24/09/2026 le tri tombait sur md5 faute de tout signal : le modèle composait
  -- parmi un tirage au sort, d'où « un café au hasard » dans les retours des testeurs.
  -- « Toute la ville » ne sort pas de la commune de départ (retour des testeurs, 24/09/2026) :
  -- celle dont le centre est le plus proche, parmi les communes assez fournies pour en être une.
  with depart as (
    select c.nom from communes c
    where p_meme_commune
      and ST_DWithin(c.centre, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, 25000)
      and c.nb_lieux >= 40
    order by ST_Distance(c.centre, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) limit 1
  ), proches as (
    select p.fsq_id, p.name, p.location, p.address, p.place_type, p.themes, p.locality_norm,
           p.visited_count, p.rating_sum, p.rating_count, p.notoriete, p.raison, p.gamme, p.categories,
           ST_Distance(p.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) as d
    from places p
    where ST_DWithin(p.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, p_rayon_km * 1000)
      and p.google_status is distinct from 'closed'
      and not p.coord_douteuse and not p.est_chaine and not p.nom_douteux
      and cardinality(p.themes) > 0
      and (p_themes is null or p.themes && p_themes)
      and (not p_meme_commune or not exists (select 1 from depart) or p.locality_norm = (select nom from depart) or p.locality_norm like (select nom from depart) || '-%arrondissement%')
    -- Les lieux reconnus d'abord, pour qu'un lieu cité à 2 km ne soit pas évincé par 900 voisins.
    -- « Toute la ville » : tirage réparti sur la commune et non les 900 plus proches, sans quoi
    -- le parcours restait à 1-3 km du centre (mesuré le 24/09/2026) et valait « le quartier ».
    order by (p.notoriete > 0) desc,
             case when p_meme_commune then md5(p.fsq_id || p_graine) end,
             d
    limit 900
  ), classe as (
    select *, coalesce((select t from unnest(themes) t
                        where p_themes is null or t = any(p_themes) limit 1), 'autre') as theme_cle
    from proches
  ), tire as (
    select *, row_number() over (partition by theme_cle order by
                        notoriete desc,
                        (visited_count = 0),
                        (case when rating_count >= 2 then rating_sum::numeric / rating_count else 0 end) desc,
                        md5(fsq_id || p_graine)) as rang
    from classe
  )
  select 'L' || row_number() over (order by theme_cle, rang),
         fsq_id, name, ST_Y(location::geometry), ST_X(location::geometry),
         address, place_type, themes, round(d)::integer, locality_norm, notoriete, raison, gamme,
         -- Fermé le soir par nature (culte, bibliothèque, château, mémorial…) : lu dans la catégorie
         -- et non dans le nom, « Lyon Cathedral » ou « Diyanet Fatih Camii » ne disant pas « église ».
         exists (select 1 from unnest(categories) c
                 where c ~ '(Spiritual Center|Library|Memorial Site|Cemetery|Castle|College and University)')
  from tire where rang <= p_par_theme order by theme_cle, rang;
$function$;
grant execute on function public.candidats_autour to anon, authenticated, service_role;
drop function public.candidats_voyage;
CREATE FUNCTION public.candidats_voyage(p_lat double precision, p_lng double precision, p_rayon_km double precision, p_themes text[] DEFAULT NULL::text[], p_par_theme integer DEFAULT 22, p_graine text DEFAULT ''::text)
 RETURNS TABLE(ref text, fsq_id text, nom text, lat double precision, lng double precision, adresse text, type_lieu text, themes text[], distance_m integer, commune text, notoriete smallint, raison text, gamme text, jour_seulement boolean)
 LANGUAGE sql
 STABLE PARALLEL SAFE
AS $function$
  with pt as (select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography as g),
  -- Les villes les plus **fournies** du rayon, pas les plus proches : trier par distance ne
  -- remontait que les communes de banlieue, et un voyage au départ de Lille doit pouvoir passer
  -- par Arras ou Amiens.
  villes as (
    select c.nom, c.nb_lieux, ST_Distance(c.centre, (select g from pt)) as d
    from communes c
    where ST_DWithin(c.centre, (select g from pt), p_rayon_km * 1000) and c.nb_lieux >= 150
    order by c.nb_lieux desc limit 7
  ),
  depart as (
    select c.nom from communes c
    where ST_DWithin(c.centre, (select g from pt), 25000) and c.nb_lieux >= 40
    order by ST_Distance(c.centre, (select g from pt)) limit 1
  ),
  retenues as (
    select nom from villes union select nom from depart
  ), brut as (
    select p.fsq_id, p.name, p.location, p.address, p.place_type, p.themes, p.locality_norm,
           p.notoriete, p.raison, p.gamme, p.categories,
           ST_Distance(p.location, (select g from pt)) as d,
           (p.locality_norm = (select nom from depart)) as est_depart
    from places p
    where p.locality_norm in (select nom from retenues)
      and p.google_status is distinct from 'closed'
      and not p.coord_douteuse and not p.est_chaine and not p.nom_douteux
      and cardinality(p.themes) > 0
      and (p_themes is null or p.themes && p_themes)
  ), reparti as (
    select *, row_number() over (partition by locality_norm order by notoriete desc, md5(fsq_id || p_graine)) as rang_commune
    from brut
  ), proches as (
    select * from reparti where rang_commune <= case when est_depart then 70 else 40 end
  ), classe as (
    select *, coalesce((select t from unnest(themes) t
                        where p_themes is null or t = any(p_themes) limit 1), 'autre') as theme_cle
    from proches
  ), tire as (
    select *, row_number() over (partition by theme_cle order by notoriete desc, md5(fsq_id || p_graine || 'b')) as rang
    from classe
  )
  select 'L' || row_number() over (order by theme_cle, rang),
         fsq_id, name, ST_Y(location::geometry), ST_X(location::geometry),
         address, place_type, themes, round(d)::integer, locality_norm, notoriete, raison, gamme,
         -- Fermé le soir par nature (culte, bibliothèque, château, mémorial…) : lu dans la catégorie
         -- et non dans le nom, « Lyon Cathedral » ou « Diyanet Fatih Camii » ne disant pas « église ».
         exists (select 1 from unnest(categories) c
                 where c ~ '(Spiritual Center|Library|Memorial Site|Cemetery|Castle|College and University)')
  from tire where rang <= p_par_theme order by theme_cle, rang;
$function$;
grant execute on function public.candidats_voyage to anon, authenticated, service_role;
commit;