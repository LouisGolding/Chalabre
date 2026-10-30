import { PageTitle } from '@/components/layout/PageTitle'
import { occupantDisplayName, properCase, firstNameOnly } from '@/lib/utils'
import { UNKNOWN_DATE_OF_BIRTH } from '@/lib/profile'
import { findClosestNameMatch } from '@/lib/fuzzy-name'
import { canAccessMembresTab } from '@/lib/members-access'
import { getCurrentUserAndProfile } from '@/lib/auth/current-user'
import { redirect } from 'next/navigation'
import { MembersTable, MemberRow } from '@/components/admin/MembersTable'
import { StaysHistory, StayRow } from '@/components/admin/StaysHistory'
import { IncidentsHistory, IncidentRow } from '@/components/admin/IncidentsHistory'
import { TutorialViewsHistory, TutorialViewRow } from '@/components/admin/TutorialViewsHistory'
import { PendingRegistrations, PendingRegistrationRow } from '@/components/admin/PendingRegistrations'

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
      // guest_name ajouté le 27/10/2026 (voir tsByGuest plus bas, demande
      // d'Aurélie : "les lignes de paiements soient claires pour tout le
      // monde") -- distinguer le séjour propre du titulaire de celui d'un
      // accompagnant sans compte. age_bracket ajouté le même jour (voir
      // rectification plus bas : seuls les enfants obtiennent leur propre
      // ligne "invité").
      .select('user_id, guest_name, age_bracket, ts_payments(amount, status)')
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
  //
  // Rectification du 27/10/2026 (demande d'Aurélie, cohérence des lignes
  // de paiement) : un séjour D'ACCOMPAGNANT sans compte (ex. Otto, saisi
  // par Nicolas) n'est plus mélangé au total du compte qui l'a saisi --
  // il va dans tsByGuest ci-dessous et ressort sur sa PROPRE ligne dans
  // le tableau (voir toRows plus bas), même si c'est toujours payable
  // depuis le compte d'un parent (voir /api/stripe/checkout, inchangé).
  //
  // Seconde rectification, le même jour (Aurélie a vu le résultat en
  // ligne) : deux bugs corrigés ci-dessous.
  // 1/ Homonymes : "il n'y a pas d'homonyme dans la famille" -- si le
  //    guest_name saisi correspond (au prénom, accents/casse/fautes de
  //    frappe près -- voir findClosestNameMatch) à un compte existant,
  //    ce n'est PAS un accompagnant distinct mais le titulaire de ce
  //    compte lui-même qui a saisi son propre séjour via le champ
  //    "accompagnant" (ex. Aurélie se saisissant elle-même comme
  //    "Aurelie", ou Guillaume comme "Guillaume") : fusionné dans
  //    tsByUser de ce compte plutôt que de créer une ligne fantôme en
  //    double.
  // 2/ "ne rajoute que des lignes pour les enfants" : un accompagnant
  //    sans compte ET sans homonyme (ex. Eva, l'épouse de Guillaume, qui
  //    n'a simplement pas encore créé de compte) n'est pas pour autant un
  //    enfant -- il n'obtient PAS de ligne "invité" tant qu'il n'a pas de
  //    compte propre ; seul age_bracket === 'child' (choix explicite à la
  //    saisie du séjour, voir BookingEditModal.tsx) donne droit à une
  //    ligne "invité". Le jour où Eva crée son compte (EVA DEKANY), le
  //    cas 1/ ci-dessus la détectera automatiquement -- aucune ligne
  //    fantôme ne réapparaîtra.
  const familyGroupById = new Map((profiles ?? []).map((p) => [p.id, p.family_group]))
  const lastNameById = new Map((profiles ?? []).map((p) => [p.id, p.last_name]))
  const profileIdByFirstName: { id: string; firstName: string }[] = (profiles ?? []).map((p) => ({
    id: p.id,
    firstName: p.first_name,
  }))

  const tsByUser = new Map<string, { total: number; paid: number }>()
  const tsByGuest = new Map<string, { guestName: string; familyGroup: string; lastName: string; total: number; paid: number }>()
  for (const b of currentYearBookingsRaw ?? []) {
    if (b.ts_payments.length === 0) continue
    const guestName = b.guest_name?.trim()
    if (!guestName) {
      const agg = tsByUser.get(b.user_id) ?? { total: 0, paid: 0 }
      for (const p of b.ts_payments) {
        agg.total += Number(p.amount)
        if (p.status === 'paid') agg.paid += Number(p.amount)
      }
      tsByUser.set(b.user_id, agg)
      continue
    }
    // Cas 1/ ci-dessus : homonyme d'un compte existant -- fusionné dans
    // ce compte, jamais dans tsByGuest.
    const homonymIndex = findClosestNameMatch(
      guestName,
      profileIdByFirstName.map((p) => p.firstName)
    )
    if (homonymIndex !== -1) {
      const matchedId = profileIdByFirstName[homonymIndex].id
      const agg = tsByUser.get(matchedId) ?? { total: 0, paid: 0 }
      for (const p of b.ts_payments) {
        agg.total += Number(p.amount)
        if (p.status === 'paid') agg.paid += Number(p.amount)
      }
      tsByUser.set(matchedId, agg)
      continue
    }
    // Cas 2/ ci-dessus : pas de compte correspondant -- seuls les
    // enfants (age_bracket === 'child') obtiennent leur propre ligne
    // "invité" ; un adulte sans compte (ex. Eva) n'apparaît nulle part
    // tant qu'il n'a pas créé le sien.
    if (b.age_bracket !== 'child') continue
    // Regroupé par (famille du titulaire qui a saisi + nom exact de
    // l'accompagnant) -- même convention de regroupement que les
    // pastilles "TS - <prénom>" du Planning (voir computeTsBalance dans
    // src/lib/ts-balance.ts) : par texte exact du guest_name, jamais
    // dédoublonné avec une autre orthographe du même nom.
    const familyGroup = familyGroupById.get(b.user_id) ?? 'friend'
    const key = `${familyGroup}::${guestName}`
    const agg = tsByGuest.get(key) ?? { guestName, familyGroup, lastName: lastNameById.get(b.user_id) ?? '', total: 0, paid: 0 }
    for (const p of b.ts_payments) {
      agg.total += Number(p.amount)
      if (p.status === 'paid') agg.paid += Number(p.amount)
    }
    tsByGuest.set(key, agg)
  }

  // Inscriptions en attente de validation (27/10/2026, voir
  // PendingRegistrations.tsx) -- exclues des 3 tableaux Canat/Lalande/
  // Invités ci-dessous (toRows filtre désormais sur status === 'active'),
  // affichées à part dans leur propre widget. Un compte 'rejected' n'est
  // affiché nulle part (refus déjà traité), ni dans les tableaux ni dans
  // ce widget.
  const pendingRows: PendingRegistrationRow[] = (profiles ?? [])
    .filter((p) => p.status === 'pending')
    .map((p) => ({
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      email: p.email,
      familyGroup: p.family_group,
      createdAt: p.created_at,
    }))

  const toRows = (familyGroup: 'canat' | 'lalande' | 'friend'): MemberRow[] => {
    const accountRows: MemberRow[] = (profiles ?? [])
      // Comme dashboard/layout.tsx (voir commit de correctif du
      // 27/10/2026) : tant que la migration n'est pas appliquee,
      // status est undefined pour tout le monde -- ne JAMAIS exclure
      // dans ce cas, seulement sur 'pending'/'rejected' explicites.
      .filter((p) => p.family_group === familyGroup && p.status !== 'pending' && p.status !== 'rejected')
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
          // UNKNOWN_DATE_OF_BIRTH ('1900-01-01', ecrit par handle_new_user
          // quand l'inscription ne fournit aucune date -- ex. "Continuer
          // avec Google") ramene ici a null, pour que la colonne "Date de
          // naissance" (30/10/2026, demande d'Aurelie) affiche une case
          // vide et editable plutot qu'une fausse date de 1900.
          dateOfBirth: p.date_of_birth === UNKNOWN_DATE_OF_BIRTH ? null : p.date_of_birth,
          createdAt: p.created_at,
          tsTotalYear: ts.total,
          tsPaidYear: ts.paid,
        }
      })

    // Une ligne par accompagnant sans compte de cette famille (27/10/2026,
    // demande d'Aurélie) -- même prénom/nom de famille que sur le
    // Planning (firstNameOnly + nom du titulaire qui a saisi, voir
    // occupantDisplayName dans src/lib/utils.ts pour la même convention),
    // sans email/rôle/date de création (role: null -- voir MembersTable,
    // ça laisse la case "Autorisations" vide) et son propre total TS,
    // même si le paiement reste possible depuis le compte d'un parent.
    const guestRows: MemberRow[] = [...tsByGuest.values()]
      .filter((g) => g.familyGroup === familyGroup)
      .map((g) => ({
        id: `guest:${familyGroup}:${g.guestName}`,
        firstName: firstNameOnly(g.guestName),
        lastName: properCase(g.lastName),
        email: null,
        role: null,
        dateOfBirth: null,
        createdAt: null,
        tsTotalYear: g.total,
        tsPaidYear: g.paid,
      }))

    return [...accountRows, ...guestRows]
  }

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

      {/* Nouveau widget "Inscriptions en attente" (27/10/2026, demande
          d'Aurélie) -- en premier sur la page, c'est une action à
          traiter plutôt qu'un historique à consulter. */}
      <PendingRegistrations rows={pendingRows} />

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
