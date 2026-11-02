-- 01/11/2026 -- Decision d'Aurelie : Alexandre Lalande paie souvent sa
-- taxe de sejour en une fois, en cash, a Guy Lalande. Son sejour doit
-- apparaitre comme un widget entier sur le tableau de bord de Guy --
-- comme si Alexandre etait son enfant -- pour que Guy puisse payer a sa
-- place. Traite comme un CAS UNIQUE (pas une fonctionnalite generale de
-- paiement delegue pour tout le monde) : les deux ont deja un vrai
-- compte, pas de fiche a creer.
--
-- Nouvelle colonne : un profil peut designer un AUTRE profil comme
-- responsable du reglement de sa taxe de sejour. Nullable, vide pour
-- tout le monde sauf Alexandre.
--
-- Cote code (02/11/2026, voir le detail dans NextStayCard.tsx --
-- DelegatedStay/DelegatedStayBanner -- et planning/page.tsx) :
-- - Sur le tableau de bord du compte DESIGNE (ici Guy), chaque sejour
--   (passe, en cours ou a venir) du compte qui le designe (ici
--   Alexandre) devient son propre widget, en LECTURE SEULE (pas
--   d'edition des dates depuis le compte de Guy -- seul le reglement de
--   la taxe de sejour est actionnable).
-- - Autorisation de paiement (src/app/api/stripe/checkout/route.ts,
--   isDelegatedPayer) : le compte designe peut regler la taxe de sejour
--   d'un sejour dont le titulaire (profiles.ts_payer_id) le designe,
--   au meme titre que le titulaire lui-meme, un membre de sa famille
--   nucleaire pour un accompagnant, ou un admin.

alter table public.profiles
  add column if not exists ts_payer_id uuid references public.profiles(id);

comment on column public.profiles.ts_payer_id is
  'Profil responsable du reglement de la taxe de sejour de CE profil (cas unique Alexandre -> Guy, demande d''Aurelie le 01/11/2026) -- nullable, vide par defaut.';

-- Alexandre delegue a Guy.
update public.profiles
set ts_payer_id = (select id from public.profiles where first_name = 'Guy' and last_name = 'Lalande' limit 1)
where first_name = 'Alexandre' and last_name = 'Lalande';
