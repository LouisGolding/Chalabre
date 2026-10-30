-- Fiches "membre de la famille" créées le 30/10/2026 (demande d'Aurélie,
-- arbre généalogique complet fourni le même jour) pour les conjoints et
-- enfants des 11 couples de la famille qui n'avaient pas encore de
-- compte -- voir migration_profiles_member_without_login.sql, appliquée
-- juste avant. Dates de naissance : réelles quand connues (déjà un
-- compte), sinon fictives -- à corriger au fil de l'eau dans Gestion >
-- Membres (colonne éditable "Date de naissance", voir
-- MembersTable.tsx).
insert into public.profiles (first_name, last_name, date_of_birth, family_group, role, status, color_hue, nuclear_family, has_login, email)
values
  -- Lalande
  ('Emmanuelle', 'de Barbarin',     '1983-05-14', 'lalande', 'family', 'active', 3,  'lal-emmanuelle-barbarin', false, null),
  ('Guilhem',    'de Barbarin',     '1982-02-09', 'lalande', 'family', 'active', 5,  'lal-emmanuelle-barbarin', false, null),
  ('Zoé',        'de Barbarin',     '2002-03-10', 'lalande', 'family', 'active', 7,  'lal-emmanuelle-barbarin', false, null),
  ('Oscar',      'de Barbarin',     '2005-11-22', 'lalande', 'family', 'active', 8,  'lal-emmanuelle-barbarin', false, null),
  ('Frédéric',   'Lalande',         '1975-03-20', 'lalande', 'family', 'active', 13, 'lal-frederic',            false, null),
  ('Véronique',  'de Rop',          '1976-11-02', 'lalande', 'family', 'active', 14, 'lal-frederic',            false, null),
  ('Chloé',      'Lalande',         '2008-07-04', 'lalande', 'family', 'active', 15, 'lal-frederic',            false, null),
  ('Sabine',     'Graissaguel',     '1979-09-25', 'lalande', 'family', 'active', 18, 'lal-mathieu',             false, null),
  ('Charlotte',  'Lalande',         '2006-02-14', 'lalande', 'family', 'active', 19, 'lal-mathieu',             false, null),
  ('Tabatha',    'Lalande',         '2009-08-19', 'lalande', 'family', 'active', 20, 'lal-mathieu',             false, null),
  ('Juliette',   'Lalande',         '2012-05-03', 'lalande', 'family', 'active', 21, 'lal-mathieu',             false, null),
  ('Otto',       'Lalande',         '2019-11-05', 'lalande', 'family', 'active', 25, 'lal-nicolas-aurelie',     false, null),
  ('Alma',       'Jullien-Lalande', '2022-04-10', 'lalande', 'family', 'active', 26, 'lal-margaux',             false, null),
  ('Sarah',      'David',           '1986-08-30', 'lalande', 'family', 'active', 28, 'lal-antoine',             false, null),
  ('Joanna',     'Lalande-David',   '2014-09-27', 'lalande', 'family', 'active', 29, 'lal-antoine',             false, null),
  -- Canat
  ('Antonia',    'Canat',           '1972-01-17', 'canat',   'family', 'active', 2,  'can-antonia-xavier',      false, null),
  ('Xavier',     'Cardon',          '1970-12-05', 'canat',   'family', 'active', 4,  'can-antonia-xavier',      false, null),
  ('Anaïs',      'Cardon',          '2007-04-16', 'canat',   'family', 'active', 6,  'can-antonia-xavier',      false, null),
  ('Valentin',   'Cardon',          '2010-12-01', 'canat',   'family', 'active', 7,  'can-antonia-xavier',      false, null),
  ('Viktor',     'Canat',           '2015-03-01', 'canat',   'family', 'active', 13, 'can-guillaume',           false, null),
  ('Sofia',      'Canat',           '2017-09-12', 'canat',   'family', 'active', 14, 'can-guillaume',           false, null),
  ('Clémentine', 'Blandin',         '1974-07-23', 'canat',   'family', 'active', 16, 'can-clementine',          false, null),
  ('Eric',       'Blandin',         '1973-10-14', 'canat',   'family', 'active', 17, 'can-clementine',          false, null),
  ('Mathis',     'Blandin',         '2008-01-29', 'canat',   'family', 'active', 19, 'can-clementine',          false, null),
  ('Timéo',      'Blandin',         '2011-06-08', 'canat',   'family', 'active', 20, 'can-clementine',          false, null),
  ('Claire',     'Jalabert',        '1976-02-28', 'canat',   'family', 'active', 24, 'can-claire-laurent',      false, null),
  ('Laurent',    'Jalabert',        '1975-05-19', 'canat',   'family', 'active', 25, 'can-claire-laurent',      false, null),
  ('Manon',      'Jalabert',        '2005-10-21', 'canat',   'family', 'active', 27, 'can-claire-laurent',      false, null),
  ('Guilhem',    'Jalabert',        '2008-03-15', 'canat',   'family', 'active', 28, 'can-claire-laurent',      false, null),
  ('Gallade',    'Jalabert',        '2011-07-30', 'canat',   'family', 'active', 29, 'can-claire-laurent',      false, null),
  ('Marius',     'Jalabert',        '2013-02-26', 'canat',   'family', 'active', 31, 'can-claire-laurent',      false, null),
  ('Alice',      'Canat',           '1981-03-07', 'canat',   'family', 'active', 34, 'can-alice',               false, null),
  ('Greg',       'Martin',          '1980-09-16', 'canat',   'family', 'active', 36, 'can-alice',               false, null),
  ('Mickael',    'Martin',          '2009-04-09', 'canat',   'family', 'active', 38, 'can-alice',               false, null),
  ('Samuel',     'Martin',          '2012-10-17', 'canat',   'family', 'active', 40, 'can-alice',               false, null);

-- Amicie Blandin avait déjà un compte, mais pas encore de nuclear_family
-- -- rattachée à la famille de sa mère Clémentine.
update public.profiles set nuclear_family = 'can-clementine' where id = '1f74cf6a-11e0-414f-9141-bb03eb03fa81';
