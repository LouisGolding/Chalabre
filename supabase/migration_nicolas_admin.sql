-- ⚠️ NE PAS APPLIQUER SANS L'ACCORD DE LOUIS ⚠️
--
-- Demandé par Aurélie le 23/10/2026 : remettre le compte de Nicolas
-- Lalande (nlalande.k@gmail.com) en rôle 'admin'.
--
-- Vérifié en base (lecture seule) le 23/10/2026 : ce compte est
-- actuellement en rôle 'family'.
--   id      : 87db66c3-1c71-4f1f-801f-de5f89f4a428
--   email   : nlalande.k@gmail.com
--   role    : family  →  admin
--
-- Safe à ré-exécuter (idempotent : ne touche que ce compte, et ne fait
-- rien s'il est déjà 'admin').

update public.profiles
set role = 'admin'
where id = '87db66c3-1c71-4f1f-801f-de5f89f4a428'
  and email = 'nlalande.k@gmail.com';

-- Vérification après exécution (doit renvoyer role = 'admin') :
-- select id, first_name, last_name, email, role from public.profiles
-- where id = '87db66c3-1c71-4f1f-801f-de5f89f4a428';
