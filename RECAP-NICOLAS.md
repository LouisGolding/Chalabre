# Récap pour Nicolas — 19 septembre 2026

Salut Nicolas,

Louis a repris tes 6 points, on a fait un audit de ton code et corrigé pas mal de choses.
Voici le détail : ses réponses, ce qui a été fait, ce qui reste, et des notes pour la suite.

Tout ce qui est **code** est déjà sur `main` (poussé + déployé sur Vercel). Tout ce qui est
**Supabase** (réglages du tableau de bord, migrations SQL) est signalé à part, parce que ça ne
vit pas dans le dépôt.

---

## ⚠️ Le plus important à savoir tout de suite

**La plupart de tes migrations SQL ne sont PAS encore appliquées en production.** Ton code est
déployé, mais la base ne connaît pas encore les nouvelles colonnes/tables — donc plusieurs pages
plantent ou se dégradent en prod tant que ces migrations ne sont pas exécutées (voir la section
« Migrations » plus bas). C'est le chantier n°1.

Deux réglages Supabase qui étaient cassés depuis le début ont été corrigés aujourd'hui (Site URL +
templates d'e-mail) — détail dans la section « Authentification ».

---

## Les réponses de Louis

| Sujet | Réponse de Louis |
|---|---|
| **Point 1 — cotisation éditable par le membre** | **Oui, d'accord.** Un membre (non-ami) peut modifier sa propre cotisation. → appliquer `migration_tm_self_edit.sql`. |
| **Point 4 — paiements / Canat** | Stripe a été branché avec les cartes pour les cotisations **Lalande**, mais **pas Canat**. À décider ensemble comment gérer les deux côtés (voir Paiements). |
| **Compte admin** | Toi (Nicolas) es déjà admin, et Louis aussi. Le compte d'Aurélie n'existe pas encore ; à promouvoir dès qu'elle s'inscrit. |

---

## Point par point

### 1. Cotisation mensuelle éditable par le membre
- **Réponse de Louis :** oui.
- **Fait :** ton code (route `/api/profiles/tm-tier` + `CotisationPill`) était bon ; audité et durci
  (montant entier obligatoire, borné à 10 000 ; le dernier admin ne peut plus se retirer le rôle).
  La migration `migration_tm_self_edit.sql` a été **relue** (elle est correcte et ciblée).
- **État :** ⏳ **migration pas encore appliquée** → en prod, un membre qui change sa cotisation croit
  que c'est sauvé, mais la base l'ignore encore. Ça marchera dès que la migration sera exécutée.

### 2. Migrations présentes dans le repo mais pas appliquées
- **Fait :** inventaire complet réalisé (voir section « Migrations »). **3 migrations dangereuses
  corrigées** avant application :
  - `migration_profile_colors.sql` — **elle réécrivait `handle_new_user()` en copiant l'ANCIENNE
    version de `schema.sql`**. L'appliquer telle quelle aurait réintroduit 3 bugs corrigés en
    septembre (comptes Google aux noms vides, date de naissance = jour d'inscription donc tarif
    enfant, rôle `family` donné aux invités). Réécrite à partir de la bonne version + `color_hue`.
    (`schema.sql` porte maintenant un avertissement « ne jamais copier cette fonction d'ici ».)
  - `migration_documents_storage.sql` — créait un bucket **public** pour des documents notariés /
    contrats / factures (lisibles par n'importe qui avec l'URL). Réécrite en bucket **privé** +
    URLs signées.
  - `migration_tm_amount_libre.sql` — libérait `profiles.tm_tier` mais oubliait la même contrainte
    sur `tm_payments.amount` → tout paiement de cotisation à montant libre aurait échoué. Corrigé.
- **État :** ✅ migrations corrigées et prêtes ; ⏳ **10 restent à appliquer** (section dédiée).

### 3. Page « Réserver » orpheline
- **Fait :** ✅ réglé. Un bouton **« Réserver un séjour »** a été ajouté sur la page **Planning**
  (plutôt qu'un 7e onglet qui aurait cassé ton montage 2×3). La page `/dashboard/reserver` est de
  nouveau accessible.
- **État :** ✅ déployé.

### 4. Redondance « Mes paiements » / suivi TM / Stripe
- **Fait :** rien touché — c'est une **décision de produit**, pas un bug. À trancher ensemble.
- **Lié :** Louis a branché Stripe pour **Lalande** mais pas **Canat**. Voir « Paiements » pour les
  options techniques. **On attend votre décision** avant de coder quoi que ce soit ici.

### 5. Bucket Storage pour les documents (admin)
- **Fait :** migration réécrite en **bucket privé** (lecture admin/family via URLs signées 1 h,
  écriture admin). `/api/documents` et la page Documents adaptés (le fichier stocke le *chemin*,
  plus une URL publique).
- **État :** ⏳ **bucket pas encore créé en prod** → l'upload de documents ne marchera qu'une fois
  `migration_documents_storage.sql` appliquée.

### 6. Tester les pages admin sans compte admin
- **Fait :** vérifié — **tu es déjà admin** (et Louis aussi). Les pages admin (Membres, Suivi
  paiements, upload de documents) sont donc testables avec ton compte.
- **Note :** le compte d'**Aurélie n'existe pas encore** (comptes actuels : Louis, Nicolas, Marius,
  Roméo). Dès qu'elle s'inscrit, une ligne SQL la passe admin :
  `update public.profiles set role='admin' where email='...';`

---

## Réparé / pas réparé — vue d'ensemble

| Élément | État |
|---|---|
| Page « Réserver » raccrochée | ✅ Fait (déployé) |
| 3 migrations dangereuses corrigées | ✅ Fait (dans le repo) |
| Simulations « mode dev » retirées des routes API | ✅ Fait (déployé) — voir note |
| Faille montant Stripe (client → base) | ✅ Fait (déployé) |
| Dernier admin protégé | ✅ Fait (déployé) |
| **Réinitialisation du mot de passe** (nouveau) | ✅ Fait (déployé) |
| Site URL Supabase (était `localhost:3000`) | ✅ Corrigé (tableau de bord) |
| Templates e-mail (reset + inscription) | ✅ Corrigés (tableau de bord) |
| **10 migrations SQL** | ⏳ **À appliquer** |
| Bucket Storage `documents` | ⏳ À créer (via migration) |
| Webhook Stripe + secret | ❌ Pas fait (voir Paiements) |
| Activation compte Stripe (vrai argent) | ❌ Pas fait |
| Découpe Canat / Lalande | ❌ Décision à prendre |

---

## Migrations — ce qui est appliqué et ce qui reste

**Déjà en prod :** `schema.sql`, `migration_payment_tracking.sql`, `migration_view_security.sql`,
`migration_auth_fix.sql`, `migration_profile_repair.sql` (septembre), et `migration_guest_bookings.sql`
(appliquée aujourd'hui).

**À appliquer, dans cet ordre** (SQL Editor de Supabase, une à la fois) :

1. `migration_bookings_house_side.sql`
2. `migration_profile_colors.sql`   ← réécrite, sûre
3. `migration_guest_people.sql`
4. `migration_contacts_extra.sql`
5. `migration_documents_categories.sql`
6. `migration_tasks_period.sql`
7. `migration_incident_reports.sql`
8. `migration_tm_amount_libre.sql`   ← réécrite
9. `migration_tm_self_edit.sql`   ← Louis a dit oui
10. `migration_documents_storage.sql`   ← réécrite (bucket privé)

> **Ne JAMAIS relancer** `schema.sql` ni `migration_payment_tracking.sql` (pas de garde
> « if not exists » sur leurs `create table`/`create policy` → échec en cours de route).
> Les 10 ci-dessus sont écrites pour être rejouables sans risque.

Tant qu'elles ne sont pas appliquées : Planning (couleurs), Contacts, Tâches, le widget
« Prochain séjour » (côté maison + accompagnants), et l'upload de Documents ne marchent pas
correctement en prod.

---

## Paiements (audit)

**Verdict : les paiements ne fonctionnent pas encore de bout en bout.**

| Vérif | Résultat |
|---|---|
| Clés Stripe | `pk_test` / `sk_test` — **mode test uniquement**, aucun vrai argent |
| Compte Stripe `charges_enabled` | **False** — compte non activé (il faut finir l'onboarding Stripe : infos entreprise + IBAN) |
| Endpoint webhook côté Stripe | **0 configuré** |
| `STRIPE_WEBHOOK_SECRET` | encore `whsec_placeholder…` |
| Montant facturé | **était pris du navigateur (faille) — corrigé**, relu en base maintenant |

**Le blocage clé :** même en test, le Checkout redirige et une carte de test « paie », mais **sans
endpoint webhook + secret réel, l'app n'est jamais prévenue** → le paiement reste `pending` pour
toujours. Il faut :
1. Créer un webhook Stripe vers `labatisse.art/api/stripe/webhook` (events
   `checkout.session.completed` + `payment_intent.payment_failed`) et mettre son `whsec_…` dans Vercel.
2. Activer le compte Stripe pour du vrai argent.
3. **Canat / Lalande** : aujourd'hui un seul compte Stripe. Options : deux comptes Stripe (routés
   par `house_side`), Stripe Connect, ou un seul compte + rapprochement manuel. **Décision à prendre.**

---

## Authentification / mot de passe oublié (nouveau)

- **Ajouté :** fonctionnalité complète « mot de passe oublié » : pages `/auth/reset-password` et
  `/auth/update-password`, + lien sur la connexion. Déployé.
- **Bug trouvé & corrigé :** le **Site URL** de Supabase était resté sur `http://localhost:3000`
  (défaut de dev). Résultat : tous les liens d'e-mail (reset **et** confirmation d'inscription)
  renvoyaient vers localhost — c'est pour ça que le lien de reset « tombait sur Learnly » (Learnly
  tournait sur le port 3000 en local). Corrigé : Site URL → `https://www.labatisse.art`, allowlist
  de redirection ajoutée, et les 2 templates d'e-mail (reset + inscription) pointent maintenant
  directement vers `/auth/callback` avec le `token_hash` (passés en français au passage).
- **À savoir :** l'e-mail Supabase intégré fonctionne mais est **limité en débit** (pas fait pour la
  prod). Si les envois deviennent capricieux, brancher un SMTP perso (Resend/Brevo/SendGrid, gratuit
  pour ce volume) dans Auth → SMTP.

---

## Notes / prochaines étapes pour toi

1. **Appliquer les 10 migrations** (section dédiée) — priorité n°1, ça débloque tes features en prod.
2. **Bouton Google disparu de la connexion** : ta refonte UI l'a retiré. À confirmer si c'est
   voulu (sinon, à remettre).
3. **`isDev` retiré des routes API** : avant, en local, les routes renvoyaient un faux succès sans
   rien écrire (d'où ton point 1 « marche en local mais rien n'est sauvé »). Maintenant tout est
   réel — **mais du coup `npm run dev` en local écrit dans la vraie base Supabase** (il n'y a qu'un
   seul projet). À garder en tête quand tu testes. Les données de démo du Planning (visuelles,
   étiquetées) sont restées.
4. **Paiements** : webhook + secret Vercel + activation Stripe, puis on discute Canat/Lalande.
5. **Redondance Mes paiements / TM / Stripe** (ton point 4) : décision produit à prendre à deux.
6. **README** : encore un peu à jour à faire (il liste moins de migrations qu'il n'en existe).

Des questions → Louis. Et si un point ci-dessus s'avère faux à l'usage, dis-le : tout a été vérifié
à une date donnée, les choses bougent.

*Récap rédigé le 19/09/2026.*
