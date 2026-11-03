import { createClient } from '@/lib/supabase/server'
import { csPeriodFromCheckOut, MONTHS_3, type CsPeriod } from '@/lib/utils'
import { findClosestNameMatch } from '@/lib/fuzzy-name'
import { otherNuclearFamilyMembers } from '@/lib/nuclear-family'

export interface CsBalanceItem {
  id: string
  amount: number
  checkOut: string
  period: CsPeriod
  label: string // ex. "2026/JUN", pour affichage/debug — voir buildCsStatementDescriptorSuffix pour le libellé bancaire
  // Séjour d'origine de ce paiement (02/11/2026, demande de Nicolas : le
  // widget "Votre prochain séjour" ne doit plus payer le CUMUL de tous
  // ses séjours -- on a désormais un historique pour ça -- mais
  // seulement la contribution séjour de CE séjour précis) -- permet de
  // filtrer csBalance.own.items à un seul séjour, voir NextStayCard.tsx.
  bookingId: string
}

export interface CsBalanceBucket {
  pending: number
  items: CsBalanceItem[]
}

export interface CsGuestBalance extends CsBalanceBucket {
  name: string
  // Paiement délégué (02/11/2026, cas Alexandre -> Guy, signalé par
  // Nicolas : "ne compte pas sa contribution séjour dans le décompte de la
  // mienne [...] Alexandre est le seul cas particulier où moi je
  // pourrais l'inscrire sur le planning, et Guy le payer séparément") --
  // true quand cet accompagnant a lui-même délégué le paiement de sa
  // contribution séjour à un AUTRE compte (profiles.cs_payer_id, voir
  // supabase/migration_profiles_ts_payer_delegate.sql). Le solde reste
  // ici (ex. pour que Nicolas, qui a saisi ce séjour, garde la main sur
  // ses dates et puisse toujours le régler lui-même au besoin) mais ne
  // doit plus entrer dans un total cumulé "tous accompagnants confondus"
  // (voir dashboard/page.tsx, csTotalPending) -- ce total-là est déjà
  // géré séparément, par la personne désignée comme payeur (voir
  // DelegatedStay dans NextStayCard.tsx et planning/page.tsx).
  isDelegated: boolean
}

// Séjour PROPRE (sans accompagnant) d'un autre membre de la famille
// nucléaire qui a SON PROPRE compte (ex. Aurélie, à la différence d'Otto
// qui n'en a pas) -- demande de Nicolas le 03/11/2026 : "Option famille"
// (NextStayCard.tsx) doit refléter sa vraie contribution séjour déjà
// saisie sur son propre compte, pas seulement celle des accompagnants
// sans compte comme Otto -- distinct de CsGuestBalance ci-dessus, qui ne
// couvre que les accompagnants.
export interface CsFamilyOwnStay {
  memberId: string
  bookingId: string
  checkIn: string
  checkOut: string
  pending: number
  ids: string[]
}

export interface CsBalanceResult {
  own: CsBalanceBucket
  guests: CsGuestBalance[]
  familyOwnStays: CsFamilyOwnStay[]
}

type RawCsPayment = { id: string; amount: number; status: string }
type RawBooking = { id: string; guest_name: string | null; check_out: string; cs_payments: RawCsPayment[] | null }

// Solde de contribution séjour "à la manière d'un solde bancaire" (demandé par
// Aurélie le 22/09/2026) : additionne TOUTES les contributions séjour dues d'une
// personne (tous ses séjours, passés ou à venir) et retire celles déjà
// réglées — jamais remis à zéro d'un séjour à l'autre. "own" est le solde
// du titulaire du compte connecté ; "guests" un solde par accompagnant
// pour lequel CE compte, OU un membre de sa famille nucléaire (voir plus
// bas), a saisi un séjour (ex. Emmanuelle voit un solde pour Oscar,
// Agathe, Zoé).
//
// Un accompagnant saisi par quelqu'un d'autre (guest_name en texte libre)
// mais qui correspond en réalité à un compte existant (même nom complet,
// tolérant aux accents/fautes de frappe — harmonisé le 07/10/2026 sur la
// même logique que ensureGuestColor, voir findClosestNameMatch/fuzzy-name.ts ;
// avant cette date, la correspondance ici était stricte alors qu'elle était
// déjà tolérante côté couleurs/famille, une incohérence signalée à Louis)
// voit ce séjour compté dans SON PROPRE "own" ici, en plus
// de chez la personne qui l'a saisi : les deux comptes partagent les mêmes
// lignes cs_payments en base, donc le solde des deux se met à jour
// ensemble dès que l'un règle (au prochain chargement de page — voir
// /api/cs-balance, pas de synchronisation instantanée entre deux comptes
// ouverts en même temps, non demandée).
//
// Familles nucléaires (27/10/2026, demande d'Aurélie : "si un des deux
// parents rentre le sejour de son enfant, ce sejour apparait aussi sur le
// profil de l'autre parent [...] de sorte à ce que l'un des deux parents
// puisse payer") : un séjour D'ACCOMPAGNANT (enfant...) saisi par un
// AUTRE compte qui partage la même colonne profiles.nuclear_family (voir
// src/lib/colors.ts et src/lib/nuclear-family.ts — ex. Nicolas et Aurélie
// partagent 'lal-nicolas-aurelie') est traité ici exactement comme si le
// titulaire du compte l'avait saisi lui-même : même bucket "guests", même
// somme, payable depuis les deux comptes (voir l'autorisation
// correspondante dans /api/stripe/checkout/route.ts). Volontairement
// exclu de ce partage : le séjour PROPRE d'un autre membre de la famille
// nucléaire (sans accompagnant) ne devient pas payable par les autres
// pour autant — seuls les séjours d'accompagnants sont partagés. Et tout
// séjour d'accompagnant dont le nom correspond en réalité au titulaire
// lui-même reste compté dans "own" (via la correspondance de nom
// ci-dessus), jamais dans "guests" en plus — pas de double comptage.
//
// Rectification du 27/10/2026 (toujours Aurélie, exemple donné : son
// propre séjour, saisi par elle-même sur son propre compte, ne doit
// jamais apparaître chez Nicolas) : un séjour dont le guest_name
// correspond en réalité au TITULAIRE DU COMPTE QUI L'A SAISI (et non au
// compte qui regarde) n'est pas un "accompagnant" — c'est son propre
// séjour, étiqueté par erreur avec un guest_name — jamais partagé avec
// les autres membres de la famille nucléaire pour autant.
//
// "pending" désigne ici tout ce qui n'est pas encore réglé (status
// 'pending' OU 'overdue', ex. un paiement Stripe qui a échoué) — même
// convention que la vue admin public.user_balances (status != 'paid'),
// voir migration_payment_tracking.sql.
export async function computeCsBalance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  // Évite un aller-retour Supabase supplémentaire quand l'appelant a déjà
  // ce champ sous la main (ex. dashboard/page.tsx, planning/page.tsx — le
  // profil du titulaire est déjà chargé par getCurrentUserAndProfile()).
  // undefined (valeur par défaut) : on va la chercher nous-mêmes.
  knownNuclearFamily?: string | null
): Promise<CsBalanceResult> {
  // Latence (26/10/2026, demande d'Aurélie : "il y a toujours un temps
  // de latence [...] a revérifier pour que tout soit tres tres
  // rapide") : `profile` et `myBookings` ne dépendent pas l'un de
  // l'autre (myBookings n'a besoin que de userId, déjà connu) -- lancés
  // de front ici. `otherBookings` et la famille nucléaire restent de
  // vraies dépendances séquentielles (besoin de myFullName/profile) --
  // mais lancées de front ENTRE ELLES juste en dessous.
  const [{ data: profile }, { data: myBookings }, { data: delegateProfiles }] = await Promise.all([
    supabase.from('profiles').select('first_name, last_name, nuclear_family').eq('id', userId).single(),
    supabase
      .from('bookings')
      .select('id, guest_name, check_out, cs_payments(id, amount, status)')
      .eq('user_id', userId),
    // Paiement délégué (02/11/2026, voir le commentaire sur
    // CsGuestBalance.isDelegated plus haut) : tous les comptes qui
    // délèguent leur contribution séjour à un autre (actuellement Alexandre
    // -> Guy uniquement), pour reconnaître leur nom parmi les
    // accompagnants ci-dessous.
    supabase.from('profiles').select('id, first_name, last_name').not('cs_payer_id', 'is', null),
  ])

  const myFullName = profile ? `${profile.first_name} ${profile.last_name}` : null
  // Candidats de correspondance pour "c'est en réalité SON PROPRE
  // séjour" (27/10/2026, correctif signalé par Nicolas : le séjour
  // d'Aurélie, auto-étiqueté juste "Aurelie" -- PRÉNOM SEUL, pas
  // "Aurélie Fouré" -- restait visible sur son profil). findClosestNameMatch
  // compare des chaînes entières, jamais une sous-chaîne : un
  // auto-étiquetage au prénom seul ("Aurelie", "Guillaume") ne
  // correspondait donc jamais à myFullName/registrantName (prénom +
  // nom). Les deux graphies réellement observées (prénom seul, ou
  // prénom + nom comme "Otto Lalande") sont désormais proposées comme
  // candidats.
  const myNameCandidates = profile ? [profile.first_name, myFullName as string] : null
  const nuclearFamily = knownNuclearFamily !== undefined ? knownNuclearFamily : profile?.nuclear_family ?? null

  // Voir le commentaire sur CsGuestBalance.isDelegated plus haut --
  // tolérant aux fautes de frappe, même mécanisme que myNameCandidates.
  const delegateNameCandidatesList = (delegateProfiles ?? []).map((p) => [p.first_name, `${p.first_name} ${p.last_name}`])
  const isDelegatedGuestName = (guestName: string): boolean =>
    delegateNameCandidatesList.some((candidates) => findClosestNameMatch(guestName, candidates) !== -1)

  const [{ data: otherBookings }, familyMembers] = await Promise.all([
    myFullName
      ? supabase
          .from('bookings')
          .select('id, guest_name, user_id, check_out, cs_payments(id, amount, status)')
          .neq('user_id', userId)
          .not('guest_name', 'is', null)
      : Promise.resolve({ data: [] as RawBooking[] }),
    otherNuclearFamilyMembers(supabase, userId, nuclearFamily),
  ])

  const familyMemberIds = familyMembers.map((m) => m.id)
  // Voir le commentaire sur myNameCandidates plus haut -- même principe
  // pour le titulaire qui a saisi un séjour d'accompagnant (registrant).
  const familyMemberNameCandidatesById = new Map(
    familyMembers.map((m) => [m.id, [m.first_name, `${m.first_name} ${m.last_name}`]])
  )

  // Plus de filtre `.not('guest_name', 'is', null)` ici (03/11/2026) : on a
  // désormais besoin aussi des séjours PROPRES (guest_name vide ou
  // auto-étiqueté) de ces comptes, pour familyOwnStays plus bas --
  // distingués des vrais accompagnants dans la boucle qui suit.
  const { data: familyMemberBookings } =
    familyMemberIds.length > 0
      ? await supabase
          .from('bookings')
          .select('id, guest_name, user_id, check_in, check_out, cs_payments(id, amount, status)')
          .in('user_id', familyMemberIds)
      : { data: [] as (RawBooking & { user_id: string; check_in: string })[] }

  const ownItems: CsBalanceItem[] = []
  let ownPending = 0
  const guestOrder: string[] = []
  const guestMap = new Map<string, CsGuestBalance>()

  // Ajoute un cs_payment non réglé à une liste d'items, et renvoie son
  // montant (0 si déjà payé, pour ne rien ajouter au solde).
  const addUnpaid = (items: CsBalanceItem[], payment: RawCsPayment, checkOut: string, bookingId: string): number => {
    if (payment.status === 'paid') return 0
    const period = csPeriodFromCheckOut(checkOut)
    const amount = Number(payment.amount)
    items.push({
      id: payment.id,
      amount,
      checkOut,
      period,
      label: `${period.year}/${MONTHS_3[period.monthIndex]}`,
      bookingId,
    })
    return amount
  }

  const addToGuestBucket = (guestName: string, payments: RawCsPayment[], checkOut: string, bookingId: string) => {
    if (!guestMap.has(guestName)) {
      guestMap.set(guestName, { name: guestName, pending: 0, items: [], isDelegated: isDelegatedGuestName(guestName) })
      guestOrder.push(guestName)
    }
    const bucket = guestMap.get(guestName)!
    for (const payment of payments) bucket.pending += addUnpaid(bucket.items, payment, checkOut, bookingId)
  }

  for (const booking of (myBookings ?? []) as RawBooking[]) {
    const guestName = booking.guest_name?.trim()
    const payments = booking.cs_payments ?? []
    // Correctif du 02/11/2026 (signalé par Aurélie : déjà avec un séjour
    // en cours dans le widget principal, elle a dû passer par "Ajouter
    // un séjour" -- donc taper SON PROPRE nom comme accompagnant -- pour
    // saisir un second séjour personnel, faute d'un autre moyen de le
    // faire ; elle attend alors "le cumul des contributions séjour" des deux
    // dans UN SEUL total) : jusqu'ici, seul un guest_name vide tombait
    // dans "own" -- un séjour auto-étiqueté à son propre nom (même
    // tolérance myNameCandidates qu'ailleurs dans ce fichier, déjà
    // utilisée plus bas pour le même cas chez un AUTRE compte) tombait
    // par erreur dans un bucket "guests" séparé (ex. "CS - Aurelie"),
    // jamais fusionné avec son propre solde "own" malgré que ce soit
    // bien le même et unique solde d'une seule personne.
    const isSelfTagged = !!guestName && !!myNameCandidates && findClosestNameMatch(guestName, myNameCandidates) !== -1
    if (!guestName || isSelfTagged) {
      for (const payment of payments) ownPending += addUnpaid(ownItems, payment, booking.check_out, booking.id)
      continue
    }
    addToGuestBucket(guestName, payments, booking.check_out, booking.id)
  }

  // Séjours des autres membres de la même famille nucléaire : soit un
  // accompagnant (guest_name renseigné, voir le grand commentaire
  // au-dessus de la fonction) -- même bucket "guests" que ci-dessus --
  // soit le séjour PROPRE de ce membre (guest_name vide ou
  // auto-étiqueté à son propre nom) -- qui va dans familyOwnStays,
  // JAMAIS dans "own" (ce "own" est réservé au titulaire DE CE compte,
  // voir CsBalanceResult.own) ni dans "guests" (réservé aux
  // accompagnants). Demande de Nicolas le 03/11/2026 : "Option famille"
  // doit pouvoir afficher et régler la vraie contribution d'un parent
  // qui a déjà réservé sur SON PROPRE compte (ex. Aurélie), pas
  // seulement celle d'un accompagnant sans compte (ex. Otto).
  const familyOwnStays: CsFamilyOwnStay[] = []
  for (const booking of (familyMemberBookings ?? []) as (RawBooking & { user_id: string; check_in: string })[]) {
    const guestName = booking.guest_name?.trim()
    const registrantCandidates = familyMemberNameCandidatesById.get(booking.user_id)
    const isSelfTagged = !!guestName && !!registrantCandidates && findClosestNameMatch(guestName, registrantCandidates) !== -1
    if (!guestName || isSelfTagged) {
      const items: CsBalanceItem[] = []
      let pending = 0
      for (const payment of booking.cs_payments ?? []) pending += addUnpaid(items, payment, booking.check_out, booking.id)
      familyOwnStays.push({
        memberId: booking.user_id,
        bookingId: booking.id,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        pending,
        ids: items.map((i) => i.id),
      })
      continue
    }
    // Exclu si ça correspond au titulaire DU COMPTE QUI REGARDE -- déjà
    // compté dans "own" via otherBookings plus bas, jamais compté deux
    // fois.
    if (myNameCandidates && findClosestNameMatch(guestName, myNameCandidates) !== -1) continue
    addToGuestBucket(guestName, booking.cs_payments ?? [], booking.check_out, booking.id)
  }

  if (myNameCandidates) {
    for (const booking of (otherBookings ?? []) as RawBooking[]) {
      const guestName = booking.guest_name?.trim()
      if (!guestName || findClosestNameMatch(guestName, myNameCandidates) === -1) continue
      const payments = booking.cs_payments ?? []
      for (const payment of payments) ownPending += addUnpaid(ownItems, payment, booking.check_out, booking.id)
    }
  }

  return {
    own: { pending: ownPending, items: ownItems },
    guests: guestOrder.map((name) => guestMap.get(name)!),
    familyOwnStays,
  }
}
