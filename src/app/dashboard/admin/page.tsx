import { PageTitle } from '@/components/layout/PageTitle'
import { occupantDisplayName, properCase } from '@/lib/utils'
import { canAccessMembresTab } from '@/lib/members-access'
import { getCurrentUserAndProfile } from '@/lib/auth/current-user'
import { redirect } from 'next/navigation'
import { MembersTable, MemberRow } from '@/components/admin/MembersTable'
import { StaysHistory, StayRow } from '@/components/admin/StaysHistory'
import { IncidentsHistory, IncidentRow } from '@/components/admin/IncidentsHistory'
import { TutorialViewsHistory, TutorialViewRow } from '@/components/admin/TutorialViewsHistory'

// Forme d'un paiement TS imbriqué dans une ligne `bookings` (voir la
// requête bookingsRaw plus bas) -- pas de typage Supabase genere dans ce
// projet, donc type explicite plutot qu'un `any`.
type NestedTsPayment = {
  amount: number
  status: string
  paid_at: string | null
  stripe_payment_intent_id: string | null
}

type BookingRow = {
  id: string
  user_id: string
  check_in: string
  check_out: string
  guest_name: string | null
  profiles: { first_name: string; last_name: string; family_group: string } | null
  ts_payments: NestedTsPayment[]
}

// Priorité d'affichage du statut agrégé d'un séjour quand il a plusieurs
// ts_payments (ex. un paiement déjà réglé + un second "en attente" pour
// le solde restant après modification des dates, voir le commentaire en
// tête de api/bookings/quick/route.ts) : le cas le moins favorable
// l'emporte, pour que "Statut" alerte toujours sur ce qu'il reste à
// régler plutôt que de masquer un solde derrière un premier paiement
// payé.
const STATUS_PRIORITY: StayRow['status'][] = ['overdue', 'pending', 'paid']

function aggregateStatus(payments: NestedTsPayment[]): StayRow['status'] {
  if (payments.length === 0) return 'none'
  for (const status of STATUS_PRIORITY) {
    if (payments.some((p) => p.status === status)) return status
  }
  return 'paid'
}

// Onglet "Membres" — réservé aux admins (accès via le bandeau du bas, pas
// le bandeau du haut). Liste tous les comptes créés sur le site, avec un
// bouton pour donner ou retirer l'accès admin à quelqu'un d'autre.
//
// Refonte du 29/09/2026, demandée par Nicolas :
// - Titre remonté au même style que les autres onglets (centré, majuscules,
//   regular, gris foncé — voir la classe reprise de guide/taches/contacts).
// - Trois tableaux distincts, un par catégorie (CANAT / LALANDE / INVITÉS,
//   voir groups plus bas), classés par défaut par ordre alphabétique (Nom).
// - Section "Cotisation mensuelle" retirée (elle vivra ailleurs plus tard).
//   Le composant EditableTmTier n'est donc plus utilisé ici mais n'a pas
//   été supprimé du repo, comme convenu pour CotisationPill précédemment —
//   il reste disponible si cette fonctionnalité revient sous une autre
//   forme.
//
// Fusion du 07/10/2026, demandée par Nicolas :
// - Chacun des 3 tableaux (MembersTable) affiche désormais aussi les
//   totaux de taxe de séjour de l'année en cours par membre (colonnes
//   "Total TS <année>" / "Payé" / "Reste dû") — anciennement le tableau
//   séparé "Soldes par membre" de l'onglet "Suivi paiements".
// - Le tableau "Listes des séjours" (déplacé lui aussi depuis "Suivi
//   paiements") est affiché en dernier sur cette page.
//
// Refonte du 07/10/2026 (même jour), demandée par Nicolas : "Listes des
// séjours" doit être "un historique de chaque séjour enregistré" — pas
// seulement ceux ayant un ts_payment. La requête part donc maintenant de
// `bookings` (avec ts_payments imbriqués) plutôt que de `ts_payments`
// elle-même : un séjour sans aucune taxe de séjour due (aucun ts_payment,
// ex. montant saisi à 0) apparaît désormais aussi, avec le statut "Aucune
// TS due" (voir StaysHistory.tsx). Conséquence directe et vérifiée : un
// séjour supprimé (DELETE /api/bookings/quick) disparaît de cette liste
// dès le prochain chargement de page, puisqu'il ne vit plus dans
// `bookings` — sans dépendre d'une suppression en cascade sur une autre
// table comme avant. L'affichage (groupé par année, bandeau repliable)
// est délégué à StaysHistory.tsx, un composant client (l'état replié/
// déplié par année ne peut pas vivre dans cette page serveur).
export default async function AdminPage() {
  const { supabase, user, profile } = await getCurrentUserAndProfile()
  if (!user) redirect('/auth/login')
  // Reserve a 4 personnes precises (demande d'Aurelie du 25/10/2026),
  // plus seulement "tout compte admin" -- voir lib/members-access.ts.
  if (!canAccessMembresTab(profile)) redirect('/dashboard')

  const currentYear = new Date().getFullYear()
  const currentYearStart = `${currentYear}-01-01`
  const nextYearStart = `${currentYear + 1}-01-01`

  // Latence (26/10/2026, demande d'Aurélie : "énorme temps de latence...
  // Membres") : les 2 requêtes ci-dessous ne dépendent ni l'une de
  // l'autre ni du résultat de l'autre -- parties en parallèle plutôt
  // qu'en série. La seconde est en plus désormais filtrée à l'année en
  // cours : elle ne sert qu'à calculer tsByUser (totaux de l'année),
  // inutile de faire remonter tout l'historique des séjours pour ça --
  // seule stayRows, plus bas, a besoin de l'historique complet (et
  // alimente un widget replié par défaut depuis le 26/10/2026, voir
  // StaysHistory.tsx).
  const [{ data: profiles }, { data: currentYearBookingsRaw }, { data: bookingsRaw }, { data: incidentsRaw }, { data: tutorialViewsRaw }] = await Promise.all([
    supabase.from('profiles').select('*').order('last_name'),
    supabase
      .from('bookings')
      .select('user_id, ts_payments(amount, status)')
      .gte('check_in', currentYearStart)
      .lt('check_in', nextYearStart),
    // Un séjour = une ligne (avec ses paiements TS imbriqués, 0 à N) --
    // sert à afficher "Listes des séjours" en bas de page (tout
    // l'historique, voir StaysHistory.tsx).
    supabase
      .from('bookings')
      .select('id, user_id, check_in, check_out, guest_name, profiles(first_name, last_name, family_group), ts_payments(amount, status, paid_at, stripe_payment_intent_id)')
      .order('check_in', { ascending: false }),
    // Nouveau widget "Historique des pannes" (26/10/2026, demande
    // d'Aurélie) -- voir IncidentsHistory.tsx. Table déjà en place
    // (utilisée par /api/incidents, voir EmergencyGuide.tsx), jusqu'ici
    // sans aucun affichage admin.
    supabase.from('incident_reports').select('category, zone_label'),
    // Nouveau widget "Vidéos tutoriel" (27/10/2026, demande d'Aurélie) --
    // voir TutorialViewsHistory.tsx et supabase/migration_bienvenue_views.sql.
    supabase.from('bienvenue_views').select('chapter_id, event'),
  ])
  const bookings = (bookingsRaw ?? []) as unknown as BookingRow[]
  const incidentRows: IncidentRow[] = (incidentsRaw ?? []).map((i) => ({ category: i.category, zoneLabel: i.zone_label }))
  const tutorialViewRows: TutorialViewRow[] = (tutorialViewsRaw ?? []).map((v) => ({ chapterId: v.chapter_id, event: v.event as 'start' | 'end' }))

  // Totaux TS par membre, année en cours uniquement (année du check-in du
  // séjour, pas de la date de paiement) -- recalculé à chaque chargement
  // de page, jamais stocké (même principe que les tâches récurrentes de
  // l'onglet Entretien, point 18 de points-a-regler-avec-louis.md).
  const tsByUser = new Map<string, { total: number; paid: number }>()
  for (const b of currentYearBookingsRaw ?? []) {
    if (b.ts_payments.length === 0) continue
    const agg = tsByUser.get(b.user_id) ?? { total: 0, paid: 0 }
    for (const p of b.ts_payments) {
      agg.total += Number(p.amount)
      if (p.status === 'paid') agg.paid += Number(p.amount)
    }
    tsByUser.set(b.user_id, agg)
  }

  const toRows = (familyGroup: 'canat' | 'lalande' | 'friend'): MemberRow[] =>
    (profiles ?? [])
      .filter((p) => p.family_group === familyGroup)
      .map((p) => {
        const ts = tsByUser.get(p.id) ?? { total: 0, paid: 0 }
        return {
          id: p.id,
          // Casse normalisee (demande par Aurelie le 26/10/2026) : voir
          // properCase dans src/lib/utils.ts.
          firstName: properCase(p.first_name),
          lastName: properCase(p.last_name),
          email: p.email,
          role: p.role,
          createdAt: p.created_at,
          tsTotalYear: ts.total,
          tsPaidYear: ts.paid,
        }
      })

  const groups: { key: 'canat' | 'lalande' | 'friend'; label: string }[] = [
    { key: 'canat', label: 'Canat' },
    { key: 'lalande', label: 'Lalande' },
    { key: 'friend', label: 'Invités' },
  ]

  // Une ligne par séjour pour StaysHistory -- voir aggregateStatus
  // ci-dessus pour le cas (rare) de plusieurs ts_payments sur un même
  // séjour. "Payé le" / "Stripe ID" affichent le paiement payé le plus
  // récent s'il y en a un, sinon "—" (voir StaysHistory.tsx).
  const stayRows: StayRow[] = bookings.map((b) => {
    const amount = b.ts_payments.reduce((sum, p) => sum + Number(p.amount), 0)
    const lastPaid = b.ts_payments
      .filter((p) => p.status === 'paid' && p.paid_at)
      .sort((a, c) => (a.paid_at! < c.paid_at! ? 1 : -1))[0]
    return {
      id: b.id,
      // Nom de l'occupant réel du séjour (guest_name, ex. "Eva" ou "Otto"),
      // pas forcément celui du compte qui l'a saisi -- voir
      // occupantDisplayName (demandé par Aurélie le 26/10/2026).
      memberName: occupantDisplayName(b.guest_name, b.profiles),
      checkIn: b.check_in,
      checkOut: b.check_out,
      amount,
      status: aggregateStatus(b.ts_payments),
      paidAt: lastPaid?.paid_at ?? null,
      stripeId: lastPaid?.stripe_payment_intent_id ?? null,
      year: new Date(b.check_in).getFullYear(),
    }
  })

  return (
    <div className="space-y-8">
      {/* Titre affiche renomme 'Membres' -> 'Gestion' le 26/10/2026
          (demande d'Aurelie), comme le libelle du bandeau du bas
          (BottomNav.tsx) -- route /dashboard/admin et acces
          (canAccessMembresTab) inchanges. */}
      <PageTitle>Gestion</PageTitle>

      <div className="space-y-6">
        {groups.map(({ key, label }) => (
          <div key={key} className="space-y-2">
            <h2 className="bg-muted/70 px-3 py-1.5 text-lg md:text-[22px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {label}
            </h2>
            <MembersTable rows={toRows(key)} />
          </div>
        ))}
      </div>

      {/* Listes des séjours -- affichée en dernier sur cette page, voir
          le commentaire du 07/10/2026 en tête de fichier. Widget
          lui-même dépliable depuis le 26/10/2026 (voir StaysHistory.tsx,
          qui porte désormais sa propre Card/CardHeader). */}
      <StaysHistory rows={stayRows} />

      {/* Nouveau widget "Historique des pannes" (26/10/2026, demande
          d'Aurélie) -- voir IncidentsHistory.tsx. */}
      <IncidentsHistory rows={incidentRows} />

      {/* Nouveau widget "Vidéos tutoriel" (27/10/2026, demande
          d'Aurélie) -- voir TutorialViewsHistory.tsx. */}
      <TutorialViewsHistory rows={tutorialViewRows} />
    </div>
  )
}
