-- ============================================================
-- MIGRATION : journal des pannes signalées via le "Guide de la maison"
-- À appliquer dans Supabase → SQL Editor, après schema.sql et les
-- migrations déjà en place.
-- ============================================================
--
-- ⚠️ NE PAS APPLIQUER SANS L'ACCORD DE LOUIS ⚠️
--
-- Contexte : Aurélie a demandé, le 17/09/2026, un mini algorithme de
-- dépannage dans l'onglet "Guide de la maison" (rubrique "Urgences") :
-- un utilisateur qui a une panne électrique ou une fuite d'eau est guidé
-- pas à pas (zone → tableau/nourrice à vérifier → problème réglé ou
-- persistant → liste des artisans si ça persiste). Elle veut qu'un compte
-- admin soit informé dès qu'un utilisateur emprunte ce chemin, "pour
-- l'aider à le résoudre" — l'affichage précis côté admin reste à définir
-- avec elle plus tard ; cette migration ne fait que préparer le stockage
-- de ces signalements.
--
-- Une ligne est créée quand quelqu'un sélectionne une zone en panne, puis
-- mise à jour (statut) quand il clique "Problème réglé" ou "Problème
-- persistant". Lecture réservée aux admins ; un utilisateur ne peut créer
-- ou modifier que ses propres signalements.

create table public.incident_reports (
  id uuid default uuid_generate_v4() primary key,
  category text not null check (category in ('electrique', 'eau')),
  zone_id text not null,
  zone_label text not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'resolved', 'persistent')),
  reported_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.incident_reports enable row level security;

create policy "incident_reports_select_admin" on public.incident_reports
for select to authenticated
using (public.get_user_role(auth.uid()) = 'admin');

create policy "incident_reports_insert_own" on public.incident_reports
for insert to authenticated
with check (reported_by = auth.uid());

create policy "incident_reports_update_own_or_admin" on public.incident_reports
for update to authenticated
using (reported_by = auth.uid() or public.get_user_role(auth.uid()) = 'admin');
