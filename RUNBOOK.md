# La Bâtisse — Runbook

**Pour Nicor.** Rédigé le 14 septembre 2026. Tout ce qui figure dans « Ce qui fonctionne »
a été vérifié sur le système en production à cette date — rien n'est affirmé de mémoire
ni déduit de la lecture du code.

---

## 1. Ce qu'est ce projet

Une application web privée pour la maison de famille à Chalabre (Aude). Les membres se
connectent, réservent des dates, et l'application calcule ce qu'ils doivent :

- **TS** (*taxe de séjour*) — par nuit et par personne. Le tarif dépend de la saison et de
  l'âge : été 10 €/nuit pour les 16 ans et plus, 5 € pour les moins de 16 ans accompagnés
  de leurs parents ; hiver 15 € / 10 €. L'été court du 1er avril au 30 octobre, l'hiver du
  31 octobre au 31 mars.
- **TM** (*contribution mensuelle*) — un montant fixe par membre et par mois : 40, 80 ou 120 €.

S'y ajoutent les pages planning, budget, documents, contacts et journal de la maison.

**Stack :** Next.js 16.2.2 (App Router), Supabase (Postgres + authentification), Stripe
(en mode test uniquement), Tailwind, déployé sur Vercel. L'interface est en français.

---

## 2. Où se trouvent les choses

| Quoi | Où |
|---|---|
| Code | https://github.com/LouisGolding/Chalabre |
| Site en ligne | https://www.labatisse.art (le domaine sans `www` redirige vers `www`) |
| Base de données + auth | Projet Supabase `fkkzqdthtepphxbnlgqv` (« Louisko's Project ») |
| Hébergement | Vercel, déploiement automatique depuis `main` |
| Paiements | Stripe, **mode test uniquement** |

---

## 3. Ce qui s'est passé en septembre 2026

Le projet est resté cinq mois sans être touché. Supabase met en pause les projets du plan
gratuit au bout de 7 jours sans requête, et un projet en pause voit son DNS retiré — vu de
l'extérieur, il semblait donc supprimé. Louis l'a restauré ; aucune donnée n'a été perdue.

La restauration a mis au jour plusieurs bugs bien réels, désormais corrigés :

- Le trigger d'inscription ne lisait que les champs envoyés par le formulaire **e-mail**.
  Google envoie des noms de champs différents : chaque compte Google était donc créé avec un
  **nom vide** et une **date de naissance égale au jour de l'inscription**. Comme le tarif de
  réservation se déduit de l'âge, ces membres auraient été facturés au tarif « moins de 16 ans ».
- Le même trigger attribuait le rôle `family` à toute inscription Google, alors même qu'il les
  enregistrait comme `friend` : en SQL, une comparaison avec une valeur absente renvoie
  « inconnu » et non « faux », et le test tombait donc dans la mauvaise branche.
- Deux vues de la base (`all_payments`, `user_balances`) ignoraient les règles d'accès et
  étaient lisibles **par n'importe qui sur Internet**, sans connexion : noms, groupes de
  famille et soldes de paiement. C'est corrigé.
- Une règle d'accès (RLS) n'avait pas de contrôle en écriture : n'importe quel membre pouvait
  se donner le rôle `admin` ou baisser sa propre contribution mensuelle. C'est corrigé.
- Le webhook Stripe était redirigé vers la page de connexion, et lorsqu'il s'exécutait il
  écrivait avec une clé que les règles d'accès bloquaient silencieusement. Les deux sont corrigés.
- Next.js 16 a renommé la convention de fichier `middleware` en `proxy` ; c'est fait.

---

## 4. Ce qui fonctionne

**Chaque point ci-dessous a été vérifié le 14 septembre 2026 vers 09h00 UTC.** La vérification
elle-même est indiquée à côté, pour que tu puisses la refaire.

### Base de données et règles d'accès

| Vérifié | Comment |
|---|---|
| Le projet Supabase est actif et répond | `GET /auth/v1/health` → 200 |
| La connexion Google et la connexion e-mail sont **configurées** (voir §5 — configuré ne veut pas dire testé) | `GET /auth/v1/settings` → `google: true`, `email: true`, inscriptions ouvertes, confirmation e-mail requise |
| La fuite publique est colmatée | `GET /rest/v1/user_balances` et `/all_payments` avec la seule clé publique → **401 permission denied** |
| Les tables ordinaires ne renvoient bien rien à un inconnu | Même requête sur `profiles`, `bookings`, `ts_payments`, `tm_payments`, `payment_events` → 200 avec une liste vide `[]` |
| Les quatre profils ont de vrais noms | Relecture via la clé service : Louis Golding, Nicolas Lalande, Marius Kronenwett, Roméo Wilsius |
| Louis a le rôle `admin` | Même lecture — avant ces travaux, personne ne l'avait |
| Les deux nouveaux triggers de sécurité sont installés | Requête SQL sur `pg_trigger` : `on_auth_user_created` et `profiles_protect_privileges`, tous deux `security definer` avec `search_path` figé |
| Les deux vues s'exécutent désormais avec les droits de l'appelant | Requête SQL sur `pg_class` : `security_invoker=on` sur les deux |
| Les deux réservations existantes sont facturées correctement | 3 nuits en mai = 30 €, 9 nuits en octobre = 90 €, toutes deux au tarif adulte d'été de 10 €/nuit. Elles appartiennent au seul compte qui a toujours eu une date de naissance correcte : **personne n'a donc été sous-facturé dans les faits** |

### Le site en ligne (en visiteur non connecté)

| Chemin | Résultat |
|---|---|
| `/` | 307 → `/auth/login` |
| `/auth/login`, `/auth/register`, `/auth/verify-email` | 200 |
| `/dashboard`, `/dashboard/admin`, `/auth/completer-profil` | 307 → `/auth/login` (correctement protégés) |
| `POST /api/stripe/webhook` | 400 « no signature » — autrement dit il **atteint bien son propre handler** au lieu d'être renvoyé vers la page de connexion, ce qui était le bug |

### Le code

| Vérifié | Comment |
|---|---|
| TypeScript compile sans erreur | `npx tsc --noEmit` |
| Le build de production réussit | `npm run build` |
| Tout est commité et poussé | `HEAD` local = `origin/main`, 0 fichier non commité |

### Publié sur Git

Oui — vérifié, le dépôt est à jour. Trois commits de correction sont sur `main` :

```
6ae7e21  feat(db): auth trigger, profile repair and view-security migrations
5cc3604  fix(payments): give the Stripe webhook a service-role client
4d9b95f  fix(auth): repair sign-in flow and migrate middleware to proxy
```

Vercel les a déployés — confirmé par l'existence de `/auth/completer-profil` en production,
une route qui n'existe que dans ce nouveau code.

---

## 5. Ce qui n'a PAS été testé

Cette section compte davantage que la précédente. **Personne ne s'est réellement connecté à
aucun moment pendant ces travaux** — il n'y avait aucun mot de passe à disposition. Les points
suivants sont donc écrits, compilés et déployés, mais non éprouvés de bout en bout :

- **La connexion avec Google.** Configurée, jamais menée à son terme.
- **L'inscription et la connexion par e-mail.** Idem.
- **L'écran « Compléter mon profil ».** La page existe et redirige correctement un visiteur non
  connecté, mais le formulaire n'a jamais été soumis : le chemin d'enregistrement est non testé.
- **L'affichage des pages du tableau de bord avec une vraie session** — planning, budget,
  documents, contacts, admin. Aucune n'a jamais été vue avec des données dedans.
- **La création d'une réservation depuis l'interface.**
- **Tout paiement Stripe.** Le secret du webhook est encore un placeholder (voir §7) : aucun
  événement Stripe n'a jamais été vérifié par l'application.
- **Le garde-fou des privilèges, en conditions réelles.** Sa présence a été confirmée en
  interrogeant la base, et sa logique a été relue — mais prouver qu'il empêche effectivement un
  membre de se promouvoir demanderait une session connectée.

Si tu ne retiens qu'une chose de ce document : **la première tâche est de te connecter et de
parcourir l'application.** C'est le moyen le moins coûteux de faire basculer l'essentiel de
cette section dans la précédente.

---

## 6. Ce qui existe mais est vide

Ce ne sont pas des bugs : les données n'ont simplement jamais été saisies. Relevé le 14 septembre :

| Table | Lignes |
|---|---|
| `profiles` | 4 |
| `bookings` | 2 |
| `ts_payments` | 2 |
| `rooms` | **0** |
| `events`, `tasks`, `contacts`, `documents`, `budget_entries`, `house_log`, `booking_guests`, `tm_payments`, `payment_events` | **0** |

Conséquences à connaître :

- **Aucune chambre** : la liste déroulante des chambres du formulaire de réservation est vide.
  Les réservations s'enregistrent quand même (la chambre est facultative), mais personne ne peut
  indiquer où il a dormi.
- **Aucun `tm_tier` défini** : aucune contribution mensuelle ne peut être appelée auprès de qui
  que ce soit.
- Il n'existe **aucun écran d'administration** pour ajouter des chambres ou fixer les paliers de
  contribution. Les deux se font aujourd'hui en SQL. Construire ces écrans est une bonne première
  tâche.

---

## 7. Problèmes connus et aspérités

- **`STRIPE_WEBHOOK_SECRET` est littéralement un placeholder** (`whsec_placeholder…`). Tant qu'un
  vrai endpoint n'est pas créé côté Stripe et sa clé de signature recopiée, aucun paiement ne sera
  enregistré. Tout est en clés de test : aucun argent réel n'a jamais transité.
- **Trois membres ont encore une date de naissance provisoire** au `1900-01-01`. C'est
  volontaire, ce n'est pas un résidu : cette date est lue comme celle d'un adulte, donc le tarif
  de réservation est correct, et c'est elle qui fait passer chacun une fois par « Compléter mon
  profil » pour saisir la vraie date. Cela se résorbe à mesure que chacun se connecte.
- **Louis est enregistré avec `family_group = friend`**, ce qui est probablement faux. Cela se
  corrigera quand il complétera son profil.
- **12 erreurs ESLint**, aucune bloquante — `npm run build` passe. L'une d'elles est un vrai bug :
  `src/components/layout/Sidebar.tsx` définit un composant à l'intérieur de sa propre fonction de
  rendu, ce qui remonte toute la navigation à chaque rendu.
- **Une branche morte**, `docs/readme-fr`, subsiste sur le dépôt distant et est entièrement
  fusionnée dans `main`. Elle peut être supprimée sans risque.
- **Le README est périmé** — il mentionne deux fichiers SQL là où il y en a désormais cinq, et il
  est antérieur au renommage `middleware` → `proxy`.

---

## 8. Lancer le projet en local

```bash
npm install
npm run dev      # http://localhost:3000
```

Il te faut un fichier `.env.local` à la racine du projet. **Il n'est pas dans le dépôt et ne
doit jamais y être commité.** Demande les valeurs à Louis, ou lis-les toi-même depuis le
tableau de bord Supabase :

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Deux de ces clés sont sensibles, mais pas de la même manière. La clé **anon / publishable** est
conçue pour être publique — elle est déjà visible dans le JavaScript du site. La clé **service
role** contourne toutes les règles d'accès de la base : traite-la comme un mot de passe et ne la
mets jamais dans du code côté navigateur.

---

## 9. Les migrations de base de données

Les fichiers sont dans `supabase/`. **Les cinq sont déjà appliqués à la base en production.**

| Fichier | État |
|---|---|
| `schema.sql` | Appliqué. **À ne jamais relancer** |
| `migration_payment_tracking.sql` | Appliqué. **À ne jamais relancer** |
| `migration_view_security.sql` | Appliqué |
| `migration_auth_fix.sql` | Appliqué |
| `migration_profile_repair.sql` | Appliqué |

> **Pourquoi « jamais » pour les deux premiers :** leurs instructions `create table` et
> `create policy` n'ont pas de garde « si ça n'existe pas déjà ». Les relancer échoue donc en
> cours de route et te laisse sans savoir quelle moitié a été appliquée. Les trois autres sont
> écrits pour pouvoir être rejoués sans risque.

Pour toute modification du schéma, écris un **nouveau** fichier plutôt que de modifier un
existant, et exécute-le dans l'éditeur SQL de Supabase (Project → SQL Editor → New query).

---

## 10. Les pièges

1. **Le projet se met en pause après 7 jours d'inactivité.** C'est ce qui a mis le site hors
   ligne pendant cinq mois. Soit il passe sur une formule payante, soit quelqu'un ouvre
   l'application au moins une fois par mois. C'est le principal risque qui pèse sur le projet.
2. **Les variables d'environnement Vercel ne prennent effet qu'après un redéploiement.** Tout ce
   qui commence par `NEXT_PUBLIC_` est figé dans le JavaScript au moment du build. Change une
   valeur, et le site en ligne continue d'utiliser l'ancienne tant qu'un nouveau build n'a pas
   tourné.
3. **Utilise `www.labatisse.art`, pas le domaine nu**, partout où une URL doit être déclarée
   (liste de redirections Supabase, webhook Stripe, OAuth Google). Le domaine nu fait une
   redirection 307, et cela casse les retours de connexion.
4. **Ce n'est pas le Next.js que tu connais peut-être.** La version 16 a renommé `middleware.ts`
   en `proxy.ts` et rendu plusieurs API de requête asynchrones. Le fichier `AGENTS.md` du dépôt
   dit la même chose, et la vraie documentation est embarquée dans
   `node_modules/next/dist/docs/` — lis celle-là plutôt que de te fier à des connaissances plus
   anciennes.

---

## 11. Bonnes premières tâches

De la plus simple à la plus ambitieuse :

1. **Se connecter et parcourir toute l'application.** Faire basculer la §5 dans la §4. Noter tout
   ce qui casse.
2. **Ajouter les chambres** (aujourd'hui uniquement en SQL — voir §6).
3. **Un écran d'administration pour les chambres**, pour que plus personne n'ait à toucher au SQL.
4. **Un écran d'administration pour les paliers de contribution**, même raisonnement.
5. **Corriger les 12 erreurs ESLint**, en commençant par celle de `Sidebar.tsx`, qui est un vrai bug.
6. **Mettre le README à jour** pour qu'il corresponde à la §9.

---

## 12. Travailler sur ce projet avec Claude Code

On l'utilise tous les deux, donc quelques remarques qui te feront gagner du temps :

- Le dépôt contient un `AGENTS.md` que Claude Code lit automatiquement. Il prévient que cette
  version de Next.js diffère de ce dont le modèle peut se souvenir, et renvoie vers la
  documentation embarquée. Fais-y confiance plutôt qu'à ce qu'il t'affirmerait de mémoire
  au sujet de Next.js.
- **Demande-lui de vérifier, pas seulement d'affirmer.** La distinction entre les §4 et §5 de ce
  document est exactement celle-là. « Ça compile » et « ça marche » sont deux affirmations
  différentes : un build qui passe ne dit rien de la capacité d'un utilisateur à se connecter.
- Claude Code peut lire la base en production via l'API REST de Supabase si tu lui donnes les
  clés de `.env.local` — c'est très pratique pour vérifier l'état réel. En revanche il **ne peut
  pas** exécuter de modification de schéma par ce biais : cela passe par l'éditeur SQL dans le
  navigateur.
- Quand il propose une modification de base de données, demande-lui ce qui se passe si le fichier
  est exécuté deux fois. C'est toute la différence entre les trois migrations rejouables et les
  deux à ne jamais relancer.

---

*Pour toute question sur ce qui précède, vois avec Louis. Si un point de la §4 s'avère faux,
dis-le — il a été vérifié une fois, à une date donnée, et les choses bougent.*
