-- ✅ DÉJÀ APPLIQUÉE EN PRODUCTION (23/10/2026) — gardée pour l'historique
--
-- Demandé par Aurélie le 23/10/2026 : remettre le compte de Nicolas
-- Lalande (nlalande.k@gmail.com) en rôle 'admin'.
--
-- Vérifié en base (lecture seule) le 23/10/2026 avant exécution : ce
-- compte était alors en rôle 'family'.
--   id      : 87db66c3-1c71-4f1f-801f-de5f89f4a428
--   email   : nlalande.k@gmail.com
--   role    : family  →  admin
--
-- ⚠️ Exception au processus habituel ("ne pas appliquer sans l'accord de
-- Louis") : Aurélie a explicitement demandé dans le chat le 23/10/2026
-- ("peux tu changer toi meme mon compte 'nicolas lalande' en admin stp")
-- que ce changement ponctuel, simple et réversible (un seul champ, un
-- seul compte) soit exécuté directement, sans attendre Louis. Exécuté via
-- une requête en écriture directe sur Supabase (execute_sql), pas par
-- cette migration (qui documente malgré tout le changement, par
-- cohérence avec les autres fichiers de ce dossier). Résultat vérifié
-- immédiatement après exécution : role = 'admin'. Louis n'a donc rien à
-- appliquer pour ce point précis — à titre d'information seulement.
--
-- Safe à ré-exécuter si besoin (idempotent : ne touche que ce compte, et
-- ne fait rien s'il est déjà 'admin').

update public.profiles
set role = 'admin'
where id = '87db66c3-1c71-4f1f-801f-de5f89f4a428'
  and email = 'nlalande.k@gmail.com';

-- Vérification faite après exécution (a bien renvoyé role = 'admin') :
-- select id, first_name, last_name, email, role from public.profiles
-- where id = '87db66c3-1c71-4f1f-801f-de5f89f4a428';
