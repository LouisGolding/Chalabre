-- 02/11/2026 -- A l'appui de la demande d'Aurelie sur Entretien :
-- "lorsqu'une tache periodique est effectuee cochee, tu l'as fait
-- apparaitre dans taches realisees, et tu feras apparaitre a nouveau
-- cette tache quand la periode redemarrera. Exemple : ramasser les
-- feuilles 'automne' si la tache est cochee, tu l'as fera reapparaitre
-- a l'automne prochain."
--
-- Fonctions cote base, calquees sur les colonnes deja existantes
-- public.tasks.period (mois ou saison, voir src/lib/task-periods.ts) et
-- public.tasks.recurrence ('once'/'monthly'/'yearly') :
--   - period_cycle_start(period, reference_date) : le debut (1er jour)
--     du cycle (mois ou saison meteorologique) qui contient
--     reference_date. Ex. period_cycle_start('automne', '2026-11-02')
--     -> '2026-09-01'.
--   - task_is_active(completed, recurrence, period, completed_at) :
--     true si la tache doit etre consideree comme "a faire" -- jamais
--     cochee, ou cochee mais le cycle a change depuis (mois pour
--     'monthly', ou le cycle period pour 'yearly' + period renseignee).
--   - vue tasks_effective : public.tasks + la colonne calculee
--     is_active, pour un usage SQL direct eventuel (ex. un futur
--     recapitulatif cote serveur).
--
-- Usage reel cote app (02/11/2026) : l'onglet Entretien
-- (TasksBoard.tsx) n'interroge PAS cette vue -- le fonctionnement deja
-- en place pour les taches jardin periodiques est un BASCULEMENT
-- d'etat (coche -> decoche, completed_at remis a null) recalcule au
-- chargement de la page, pas un double affichage simultane (confirme
-- par Aurelie le 26/10/2026 : "la tache ne doit apparaitre QUE dans
-- Taches realisees une fois cochee" -- voir le commentaire au-dessus de
-- nonJardinActive/nonJardinDone dans TasksBoard.tsx). Le correctif du
-- 02/11/2026 porte donc seulement sur la DATE DE REVEIL (desormais
-- alignee sur le debut du cycle periode plutot qu'un decalage fixe
-- +1 mois/+1 an depuis la coche) via un portage JS direct de
-- period_cycle_start (voir periodCycleStart/isDueForReactivation dans
-- TasksBoard.tsx) -- pas d'appel a ces fonctions SQL depuis le client.
-- Elles restent neanmoins creees et documentees ici pour un usage futur
-- cote serveur (ex. notification planifiee), et parce que la vue
-- tasks_effective a ete pensee a cet effet.

create or replace function public.period_cycle_start(p_period text, p_reference date)
returns date
language plpgsql
immutable
as $function$
declare
  y int := extract(year from p_reference)::int;
  m int := extract(month from p_reference)::int;
  v_month int;
  v_start date;
begin
  v_month := case p_period
    when 'janvier' then 1 when 'fevrier' then 2 when 'mars' then 3
    when 'avril' then 4 when 'mai' then 5 when 'juin' then 6
    when 'juillet' then 7 when 'aout' then 8 when 'septembre' then 9
    when 'octobre' then 10 when 'novembre' then 11 when 'decembre' then 12
    when 'printemps' then 3 when 'ete' then 6 when 'automne' then 9
    when 'hiver' then 12
    else null
  end;

  if v_month is null then
    return null;
  end if;

  v_start := make_date(y, v_month, 1);
  if v_start > p_reference then
    v_start := make_date(y - 1, v_month, 1);
  end if;
  return v_start;
end;
$function$;

create or replace function public.task_is_active(p_completed boolean, p_recurrence text, p_period text, p_completed_at timestamptz)
returns boolean
language sql
stable
as $function$
  select case
    when not p_completed then true
    when p_recurrence = 'monthly' and p_completed_at is not null
      and p_completed_at < date_trunc('month', now()) then true
    when p_recurrence = 'yearly' and p_period is not null and p_completed_at is not null
      and p_completed_at < public.period_cycle_start(p_period, current_date) then true
    else false
  end
$function$;

create or replace view public.tasks_effective as
select
  id, title, description, category, priority, completed, created_by, created_at,
  period, recurrence, completed_at, comment, completed_by,
  task_is_active(completed, recurrence, period, completed_at) as is_active
from public.tasks;

-- Rattrapage de la tache exemple citee par Aurelie : pas de
-- periode/recurrence renseignee avant ce jour (creee avant la mise en
-- place du formulaire periode/recurrence pour "Jardin").
update public.tasks
set period = 'automne', recurrence = 'yearly'
where title = 'Ramasser les feuilles mortes dans le jardin';
