-- Appliquée le 26/10/2026 (demande de Nicolas) : tout compte "famille" peut
-- cocher/décocher N'IMPORTE QUELLE tâche d'Entretien, pas seulement les
-- siennes. Le contenu d'une tâche (titre, catégorie, priorité, période,
-- récurrence...) reste modifiable seulement par son auteur ou un admin :
-- garanti par le trigger tasks_family_guard ci-dessous (la RLS ne sait pas
-- restreindre par colonne). Complète migration_tasks_family_access.sql.
-- Rejouable sans erreur (drop ... if exists).

drop policy if exists "tasks_family_toggle_any" on public.tasks;
create policy "tasks_family_toggle_any" on public.tasks for update to authenticated
  using (get_user_role(auth.uid()) = 'family')
  with check (get_user_role(auth.uid()) = 'family');

create or replace function public.tasks_family_guard()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if get_user_role(auth.uid()) = 'family'
     and old.created_by is distinct from auth.uid()
     and (row(new.id, new.title, new.description, new.category, new.priority, new.created_by,
              new.created_at, new.period, new.recurrence, new.comment)
          is distinct from
          row(old.id, old.title, old.description, old.category, old.priority, old.created_by,
              old.created_at, old.period, old.recurrence, old.comment))
  then
    raise exception 'Vous ne pouvez modifier que les tâches que vous avez créées';
  end if;
  return new;
end $$;

drop trigger if exists tasks_family_guard on public.tasks;
create trigger tasks_family_guard before update on public.tasks
  for each row execute function public.tasks_family_guard();
