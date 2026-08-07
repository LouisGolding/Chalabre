# 🏠 La Bâtisse

Site web et application de gestion de la maison familiale **La Bâtisse**, à Chalabre (Aude).

🌐 **En ligne : [www.labatisse.art](https://www.labatisse.art)**

---

## 1. Contexte

La Bâtisse est une maison familiale située dans un petit village du sud de la France. La famille étant très nombreuse, beaucoup de personnes y séjournent tout au long de l'année, avec des allers-retours fréquents. La maison accueille aussi ponctuellement des amis de la famille.

Jusqu'ici, l'organisation reposait sur des fichiers Excel dans lesquels chacun indiquait ses dates de venue. Ce projet remplace ces fichiers par un outil unique.

Le fonctionnement financier de la maison repose sur deux types de contributions :

| Type | Qui | Fréquence | Détail |
|------|-----|-----------|--------|
| **TM** — Taxe Mensuelle (cotisation) | Famille uniquement | Mensuelle | Plusieurs paliers selon les situations |
| **TS** — Taxe de Séjour | Toute personne séjournant (famille **et** amis) | À la nuitée | Tarif variable selon la saison et l'âge |

### Barème des TS

| Saison | ≥ 16 ans | < 16 ans avec parents | < 16 ans sans parents |
|--------|----------|----------------------|----------------------|
| Été    | 10 € / nuit | 5 € / nuit  | 10 € / nuit |
| Hiver  | 15 € / nuit | 10 € / nuit | 15 € / nuit |

> Implémenté dans [`src/lib/utils.ts`](src/lib/utils.ts) (`calculateTSRate`, `calculateTotalTS`).
> Les bornes de saison actuellement codées sont : **été = 1er avril → 30 octobre**, **hiver = 31 octobre → 31 mars**. → *à confirmer (voir §8)*.

### Procédure de virement (hors Stripe)

Libellé attendu : `TS NOM PRÉNOM` ou `TM NOM PRÉNOM`.
**Règle : un virement par personne concernée.** Si Guilhem paie pour Emma, Guilhem et Oscar → 3 virements distincts avec 3 libellés distincts.

---

## 2. Objet du projet

Un site web avec compte personnel permettant de :

- organiser les séjours
- centraliser les informations de la maison
- suivre les contributions financières (TM / TS)
- gérer les documents administratifs
- faciliter la vie collective autour de la maison

À terme, le système pourra également servir à gérer la **comptabilité générale** de La Bâtisse, en lien direct avec le compte bancaire de la maison.

---

## 3. Stack technique

| Domaine | Choix | Statut |
|---------|-------|--------|
| Framework | **Next.js 16.2.2** (App Router, React 19) | ✅ |
| Base de données | **Supabase** (PostgreSQL + RLS) | ✅ |
| Authentification | **Supabase Auth** (email/mot de passe + Google OAuth) | ✅ ⚠️ *le cahier des charges mentionnait Firebase — voir §8* |
| Paiements | **Stripe Checkout** + webhook | ✅ |
| UI | Tailwind CSS v4, shadcn/ui, Base UI, lucide-react | ✅ |
| Dates | date-fns (locale `fr`) | ✅ |
| Hébergement | **Vercel** | ✅ déployé |
| Nom de domaine | **labatisse.art** (`labatisse.art` → `www.labatisse.art`) | ✅ actif |

---

## 4. État d'avancement

### ✅ Fait

**Authentification et comptes**
- Inscription avec nom, prénom, date de naissance et groupe (Famille Lalande / Famille Canat / Ami de la famille) — [`auth/register`](src/app/auth/register/page.tsx)
- Connexion e-mail + mot de passe, et connexion Google — [`auth/login`](src/app/auth/login/page.tsx)
- Vérification e-mail et callback OAuth — [`auth/verify-email`](src/app/auth/verify-email/page.tsx), [`auth/callback`](src/app/auth/callback/route.ts)
- Création automatique du profil à l'inscription (trigger PostgreSQL `handle_new_user`)
- Protection des routes par middleware et rafraîchissement de session — [`src/middleware.ts`](src/middleware.ts)
- Trois rôles : `admin`, `family`, `friend`, avec navigation filtrée par rôle

**Base de données** — [`supabase/schema.sql`](supabase/schema.sql)
- 12 tables : `profiles`, `rooms`, `bookings`, `booking_guests`, `ts_payments`, `tm_payments`, `events`, `tasks`, `contacts`, `documents`, `house_log`, `budget_entries`
- Row Level Security activée sur toutes les tables, avec politiques par rôle
- Migration de suivi des paiements — [`supabase/migration_payment_tracking.sql`](supabase/migration_payment_tracking.sql) : table d'audit `payment_events`, vues `all_payments` et `user_balances`

**Réservation et planning**
- Formulaire de réservation avec dates, chambre optionnelle, notes, et **calcul automatique de la TS** affiché en direct — [`BookingForm`](src/components/booking/BookingForm.tsx)
- Création automatique d'une ligne `ts_payments` en attente à chaque réservation
- Planning mensuel en calendrier, avec code couleur par famille et affichage des événements — [`PlanningView`](src/components/planning/PlanningView.tsx)

**Paiements**
- Page « Mes paiements » : TS et TM, en attente et payées, avec solde dû — [`mes-paiements`](src/app/dashboard/mes-paiements/page.tsx)
- Paiement par carte via Stripe Checkout — [`PayButton`](src/components/payment/PayButton.tsx), [`api/stripe/checkout`](src/app/api/stripe/checkout/route.ts)
- Webhook Stripe : encaissement, échec de paiement, moyen de paiement, journal d'audit — [`api/stripe/webhook`](src/app/api/stripe/webhook/route.ts)
- Pages de retour succès / annulation

**Tableau de bord et pages**
- Accueil : message de bienvenue, dernier séjour, prochain séjour, personnes présentes en ce moment, solde TS, TM du mois — [`dashboard`](src/app/dashboard/page.tsx)
- Budget : solde disponible, total encaissé TM + TS, total dépenses, derniers mouvements — [`budget`](src/app/dashboard/budget/page.tsx)
- Guide de la maison (structure en place, **contenu à remplir**) — [`guide`](src/app/dashboard/guide/page.tsx)
- Contacts (lecture seule) — [`contacts`](src/app/dashboard/contacts/page.tsx)
- Documents (lecture seule, téléchargement) — [`documents`](src/app/dashboard/documents/page.tsx)
- Administration : liste des utilisateurs — [`admin`](src/app/dashboard/admin/page.tsx)
- Suivi des paiements admin : tous les paiements, soldes par personne, journal d'audit Stripe — [`admin/paiements`](src/app/dashboard/admin/paiements/page.tsx)

### 🟡 Partiellement fait

| Sujet | Ce qui manque |
|-------|---------------|
| **Réservation** | Impossible d'ajouter les **amis / accompagnants** au séjour depuis l'interface (la table `booking_guests` existe mais n'est pas alimentée) |
| **Calcul TS** | Ne facture que le titulaire du compte. Le critère « < 16 ans sans parents » est codé mais jamais renseigné (`withParents` est forcé à `true`). L'âge est calculé à la date de la réservation, pas à la date du séjour |
| **Réservation** | Horaire et gare d'arrivée saisis en texte libre dans le champ « Notes », pas de champ dédié ni d'affichage sur le planning |
| **Planning** | Vue mensuelle uniquement — pas de vue annuelle, pas de navigation par année. Les passages femme de ménage / jardinier et les événements ne peuvent pas être créés depuis l'interface |
| **Budget** | Calcule uniquement (TM + TS encaissées) − dépenses. Manquent : solde réel du compte bancaire, lissage des frais sur l'année, budget travaux restant, budget annuel détaillé |
| **Guide** | Contenu en dur dans le code, non modifiable par l'administrateur, la plupart des sections sont des « à compléter » |
| **Contacts / Documents** | Lecture seule : aucune interface d'ajout ou de modification pour l'administrateur |
| **Administration** | Liste des utilisateurs seulement — pas de modification de rôle, de palier TM, ni de validation des inscriptions |

### ⬜ Reste à faire

**Fonctionnel**
- [ ] Mode **« Continuer en tant qu'invité »** (interface restreinte, sans compte)
- [ ] Saisie du **RIB** à l'inscription et dans le profil (la colonne existe déjà en base)
- [ ] **Génération automatique des TM mensuelles** — aucune ligne `tm_payments` n'est créée aujourd'hui, il faut les insérer à la main dans Supabase
- [ ] Attribution du **palier de cotisation** (`tm_tier`) par l'administrateur
- [ ] **Journal de la maison** sur l'accueil : qui est présent, travaux en cours, travaux à venir, événements (table `house_log` créée mais inutilisée)
- [ ] **Task list d'entretien** éditable par l'administrateur (table `tasks` créée mais inutilisée)
- [ ] **Carrousel de photos** sur la page d'accueil
- [ ] **Upload de documents** (bucket Supabase Storage à configurer) : titres de propriété, actes notariés, cadastre, estimation immobilière, contrats d'assurance et extincteurs, factures, plans d'architecte
- [ ] **Plans de la maison** : chambres, extincteurs, arrivées gaz et eau, tableaux électriques, zoning des placards
- [ ] **Groupes de cuisine** : organisation des repas et gestion des équipes
- [ ] **Chat Chalabre** par semaine / séjour, avec création automatique des sessions (remplacerait les groupes WhatsApp)
- [ ] **Événements** : création depuis l'interface (fête de famille, Chalabre en Sérénades, mariage, semaine entre amis)
- [ ] **Rapprochement bancaire** : lier le compte de la maison, reconnaître les virements au libellé `TS/TM NOM PRÉNOM`, comptabilité générale
- [ ] Notifications / rappels (TM en retard, séjour à venir)

**Technique**
- [ ] Vérifier la configuration de production : webhook Stripe (`STRIPE_WEBHOOK_SECRET` de prod), clés Stripe en mode live et non test, `NEXT_PUBLIC_APP_URL` sur `https://www.labatisse.art`, URL de redirection Google OAuth autorisée dans Supabase
- [ ] Peuplement initial : liste des **chambres**, des **contacts**, contenu du **guide**
- [ ] **Durcir la sécurité** (voir §7) : le montant de la TS est aujourd'hui calculé et inséré côté client
- [ ] Tests et intégration continue
- [ ] Version mobile / PWA

---

## 5. Installation

### Prérequis
Node.js 20+, un projet Supabase, un compte Stripe.

### Étapes

```bash
npm install
```

Créer un fichier `.env.local` à la racine :

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> ⚠️ Ne jamais committer ces fichiers — ils sont déjà exclus par `.gitignore`.

Appliquer le schéma dans Supabase (SQL Editor), dans cet ordre :

1. `supabase/schema.sql`
2. `supabase/migration_payment_tracking.sql`

Puis lancer :

```bash
npm run dev     # développement, http://localhost:3000
npm run build   # build de production
npm run lint    # ESLint
```

### Webhook Stripe en local

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Reporter le `whsec_...` affiché dans `STRIPE_WEBHOOK_SECRET`.

### Créer un administrateur

Après inscription, passer le rôle à `admin` dans Supabase :

```sql
update public.profiles set role = 'admin' where email = 'votre@email.com';
```

---

## 6. Structure du projet

```
src/
├── app/
│   ├── auth/                 # login, register, verify-email, callback OAuth
│   ├── api/stripe/           # checkout (création de session) + webhook
│   └── dashboard/
│       ├── page.tsx          # accueil
│       ├── planning/         # calendrier des séjours
│       ├── reserver/         # formulaire de réservation
│       ├── budget/           # budget de la maison
│       ├── mes-paiements/    # TS et TM personnelles + paiement Stripe
│       ├── guide/            # guide de la maison
│       ├── contacts/         # contacts utiles
│       ├── documents/        # documents administratifs
│       ├── paiement/         # retours Stripe (succès / annulé)
│       └── admin/            # utilisateurs + suivi des paiements
├── components/
│   ├── booking/              # BookingForm
│   ├── planning/             # PlanningView
│   ├── payment/              # PayButton
│   ├── layout/               # Sidebar
│   └── ui/                   # shadcn/ui
├── lib/
│   ├── supabase/             # clients navigateur, serveur, middleware
│   ├── stripe.ts
│   └── utils.ts              # calcul TS, saisons, formatage € et dates
└── types/                    # types TypeScript du domaine
supabase/                     # schéma SQL et migrations
```

---

## 7. Droits d'accès

| | Famille Lalande / Canat | Ami de la famille | Admin |
|---|---|---|---|
| Accueil, Planning, Réserver | ✅ | ✅ | ✅ |
| Mes paiements | ✅ | ✅ (TS uniquement) | ✅ |
| Guide, Contacts | ✅ | ✅ | ✅ |
| Budget | ✅ | ❌ | ✅ |
| Documents | ✅ | ❌ | ✅ |
| Administration | ❌ | ❌ | ✅ |

### Points de sécurité à corriger avant la mise en production

1. **Montant de la TS calculé côté client** — la politique RLS `ts_insert` accepte n'importe quelle valeur (`with check (true)`). Un utilisateur pourrait créer un paiement à 0 €. Le calcul doit passer côté serveur (Server Action ou fonction PostgreSQL).
2. **`booking_guests` en accès totalement ouvert** — toutes les politiques sont à `true`, n'importe quel utilisateur connecté peut modifier ou supprimer les accompagnants d'un autre séjour.
3. Pas de **contrôle de chevauchement** sur les chambres : deux séjours peuvent réserver la même chambre aux mêmes dates.

---

## 8. Points à clarifier

Ces éléments ont été codés avec des valeurs provisoires ou sont restés en suspens. Merci de confirmer :

1. **Paliers de cotisation TM** — le code retient aujourd'hui **40 € / 80 € / 120 €** par mois. Quels sont les vrais paliers, et à quelles situations correspondent-ils ?
2. **Bornes des saisons** — actuellement été = 1ᵉʳ avril → 30 octobre, hiver = 31 octobre → 31 mars. Est-ce la bonne définition ?
3. **Âge retenu pour la TS** — l'âge à la date du séjour, ou l'âge à la date de la réservation ? (aujourd'hui : à la réservation)
4. **Stripe ou virement ?** Le cahier des charges décrit des virements bancaires avec libellé `TS NOM PRÉNOM`, mais l'application encaisse par carte via Stripe. Les deux doivent-ils coexister — et si oui, comment enregistre-t-on un virement reçu hors application ?
5. **Auth : Firebase ou Supabase ?** Le cahier des charges indiquait Firebase, l'application utilise Supabase Auth (email + Google), déjà intégré à la base et aux règles RLS. Confirmez-vous ce choix ?
6. **Liste des chambres** — noms, capacités, rattachement Lalande / Canat, pour peupler la table `rooms`.
7. **Contenu du guide** — emplacements des extincteurs, arrivées gaz et eau, tableaux électriques, rangement des draps, zoning des placards, procédures d'arrivée et de départ.
8. **Liste des contacts** — femme de ménage, jardinier, électricien, plombier, artisans, marchés.
9. **Périmètre exact du mode invité** et de l'accès « Ami de la famille » : que peuvent-ils voir précisément ?
10. **Validation des inscriptions** — n'importe qui peut aujourd'hui créer un compte en cochant « Famille Lalande ». Faut-il une validation par un administrateur ?
11. **Compte bancaire** — quelle banque, et l'accès à un agrégateur est-il envisageable pour le rapprochement automatique ?
12. **Ouverture aux utilisateurs** — le site est en ligne sur [www.labatisse.art](https://www.labatisse.art). A-t-il déjà été communiqué à la famille ? Les points de sécurité du §7 devraient être corrigés avant une ouverture large.

---

## 9. Note pour les développeurs

Ce projet utilise **Next.js 16**, dont les API et conventions diffèrent des versions précédentes. Consulter `node_modules/next/dist/docs/` avant d'écrire du code (voir [AGENTS.md](AGENTS.md)).
