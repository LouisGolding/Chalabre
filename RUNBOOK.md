# La Bâtisse — Runbook

**For Nicor.** Written 14 September 2026. Everything in "What works" below was checked
against the live system on that date — nothing is claimed from memory or from reading code.

---

## 1. What this project is

A private web app for the family house at Chalabre (Aude). Members sign in, book dates,
and the app works out what they owe:

- **TS** (*taxe de séjour*) — per night, per guest. Rate depends on season and age:
  summer 10 €/night for 16+, 5 € for under-16s with parents; winter 15 € / 10 €.
  Summer runs 1 April – 30 October; winter 31 October – 31 March.
- **TM** (*contribution mensuelle*) — a fixed monthly amount per member: 40, 80 or 120 €.

There are also pages for the planning calendar, budget, documents, contacts and a house log.

**Stack:** Next.js 16.2.2 (App Router), Supabase (Postgres + auth), Stripe (test mode only),
Tailwind, deployed on Vercel. The UI is in French.

---

## 2. Where things live

| What | Where |
|---|---|
| Code | https://github.com/LouisGolding/Chalabre |
| Live site | https://www.labatisse.art (the bare domain redirects to `www`) |
| Database + auth | Supabase project `fkkzqdthtepphxbnlgqv` ("Louisko's Project") |
| Hosting | Vercel, deploys automatically from `main` |
| Payments | Stripe, **test mode only** |

---

## 3. What happened in September 2026

The project sat untouched for about five months. Supabase pauses free-tier projects after
7 days without a request, and a paused project has its DNS withdrawn — so from the outside
it looked deleted. Louis restored it; no data was lost.

Restoring it revealed a set of real bugs, which have now been fixed:

- The signup trigger only read the fields the **email** signup form sends. Google sends
  different field names, so every Google account was created with **blank names** and a
  **birth date equal to the signup date**. Since the booking rate is derived from age, those
  members would have been charged the under-16 rate.
- The same trigger gave every Google signup the `family` role even when it had recorded them
  as `friend`, because a SQL comparison against a missing value returns "unknown" rather than
  "false" and fell through to the wrong branch.
- Two database views (`all_payments`, `user_balances`) ignored the access rules and were
  readable **by anyone on the internet**, with no login — names, family groups and payment
  balances. This is fixed.
- A row-level security policy had no write-check, so any member could have set their own
  `role` to `admin` or lowered their own monthly contribution tier. This is fixed.
- The Stripe webhook was being redirected to the login page, and when it did run it wrote
  with a key that the access rules silently blocked. Both fixed.
- Next.js 16 renamed the `middleware` file convention to `proxy`; done.

---

## 4. What works

**Every item here was checked on 14 September 2026 at ~09:00 UTC.** The check itself is
written next to each one so you can repeat it.

### Database and access rules

| Verified | How it was checked |
|---|---|
| The Supabase project is live and answering | `GET /auth/v1/health` → 200 |
| Google sign-in and email sign-in are **configured** (see §5 — configured is not the same as tested) | `GET /auth/v1/settings` → `google: true`, `email: true`, signups open, email confirmation required |
| The public "leak" is closed | `GET /rest/v1/user_balances` and `/all_payments` with only the public key → **401 permission denied** |
| Ordinary tables correctly return nothing to a stranger | Same request against `profiles`, `bookings`, `ts_payments`, `tm_payments`, `payment_events` → 200 with an empty list `[]` |
| All four member profiles have real names | Read back via the service key: Louis Golding, Nicolas Lalande, Marius Kronenwett, Roméo Wilsius |
| Louis holds the `admin` role | Same read — before this work, nobody did |
| The two new safety triggers are installed | SQL query against `pg_trigger`: `on_auth_user_created` and `profiles_protect_privileges`, both `security definer` with `search_path` pinned |
| Both views now run as the caller | SQL query against `pg_class`: `security_invoker=on` on both |
| The two existing bookings are billed correctly | 3 nights in May = 30 €, 9 nights in October = 90 €, both at the adult summer rate of 10 €/night. Both belong to the one account that always had a correct birth date, so **no one was ever undercharged in practice** |

### The live site (as a logged-out visitor)

| Path | Result |
|---|---|
| `/` | 307 → `/auth/login` |
| `/auth/login`, `/auth/register`, `/auth/verify-email` | 200 |
| `/dashboard`, `/dashboard/admin`, `/auth/completer-profil` | 307 → `/auth/login` (correctly protected) |
| `POST /api/stripe/webhook` | 400 "no signature" — i.e. it **reaches its own handler** instead of being bounced to the login page, which was the bug |

### The code

| Verified | How |
|---|---|
| TypeScript compiles with no errors | `npx tsc --noEmit` |
| Production build succeeds | `npm run build` |
| Everything is committed and pushed | local `HEAD` = `origin/main` = `6ae7e21`, 0 uncommitted files |

### Pushed to GitHub

Yes — confirmed in sync. Three commits are on `main`:

```
6ae7e21  feat(db): auth trigger, profile repair and view-security migrations
5cc3604  fix(payments): give the Stripe webhook a service-role client
4d9b95f  fix(auth): repair sign-in flow and migrate middleware to proxy
```

Vercel has deployed them — confirmed by `/auth/completer-profil` existing in production,
which is a route that only exists in this new code.

---

## 5. What has NOT been tested

This section matters more than the last one. **Nobody has actually signed in at any point
during this work** — there was no password to use. So the following are written, built and
deployed, but unproven end to end:

- **Signing in with Google.** Configured, never completed.
- **Signing up or signing in with email.** Same.
- **The "Compléter mon profil" screen.** The page exists and correctly redirects a
  logged-out visitor, but the form has never been submitted, so the save path is untested.
- **Any dashboard page rendering with a real session** — planning, budget, documents,
  contacts, admin. None has ever been seen with data in it.
- **Making a booking through the UI.**
- **Any Stripe payment.** The webhook secret is still a placeholder (see §7), so no Stripe
  event has ever been verified by this app.
- **The privilege guard, behaviourally.** It was confirmed *installed* by querying the
  database, and the logic was reviewed — but proving it actually blocks a member from
  promoting themselves would need a signed-in session.

If you take one thing from this document: **the first job is to sign in and walk through the
app.** That is the cheapest way to turn most of this section into the previous one.

---

## 6. What exists but is empty

Not bugs — nobody ever entered the data. Checked 14 September:

| Table | Rows |
|---|---|
| `profiles` | 4 |
| `bookings` | 2 |
| `ts_payments` | 2 |
| `rooms` | **0** |
| `events`, `tasks`, `contacts`, `documents`, `budget_entries`, `house_log`, `booking_guests`, `tm_payments`, `payment_events` | **0** |

Consequences worth knowing:

- **No rooms** means the room dropdown on the booking form is empty. Bookings still save
  (the room is optional), but nobody can record where they slept.
- **No `tm_tier` on any member** means no monthly contribution can be raised against anyone.
- There is **no admin screen** for adding rooms or setting contribution tiers. Both have to
  be done in SQL today. Building those screens is a good first task.

---

## 7. Known issues and rough edges

- **`STRIPE_WEBHOOK_SECRET` is literally a placeholder** (`whsec_placeholder…`). Until a real
  endpoint is created in Stripe and the signing secret copied in, payments will never be
  recorded. Everything is on test keys, so no real money has ever moved.
- **Three members still have a placeholder birth date** of `1900-01-01`. This is deliberate,
  not a leftover: it reads as an adult, so the booking rate is correct, and it is what makes
  the app route each of them once through "Compléter mon profil" to enter the real date.
  It clears itself as each person signs in.
- **Louis is recorded as `family_group = friend`**, which is probably wrong. It corrects
  itself when he completes his profile.
- **12 ESLint errors**, none of them fatal — `npm run build` passes. One is a real bug:
  `src/components/layout/Sidebar.tsx` defines a component inside its own render function,
  which remounts the whole navigation on every render.
- **A stale branch**, `docs/readme-fr`, exists on the remote and is fully merged into `main`.
  Safe to delete.
- **The README is out of date** — it lists two SQL files where there are now five, and
  predates the `middleware` → `proxy` rename.

---

## 8. Running it locally

```bash
npm install
npm run dev      # http://localhost:3000
```

You need a `.env.local` file in the project root. **It is not in the repo and must never be
committed.** Ask Louis for the values, or read them from the Supabase dashboard yourself:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Two of those are sensitive in different ways. The **anon / publishable** key is designed to
be public — it is already visible in the site's JavaScript. The **service role** key bypasses
every access rule in the database; treat it like a password and never put it in client code.

---

## 9. The database migrations

Files live in `supabase/`. **All five are already applied to the live database.**

| File | Status |
|---|---|
| `schema.sql` | Applied. **Never run again** |
| `migration_payment_tracking.sql` | Applied. **Never run again** |
| `migration_view_security.sql` | Applied |
| `migration_auth_fix.sql` | Applied |
| `migration_profile_repair.sql` | Applied |

> **Why "never again" for the first two:** their `create table` and `create policy` statements
> have no "if it doesn't already exist" guard, so re-running them fails partway through and
> leaves you unsure which half took effect. The other three are written to be safely re-runnable.

If you need a schema change, write a **new** file rather than editing an existing one, and run
it in the Supabase SQL editor (Project → SQL Editor → New query).

---

## 10. Things that will bite you

1. **The project pauses after 7 days of inactivity.** This is what took the site down for five
   months. Either it goes on a paid plan, or somebody opens the app at least monthly. This is
   the single biggest risk to the project.
2. **Environment variables on Vercel do not take effect until you redeploy.** Anything starting
   `NEXT_PUBLIC_` is baked into the JavaScript at build time. Change a value, and the live site
   keeps using the old one until a new build runs.
3. **Use `www.labatisse.art`, not the bare domain**, anywhere a URL has to be registered
   (Supabase redirect list, Stripe webhook, Google OAuth). The bare domain 307-redirects, and
   that breaks sign-in returns.
4. **This is not the Next.js you may know.** Version 16 renamed `middleware.ts` to `proxy.ts`
   and made several request APIs async. `AGENTS.md` in the repo says the same thing, and the
   real documentation is bundled at `node_modules/next/dist/docs/` — read that rather than
   relying on older knowledge.

---

## 11. Good first tasks

Roughly easiest first:

1. **Sign in and walk the whole app.** Turn §5 into §4. Write down anything that breaks.
2. **Add the rooms** (currently SQL-only — see §6).
3. **An admin screen for rooms**, so nobody has to touch SQL for this again.
4. **An admin screen for contribution tiers**, same reasoning.
5. **Fix the 12 ESLint errors**, starting with the `Sidebar.tsx` one, which is a real bug.
6. **Refresh the README** so it matches §9.

---

## 12. Working on this with Claude Code

Both of us are using it, so a few notes that will save you time:

- The repo has an `AGENTS.md` that Claude Code reads automatically. It warns that this version
  of Next.js differs from what the model may remember, and points at the bundled docs. Trust
  that over anything it tells you from memory about Next.js.
- **Ask it to verify, not just to assert.** The distinction between §4 and §5 in this document
  is exactly that. "It builds" and "it works" are different claims; a passing build says
  nothing about whether a user can log in.
- Claude Code can read the live database through the Supabase REST API if you give it the keys
  from `.env.local`, which makes checking real state easy. It **cannot** run schema changes that
  way — those go through the SQL editor in the browser.
- When it proposes a database change, ask what happens if the file is run twice. That is the
  difference between the three safe migrations and the two that must never be re-run.

---

*Questions about anything above go to Louis. If something in §4 turns out not to be true,
say so — it was checked once, on one date, and the world moves.*
