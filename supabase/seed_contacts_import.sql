-- ============================================================
-- SEED : import des contacts depuis les captures d'écran d'Aurélie (22/09/2026)
-- À exécuter dans Supabase -> SQL Editor, APRES avoir appliqué
-- supabase/migration_contacts_extra.sql (colonnes category/address).
-- ============================================================
--
-- ATTENTION - plusieurs cellules etaient tronquees ou peu lisibles sur les
-- captures fournies (bords de colonnes coupes, cellule surlignee). Ces lignes
-- sont importees avec l'information partielle recue, et le champ concerne
-- contient une note '[... tronque ..., a completer]' pour reperage facile.
-- Chercher 'a completer' ou 'a confirmer' apres import pour les corriger.
--
-- Mapping de categorie : les sections de la feuille 'Bons contacts', 'Autres'
-- et 'Spots a visiter' n'ont pas d'equivalent direct parmi les 7 categories
-- fixes de l'app -> mappees par defaut vers 'bonnes_adresses'. A confirmer
-- avec Aurelie/Nicolas si un autre classement est prefere.

insert into public.contacts (category, role, name, phone, address, notes, email) values
  ('services', 'Ménage', 'Laura', '06 44 17 28 77', 'Chalabre', 'Top, belle fille de Manu Montorro (12€/heure)', NULL),
  ('services', 'Ménage', 'Marion Gabriel', '06 85 86 98 40', 'Chalabre', 'Depuis 2024', NULL),
  ('services', 'Électricité', 'Kader Sidanni', '06 77 81 21 75', 'Chalabre', NULL, NULL),
  ('services', 'Électricité', 'Gilbert Cayrol', '06 75 28 13 94', 'Sainte-Colombe', 'Retraité mais vient toujours', NULL),
  ('services', 'Électricité', 'Jonathan Mousseau', '06 87 17 12 55', '12 Av. Camille Bouche, 11300 Limoux', 'Fiable, a devisé la réfection de la maison de l''Hers', NULL),
  ('services', 'Électricité', 'David Soubies', '05 61 68 91 92', 'Mirepoix', 'Conseillé par Cabezas - à contacter', NULL),
  ('services', 'Électricité', 'Comas et Jouret', '05 61 01 03 17', 'Lavelanet', 'Conseillé par Cabezas - à contacter', NULL),
  ('services', 'Plombier', 'Alexandre Cassagnaud', '06 07 80 04 22', 'Chalabre', 'Pas fiable, trouver quelqu''un d''autre si possible', NULL),
  ('services', 'Plombier', 'Nicolas Cabezas', '07 85 87 10 10', 'Dreuilhe', 'Intervention 2025 Ch fresques / Sdb Pat / Ch anglaise', NULL),
  ('services', 'Charpentier', 'Padet (MP Charpente)', '06 07 57 25 85', 'Chalabre', NULL, NULL),
  ('services', 'Charpentier indépendant', 'Clément Potel', '06 50 10 00 65', NULL, 'Est venu voir la Ferme en 2020', NULL),
  ('services', 'Jardinier / Débroussailleur', 'Jean-François Grauby', '06 37 08 10 56', 'Sainte Colombes', NULL, NULL),
  ('services', 'Jardinier', 'Jean Paul Rosich', '06 86 17 67 56', 'Chalabre', 'S''occupe du jardin depuis 2023', NULL),
  ('services', 'Élagueur (platanes + autres arbres)', 'Symbiose', '06 45 57 74 14', 'Dun', 'Intervention platanes et jardin automne 2025', NULL),
  ('services', 'Urgence tonte parc', 'David Rodriguez', '06 74 84 31 39', NULL, 'Tonte parc et ferme avant Family Affairs 3 (300 euros pour 12h)', NULL),
  ('services', 'Plaquiste', 'Loic Geurts', '06 84 87 36 58', NULL, 'Intervention ch anglaise 2025', NULL),
  ('services', 'Ferronnier', 'Regis Rouse', '06 29 89 19 18', 'Villefort', NULL, NULL),
  ('services', 'Ferronnier', 'Ferronnier (Sainte Colombe) [nom non renseigné sur la capture]', '06 52 81 21 09', 'Sainte Colombe', NULL, NULL),
  ('services', 'Soudeur / Menuisier', 'Jérémie Vigna', '06 45 30 51 33', 'Rivel', 'Nouvel arrivant, intervention 2025 pour chambre anglaise', NULL),
  ('services', 'Découpe laser métal', 'Clément Gérard', '04 68 69 00 74', 'Cambieure', NULL, NULL),
  ('services', 'Ébéniste (Le Nouvel Atelier)', 'Richard Fournier', '06 25 62 42 46', 'Le Pagès - 09300 L''Aiguillon', NULL, 'http://www.ebenisterie-contemporaine [site tronqué dans la capture, à vérifier]'),
  ('services', 'Menuisier / Ébéniste', 'Gerard Fournier (père)', '05 61 01 90 24', 'L''Aiguillon 09300', 'Retraité', NULL),
  ('services', 'Forgeron', 'Thibault', '06 28 78 56 20', NULL, NULL, NULL),
  ('services', 'Réparations vélos', 'Bespoked (anglais)', '+44 7894 044 577', '8, rue du Pont de l''Hers, Chalabre', NULL, 'https://bespoked.org/'),
  ('services', 'Réparations vélos', 'Mondo Velo', NULL, 'Limoux', NULL, 'https://www.mondovelo.fr/magasins/1 [URL tronquée dans la capture, à compléter]'),
  ('bonnes_adresses', 'Bons contacts', 'Loic Tur Y Tur', '07 86 79 56 09', NULL, 'Propriétaire du Carrefour / Livraison possible', NULL),
  ('bonnes_adresses', 'Bons contacts', 'Jean-Baptiste Cazes', '06 87 55 31 02', NULL, NULL, NULL),
  ('bonnes_adresses', 'Vigneron', 'Jean-Louis Pinto', '06 64 81 39 43', '70, route de Limoux 09500 Moulin Neuf', 'Vigneron indépendant - vins naturels', NULL),
  ('bonnes_adresses', 'Tennis', 'Fabien', '06 50 21 25 17', NULL, NULL, NULL),
  ('bonnes_adresses', 'Mairie (ancien tennis, ami JP)', 'Bruno Carbonnel', '06 51 21 82 18', NULL, NULL, NULL),
  ('bonnes_adresses', 'Bons contacts', 'Romera', NULL, 'Lavelanet', 'Cousin de Claudie — [numéro non lisible sur la capture (cellule surlignée), à compléter]', NULL),
  ('bonnes_adresses', 'Bons contacts', 'Valentin Petrini', '06 79 58 18 89', NULL, 'Propriétaire le café des sports et l''écume des jours à Montbel', NULL),
  ('restaurants_bar', 'Camion pizza', 'Quercorb Pizza', '06 68 86 68 96', 'Chalabre', NULL, 'www.quercorb.ipizzaphone.fr'),
  ('restaurants_bar', 'Château de Sibra / tables d''hôtes', 'Saint-Georges', '07 87 96 89 42', 'Lagarde', 'Table d''hôtes', 'http://chateaudesibra.fr/saint-george'),
  ('restaurants_bar', 'Restaurant / bar', 'Zaza Club', NULL, 'Toreilles', 'Restaurant de plage top', NULL),
  ('restaurants_bar', 'Bière artisanale', 'BDQ Taproom & Kitchen (Puivert)', NULL, 'Puivert', 'Possibilité de louer tireuse avec fût', NULL),
  ('restaurants_bar', 'Restaurant', 'Abbaye de Camon', '05 61 60 31 23', '3 Pl. Philippe de Lévis, 09500 Camon', 'À réserver', 'https://www.chateaudecamon.com'),
  ('restaurants_bar', 'Restaurant italien', 'Restaurant Bourdasso', '0468780831', '[adresse tronquée dans la capture] ...adelles en Val, Val de Dagne, Aude (11), France — à compléter', 'À tester, conseil de Xavier', 'https://www.bourdasso.com/'),
  ('restaurants_bar', 'Café / bar', 'Café des sports (Padern)', NULL, '4 Rue du Confluent, 11350 Padern', 'À tester, conseil de Christine Doublet', NULL),
  ('restaurants_bar', 'Restaurant', 'Dorival', '04 11 66 98 82', '[adresse tronquée dans la capture] ...e Principale de Campsadourny, 11230 Puivert — probablement « Rue Principale », à vérifier', 'Vue sur le lac et le château de Puivert, cuisine éthique [commentaire tronqué dans la capture, à compléter]', 'https://www.facebook.com/restaurant.dorival'),
  ('restaurants_bar', 'Brunch / Déjeuner / Dîner argentin', 'Brunch/ Déjeuner / Dîner Argentin', NULL, 'À côté de BDQ à Puivert', '[commentaire tronqué dans la capture] ...ch le mardi, jeudi et vendredi / Soirée pizzas le vendredi et samedi — à compléter', NULL),
  ('maraichers', 'Maraîchère', 'Maggy', '06 31 45 22 83', 'Montfaucon - 11240 Mazerolles du Razès', 'Présente au marché de Mirepoix', NULL),
  ('maraichers', 'Maraîchère', 'Véronique', '04 34 21 92 12', NULL, 'Livraison possible', NULL),
  ('fromagers', 'Ferme du Pascouli (yaourts / feta)', 'Uli Laubert', '[numéro tronqué dans la capture] ...32 33 / 06 34 52 17 25 — indicatif manquant, à compléter', '11410 Payra-sur-l''Hers', 'A fourni le yaourt / feta de Family Affairs 3', 'uli.laubert@hotmail.fr / https://payrasurlhers.monsite-or... [URL tronquée dans la capture, à compléter]'),
  ('fromagers', 'La Ferme du Bosc (glaces lait de brebis)', 'Audeline', '[numéro tronqué dans la capture] ...67 07 / 06 31 64 78 57 — début manquant, à compléter', 'Le Bosc, 11420 Mayreville', 'À tester, conseil de Uli Laubert', NULL),
  ('fromagers', 'Fromager', 'GOT Franzy', '06 73 50 85 82', 'Pamiers', 'Présent au marché de Mirepoix (a fourni Family Affairs 3)', NULL),
  ('marches_boulangers', 'Pains variés — Marché de Mirepoix (lundi matin)', 'Audrey', '06 71 93 99 23', 'Marché de Mirepoix (devant Atmosphère''s)', 'Commander le pain le samedi avant 18h pour le lundi matin (complet, semi-complet, épeautre, etc.)', NULL),
  ('boutiques', 'Friperie', 'Frip''Maillot', NULL, 'Chalabre', 'Friperie, principalement (fermé le samedi)', NULL),
  ('boutiques', 'Boutique solidaire', 'Emmaüs Pamiers', '05 61 69 44 97', '3 Imp. du Pigeonnier, 09100 Pamiers', 'Fermé le lundi et jeudi', 'https://www.emmaus-ariege.fr/pamiers/'),
  ('boutiques', 'Boutique / brocante', 'Espace 09', '05 61 60 05 46', '33 Av. des Pyrénées, 09100 Saint-Jean-du-Falga [ville tronquée dans la capture, à confirmer]', 'Grand espace, beaucoup de choix', NULL),
  ('boutiques', 'Brocante', 'Brocante (Pujols)', NULL, 'Pujols', 'À la sortie de Pujols (sur la route de Pamiers)', NULL),
  ('boutiques', 'Potier', 'Françoise Louste / Jean Na... [nom tronqué dans la capture, à compléter]', '07 81 36 48 28', '10 rue Jules Amouroux, 09500 Rieucros', 'Potier, présent à Mirepoix, atelier top', 'fan.louste@laposte.net'),
  ('boutiques', 'L''empotée (poteries)', 'Aurélie Senié', NULL, NULL, NULL, 'http://www.lempotee.fr ; contact@lempotee.fr'),
  ('boutiques', 'Brocante', 'La Brocante des Couverts', '06 46 86 70 20', '27 Pl. Maréchal Leclerc, 09500 Mirepoix', 'Onéreux', NULL),
  ('boutiques', 'Brocante', 'Philipe Vidal', '05 81 30 51 87', '25 Rue Victor Hugo, 09500 Mirepoix', NULL, NULL),
  ('boutiques', 'Brocante de la Porte d''Aval', 'Daniel', '06 76 83 78 02 / 06 71... [second numéro tronqué dans la capture, à compléter]', '6, rue Monseigneur de Cambon, Mirepoix', 'Déplacement gratuit c. 50 km.', 'broc.daval@orange.fr'),
  ('boutiques', 'Tapis / décoration', 'Sweet Casita', NULL, '26 Place Maréchal Leclerc, 09500 Mirepoix', 'Nombreux tapis, kilims', 'https://www.atelier-b-attitude.com/sweet-casita/'),
  ('boutiques', 'Boutique déco', 'Boutik M', NULL, '22 Rue Maréchal Clauzel, 09500 Mirepoix', 'Belle vaisselle vintage', NULL),
  ('boutiques', 'Brocante', 'Brocante sortie de Mirepoix', NULL, '25 allée des Cordeliers', NULL, 'brocantemirepoix.fr'),
  ('boutiques', 'Brocante', 'Brocante il était une fois', NULL, '25 Av. Victor Hugo, 09500 Mirepoix', NULL, NULL),
  ('boutiques', 'Dépôt-vente', 'Coté Troc', '05 61 68 68 18', 'Mirepoix (rond-point en direction de Pamiers)', 'Grand dépôt-vente, beaucoup de choix', 'https://www.depot-vente-mirepoix.com/'),
  ('boutiques', 'Brocante', 'Le Dénicheur', NULL, 'Dreuilhe', NULL, NULL),
  ('boutiques', 'Brocante', 'Andrée Tort', '06 15 31 62 60', '5, cours Chabaud, Mirepoix 09500', 'Les empreintes du passé', 'andree.tort@wanadoo.fr'),
  ('boutiques', 'Brocante', 'La Caverne', '04 68 31 77 89', '13 Av. Fabre d''Eglantine, 11300 Limoux', 'À tester', NULL),
  ('boutiques', 'Brocante / matériaux anciens', 'Brocante d''Antan', '04 68 24 73 92 / 06 88 73 14 61', '4 places des Pyrénées, 11270 Orsans', 'À tester : achat et vente de matériaux anciens et de récupération', 'http://www.brocantedantan.com/'),
  ('boutiques', 'Brocante (spécialisé XVIIIe)', 'Bruno Patel', '06 15 05 21 08', 'Saint Roch, 11270 Fanjeaux', 'Spécialisé XVIIIe', NULL),
  ('boutiques', 'Brocante', 'L''Atelier Marc Doumenc', '06 31 88 13 52', '6 Bis rue Christian Cazalbou, 09190 Lorp-Sentaraille [ville tronquée dans la capture, à confirmer]', NULL, 'https://www.brocanteur-saint-girons.fr/'),
  ('boutiques', 'Brocante sur RDV', 'HillHouse Antiquités', '06 21 74 76 43', '7 Rue de la Poste, 11150 Villasavary', 'À tester', NULL),
  ('bonnes_adresses', 'Bricolage', 'Brico', NULL, 'Laroques-d''Olmes', NULL, NULL),
  ('bonnes_adresses', 'Pépinière', 'Pépinière de Puivert', '06 70 19 67 16', '9 rue des Forêts, 11230 Puivert', 'Arbres verger achetés là-bas', 'prb11@free.fr'),
  ('bonnes_adresses', 'Supermarché bio', 'La Verte d''Oc - Biomonde', NULL, '1 cours Dr Chabaud, 09500 Mirepoix', 'Supermarché bio / Vend du pain de Montségur', NULL),
  ('bonnes_adresses', 'Épices', 'Magepice 09', NULL, NULL, 'Présent au marché de Mirepoix', NULL),
  ('bonnes_adresses', 'Spot à visiter', 'Sites historiques et châteaux (Aude Tourisme)', NULL, NULL, NULL, 'https://www.audetourisme.com/fr/a-voir-a-faire/visiter/sites-historiques-et-chateaux/'),
  ('bonnes_adresses', 'Spot à visiter', 'Lac de Laurenti', NULL, NULL, NULL, NULL);
