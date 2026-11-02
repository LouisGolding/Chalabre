import { getCurrentUserAndProfile } from '@/lib/auth/current-user'
import { redirect } from 'next/navigation'
import { PlanningBooking } from '@/components/planning/PlanningView'
import { PlanningPageClient } from '@/components/planning/PlanningPageClient'
import { StaysHistoryWidget } from '@/components/dashboard/StaysHistoryWidget'
import { colorForName, colorForPaletteIndex, fallbackIndexForName } from '@/lib/colors'
import type { FamilyGroup, HouseSide } from '@/types'
import { computeCsBalance } from '@/lib/cs-balance'
import { findClosestNameMatch } from '@/lib/fuzzy-name'
import { otherNuclearFamilyMembers } from '@/lib/nuclear-family'

// ============================================================
// (Ancien bloc "DONNÉES DE TEST" retiré le 29/09/2026, à la demande de
// Nicolas, une fois la mise en forme du planning validée avec Aurélie et
// les vrais séjours/couleurs testés en conditions réelles — voir
// claude/points-a-regler-avec-louis.md. Le planning n'affiche plus que
// les vraies données Supabase, y compris en développement.
// ============================================================

// Résolution de la couleur d'un occupant (demandé par Nicolas le
// 19/09/2026) : chaque compte a sa couleur enregistrée une fois pour
// toutes (profiles.color_hue). Pour un séjour saisi pour un accompagnant
// (guest_name), on cherche d'abord une correspondance avec un compte
// existant (ex. un enfant inscrit dont un parent saisit les séjours), puis
// avec la mémoire des accompagnants sans compte (guest_people, ex. Otto —
// voir supabase/migration_guest_people.sql et
// src/app/api/bookings/quick/route.ts, qui l'alimente). Si rien n'est
// trouvé (séjour antérieur à la mise en place de ce système), une couleur
// est recalculée à la volée à partir du nom, sans être enregistrée.
// Référence de couleur résolue pour une personne : sa famille (quelle
// palette utiliser, voir src/lib/colors.ts) + son index dans cette palette.
interface PaletteRef {
  family: FamilyGroup
  index: number
}

function buildColorResolver(colorByName: Map<string, PaletteRef>) {
  return function resolveColor(
    guestName: string | null,
    ownerFamily: FamilyGroup | null | undefined,
    ownerIndex: number | null | undefined
  ): string {
    if (guestName) {
      const ref = colorByName.get(guestName.trim().toLowerCase())
      if (ref) return colorForPaletteIndex(ref.family, ref.index)
      return colorForName(guestName)
    }
    if (ownerFamily && ownerIndex !== null && ownerIndex !== undefined) return colorForPaletteIndex(ownerFamily, ownerIndex)
    return colorForName('Séjour')
  }
}

export default async function PlanningPage() {
  const { supabase, user, profile } = await getCurrentUserAndProfile()
  if (!user) redirect('/auth/login')

  if (!profile) redirect('/auth/login')

  // Requêtes indépendantes de ce rendu, lancées en parallèle plutôt que
  // séquentiellement (demandé par Aurélie le 26/10/2026 : "il y a toujours
  // un temps de latence quand on navigue dans le site") — même principe
  // que dans dashboard/page.tsx et cs-balance.ts.
  const [
    { data: allProfilesForColor },
    { data: guestPeople },
    { data: myBookings },
    { data: bookings },
    { data: events },
    initialCsBalance,
    otherFamilyMembers,
    { data: delegatePayerProfiles },
  ] = await Promise.all([
    // Résolution des couleurs par nom (voir buildColorResolver plus haut) :
    // remontée ici, avant le calcul de guestFutureBookings, pour pouvoir
    // attacher une teinte à chaque séjour d'accompagnant — sert à colorer
    // le fond des bannières "Prochain séjour X" dans NextStayCard.tsx
    // (demandé par Nicolas le 29/09/2026 : la bannière reprend la couleur
    // déjà attribuée à la personne, la même que sur le planning).
    supabase
      .from('profiles')
      .select('id, first_name, last_name, family_group, color_hue'),
    supabase
      .from('guest_people')
      .select('name, family_group, color_hue, created_by'),
    // Séjour à venir du titulaire du compte + ceux déjà saisis pour des
    // accompagnants (bouton "+") : mêmes données que l'ex-widget de
    // l'accueil, pour alimenter ReserverSejour ci-dessous (widget migré ici
    // le 21/09/2026, demandé par Nicolas).
    supabase
      .from('bookings')
      .select('*, cs_payments(*)')
      .eq('user_id', user.id)
      .order('check_in', { ascending: true }),
    supabase
      .from('bookings')
      .select('*, profiles(first_name, last_name, family_group, color_hue, date_of_birth), rooms(name)')
      .order('check_in', { ascending: true }),
    supabase
      .from('events')
      .select('*')
      .order('start_date', { ascending: true }),
    // Solde de contribution séjour "à la manière d'un solde bancaire" (demandé
    // par Aurélie le 22/09/2026) : voir computeCsBalance pour le détail —
    // reparti entre le solde propre du titulaire ("Votre solde CS", y
    // compris ses séjours saisis par quelqu'un d'autre sous son nom) et un
    // solde par accompagnant pour lequel ce compte a saisi un séjour ("CS -
    // <prénom>"). Rafraîchi ensuite en direct via /api/cs-balance (même
    // fonction) sans recharger la page.
    computeCsBalance(supabase, user.id, profile.nuclear_family),
    // Familles nucléaires (27/10/2026, demande d'Aurélie : "si un des deux
    // parents rentre le sejour de son enfant, ce sejour apparait aussi sur
    // le profil de l'autre parent") : ids des autres comptes qui partagent
    // la même profiles.nuclear_family que le titulaire -- voir
    // src/lib/nuclear-family.ts. Indépendante de tout le reste ci-dessus,
    // lancée de front avec le reste du Promise.all.
    otherNuclearFamilyMembers(supabase, user.id, profile.nuclear_family),
    // Paiement délégué (cas unique, 01/11/2026, décision d'Aurélie) :
    // Alexandre paie souvent sa contribution séjour en cash à Guy --
    // profiles.cs_payer_id (voir supabase/migration_profiles_ts_payer_delegate.sql)
    // marque un compte dont la contribution séjour doit être réglable depuis
    // un AUTRE compte, désigné ici. Indépendant du reste, lancé de front.
    // Écrit en général (n'importe quel profil pourrait un jour avoir ce
    // champ renseigné), même si pour l'instant seul Alexandre l'a.
    supabase
      .from('profiles')
      .select('id, first_name, last_name, family_group, color_hue')
      .eq('cs_payer_id', profile.id),
  ])

  // Séjours d'accompagnants saisis par un AUTRE membre de cette même
  // famille nucléaire (ex. le séjour d'Otto saisi par Nicolas, visible et
  // payable ici même depuis le compte d'Aurélie) -- vraie dépendance
  // séquentielle (a besoin d'otherFamilyMembers ci-dessus), même requête
  // que myBookings plus haut pour rester compatible avec son usage plus
  // bas.
  const otherFamilyIds = otherFamilyMembers.map((m) => m.id)
  // Voir le commentaire détaillé sur le même correctif dans
  // src/lib/cs-balance.ts (27/10/2026, signalé par Nicolas : le séjour
  // d'Aurélie, auto-étiqueté juste "Aurelie" -- prénom seul -- restait
  // visible sur son profil, faute de correspondance avec "Aurélie Fouré").
  // Prénom seul ET prénom+nom proposés comme candidats, les deux graphies
  // réellement observées pour un auto-étiquetage.
  const familyMemberNameCandidatesById = new Map(
    otherFamilyMembers.map((m) => [m.id, [m.first_name, `${m.first_name} ${m.last_name}`]])
  )
  const { data: familyGuestBookings } =
    otherFamilyIds.length > 0
      ? await supabase
          .from('bookings')
          .select('*, cs_payments(*)')
          .in('user_id', otherFamilyIds)
          .not('guest_name', 'is', null)
      : { data: [] as typeof myBookings }

  // Tous les séjours (passés, en cours ou à venir -- pas de filtre de
  // date, à la différence de myFutureBookings plus bas) de chaque compte
  // qui délègue le paiement de sa contribution séjour à CE titulaire (voir
  // delegatePayerProfiles plus haut) -- un widget entier par séjour,
  // "comme si c'était un de ses propres séjours" (demande d'Aurélie),
  // affiché en lecture seule (voir DelegatedStayBanner dans
  // NextStayCard.tsx) : seul le règlement de la contribution séjour est
  // actionnable, pas d'édition des dates d'Alexandre depuis le compte de
  // Guy.
  const delegatePayerIds = (delegatePayerProfiles ?? []).map((p) => p.id)
  type DelegateBookingRow = {
    id: string
    user_id: string
    check_in: string
    check_out: string
    house_side: HouseSide | null
    notes: string | null
    guest_name: string | null
    cs_payments: { id: string; amount: number; status: string }[] | null
  }
  const delegateNameCandidatesById = new Map(
    (delegatePayerProfiles ?? []).map((p) => [p.id, [p.first_name, `${p.first_name} ${p.last_name}`]])
  )
  // Correctif du 02/11/2026 (signalé par Nicolas, cas concret : le séjour
  // d'Alexandre n'est PAS saisi par Alexandre lui-même -- il est saisi
  // par Nicolas, via "Ajouter un séjour", guest_name = "Alexandre
  // Lalande", exactement comme un accompagnant ordinaire). La requête
  // d'origine (bookings.user_id IN delegatePayerIds) ne voyait donc QUE
  // le cas où Alexandre se serait réservé lui-même -- jamais celui qui
  // se produit réellement. On cherche désormais aussi, parmi TOUS les
  // séjours du site portant un guest_name (même principe que
  // otherBookings dans cs-balance.ts), ceux dont le nom correspond
  // (tolérant aux fautes de frappe) à un compte qui délègue son paiement
  // à CE titulaire -- peu importe qui les a saisis.
  const [{ data: delegateOwnBookingsRaw }, { data: delegateGuestBookingsRaw }] =
    delegatePayerIds.length > 0
      ? await Promise.all([
          supabase
            .from('bookings')
            .select('id, user_id, check_in, check_out, house_side, notes, guest_name, cs_payments(id, amount, status)')
            .in('user_id', delegatePayerIds)
            .order('check_in', { ascending: true }),
          supabase
            .from('bookings')
            .select('id, user_id, check_in, check_out, house_side, notes, guest_name, cs_payments(id, amount, status)')
            .not('guest_name', 'is', null)
            .order('check_in', { ascending: true }),
        ])
      : [{ data: [] as DelegateBookingRow[] }, { data: [] as DelegateBookingRow[] }]

  const delegatedBookingsRaw: (DelegateBookingRow & { ownerId: string })[] = [
    // Le séjour propre du délégant sur son propre compte (guest_name vide
    // -- cas prévu à l'origine, jamais observé en pratique jusqu'ici).
    ...((delegateOwnBookingsRaw ?? []) as DelegateBookingRow[])
      .filter((b) => !b.guest_name?.trim())
      .map((b) => ({ ...b, ownerId: b.user_id })),
    // Le séjour saisi par un AUTRE compte sous le nom du délégant (cas
    // réel observé : Nicolas saisit Alexandre).
    ...((delegateGuestBookingsRaw ?? []) as DelegateBookingRow[]).flatMap((b) => {
      const guestName = b.guest_name?.trim()
      if (!guestName) return []
      for (const [ownerId, candidates] of delegateNameCandidatesById) {
        if (findClosestNameMatch(guestName, candidates) !== -1) return [{ ...b, ownerId }]
      }
      return []
    }),
  ]

  const delegateProfileById = new Map((delegatePayerProfiles ?? []).map((p) => [p.id, p]))
  const delegatedStays = delegatedBookingsRaw.flatMap((b) => {
    const owner = delegateProfileById.get(b.ownerId)
    if (!owner) return []
    const ownerFamily = (owner.family_group as FamilyGroup | null) ?? 'friend'
    const ownerIndex = typeof owner.color_hue === 'number' ? owner.color_hue : fallbackIndexForName(`${owner.first_name} ${owner.last_name}`)
    const payments = b.cs_payments ?? []
    const unpaid = payments.filter((p) => p.status !== 'paid')
    return [
      {
        ownerFullName: `${owner.first_name} ${owner.last_name}`,
        ownerColor: colorForPaletteIndex(ownerFamily, ownerIndex),
        booking: { id: b.id, check_in: b.check_in, check_out: b.check_out, house_side: b.house_side, notes: b.notes },
        pending: unpaid.reduce((sum, p) => sum + Number(p.amount), 0),
        ids: unpaid.map((p) => p.id),
      },
    ]
  })

  const colorByName = new Map<string, PaletteRef>()
  // Famille de chaque compte, par id -- sert de repli ci-dessous pour un
  // accompagnant dont la famille n'a pas (encore) été enregistrée (voir
  // le repli sur celle du créateur, juste après).
  const familyById = new Map<string, FamilyGroup>()
  for (const p of allProfilesForColor ?? []) {
    if (p.family_group) familyById.set(p.id, p.family_group as FamilyGroup)
    if (typeof p.color_hue === 'number' && p.family_group) {
      colorByName.set(`${p.first_name} ${p.last_name}`.trim().toLowerCase(), {
        family: p.family_group as FamilyGroup,
        index: p.color_hue,
      })
    }
  }
  for (const g of guestPeople ?? []) {
    const key = g.name.trim().toLowerCase()
    if (colorByName.has(key) || typeof g.color_hue !== 'number') continue
    // Repli si `family_group` n'a pas (encore) été enregistré sur cette
    // entrée (ex. accompagnant saisi avant l'ajout de cette détection,
    // voir src/app/api/bookings/quick/route.ts, ensureGuestColor, qui la
    // répare désormais au prochain enregistrement touchant ce nom) : on
    // reprend la famille de la personne qui l'a saisi plutôt que de
    // retomber sur la palette "invité" par défaut, presque toujours fausse
    // pour un accompagnant réellement membre de la famille (ex. Otto).
    const family = (g.family_group as FamilyGroup | null) ?? (g.created_by ? familyById.get(g.created_by) : undefined)
    if (family) colorByName.set(key, { family, index: g.color_hue })
  }
  const resolveColor = buildColorResolver(colorByName)
  // Même correspondance, mais renvoie la référence de palette (famille +
  // index) plutôt que la couleur CSS prête à l'emploi — c'est ce dont
  // NextStayCard a besoin pour appliquer le même calcul
  // (colorForPaletteIndex) que le reste du site.
  const resolvePaletteRef = (guestName: string): PaletteRef =>
    colorByName.get(guestName.trim().toLowerCase()) ?? { family: 'friend', index: fallbackIndexForName(guestName) }

  // "check_out >= aujourd'hui" plutôt que "check_in >= aujourd'hui" : un
  // séjour en cours (déjà commencé, pas encore terminé) doit rester ici
  // pour afficher la bannière "... EN COURS" (demandé par Nicolas le
  // 23/09/2026) plutôt que de disparaître de ce widget dès le jour
  // d'arrivée.
  const todayISOForReserver = new Date().toISOString().slice(0, 10)
  const myFutureBookings = (myBookings ?? []).filter((b) => b.check_out >= todayISOForReserver)
  // Candidats de correspondance pour "c'est en réalité SON PROPRE
  // séjour" -- même tolérance (accents/fautes de frappe) que partout
  // ailleurs (cs-balance.ts, checkout/route.ts, dashboard/page.tsx).
  // Remonté ici (avant myOwnBookings) depuis sa place d'origine plus bas,
  // pour pouvoir aussi s'en servir dans le calcul de myOwnBookings.
  const myNameCandidatesForFamily = [profile.first_name, `${profile.first_name} ${profile.last_name}`]
  // Correctif du 02/11/2026 (signalé par Aurélie : déjà avec un séjour en
  // cours dans le widget principal, elle a dû passer par "Ajouter un
  // séjour" -- donc taper SON PROPRE nom comme accompagnant -- pour
  // saisir un second séjour personnel, faute d'un autre moyen de le
  // faire) : un séjour "auto-étiqueté" à son propre nom reste bien SON
  // séjour -- jamais un accompagnant -- voir isMyOwnBooking.
  const isMyOwnBooking = (b: { guest_name?: string | null }) =>
    !b.guest_name || findClosestNameMatch(b.guest_name, myNameCandidatesForFamily) !== -1
  // Tous les séjours à venir (ou en cours) du titulaire lui-même, pas
  // seulement le premier (demandé par Aurélie le 26/10/2026 : cliquer sur
  // la bande colorée d'un de ses autres séjours, ex. celui de décembre,
  // doit faire basculer le widget sur celui-ci -- voir
  // PlanningPageClient.tsx, selectedOwnBookingId). Déjà triés par
  // check_in croissant (ordre de la requête myBookings plus haut). Inclut
  // désormais aussi un séjour auto-étiqueté (isMyOwnBooking ci-dessus) :
  // une fois le séjour en cours (ex. octobre) terminé, celui-ci (ex.
  // décembre) devient le nouveau "myOwnBookings[0]" -- donc la nouvelle
  // "Votre prochain séjour" par défaut -- au lieu de rester invisible,
  // confondu avec un accompagnant.
  const myOwnBookings = myFutureBookings.filter(isMyOwnBooking)
  // Même séjours d'accompagnants que ci-dessus, mais saisis par un autre
  // membre de la famille nucléaire plutôt que par le titulaire lui-même
  // (voir familyGuestBookings et le commentaire qui l'accompagne plus
  // haut). Exclus (27/10/2026, rectification d'Aurélie, même règle que
  // src/lib/cs-balance.ts) : ceux dont le nom correspond en réalité au
  // titulaire DU COMPTE QUI L'A SAISI (son propre séjour, étiqueté par
  // erreur avec un guest_name -- jamais un "accompagnant", jamais
  // partagé), et ceux dont le nom correspond au titulaire DU COMPTE QUI
  // REGARDE (déjà son propre séjour, voir myOwnBookings/sa propre
  // pastille CS, jamais compté comme "accompagnant" en plus).
  const familyGuestFutureBookings = (familyGuestBookings ?? []).filter((b) => {
    if (b.check_out < todayISOForReserver) return false
    const g = b.guest_name?.trim()
    if (!g) return false
    const registrantCandidates = familyMemberNameCandidatesById.get(b.user_id)
    if (registrantCandidates && findClosestNameMatch(g, registrantCandidates) !== -1) return false
    return findClosestNameMatch(g, myNameCandidatesForFamily) === -1
  })
  // Correctif du 02/11/2026 : un séjour auto-étiqueté à son propre nom
  // (isMyOwnBooking) est désormais exclu d'ici -- déjà compté dans
  // myOwnBookings ci-dessus, jamais affiché en plus comme un
  // accompagnant (même principe que l'exclusion symétrique ci-dessus
  // pour familyGuestFutureBookings).
  const guestFutureBookings = [
    ...myFutureBookings.filter((b) => b.guest_name && !isMyOwnBooking(b)),
    ...familyGuestFutureBookings,
  ]
    .sort((a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime())
    .map((b) => {
      const ref = b.guest_name ? resolvePaletteRef(b.guest_name) : null
      return { ...b, color_hue: ref?.index ?? null, color_family: ref?.family ?? null }
    })

  // Valeurs suggérées pour un NOUVEL accompagnant pas encore saisi
  // (27/10/2026, demande d'Aurélie : "si tu as le renseignement, coche
  // déjà... sa tranche d'âge" -- étendu ici au côté de maison) : reprend,
  // pour un nom déjà vu (tolérance aux fautes de frappe, voir
  // NextStayCard.tsx), la tranche d'âge et le côté de maison de son
  // séjour le plus récent -- qu'il ait été saisi par le titulaire de ce
  // compte (myBookings, tout l'historique, pas seulement les séjours à
  // venir) ou par un autre membre de sa famille nucléaire
  // (familyGuestBookings, ex. Otto saisi aussi bien par Nicolas que par
  // Aurélie). Simple repli d'affichage côté client (voir
  // NextStayCard.tsx) : n'importe quel champ reste modifiable avant
  // d'enregistrer.
  const guestNameDefaults: Record<string, { ageBracket: 'child' | 'adult'; houseSide: HouseSide }> = {}
  const guestHistoryBookings = [...(myBookings ?? []), ...(familyGuestBookings ?? [])].sort(
    (a, b) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime()
  )
  for (const b of guestHistoryBookings as { guest_name?: string | null; house_side?: HouseSide | null; age_bracket?: 'child' | 'adult' | null }[]) {
    const key = b.guest_name?.trim()
    if (!key || guestNameDefaults[key] || !b.house_side) continue // déjà le plus récent pour ce nom (tri ci-dessus)
    guestNameDefaults[key] = { ageBracket: b.age_bracket ?? 'adult', houseSide: b.house_side }
  }

  // Widget "Votre historique" (01/11/2026, demande d'Aurelie) : un
  // widget par personne (jamais un seul regroupe pour toute la famille),
  // couleur = color_hue de la personne, listant ses sejours PASSES
  // (check_out < aujourd'hui) du plus recent au plus ancien, en lecture
  // seule -- seule la pastille CS de chaque ligne est actionnable (voir
  // StaysHistoryWidget.tsx).
  type RawHistoryBooking = {
    id: string
    check_in: string
    check_out: string
    guest_name?: string | null
    cs_payments?: { id: string; amount: number; status: string }[] | null
  }
  const toHistoryStay = (b: RawHistoryBooking) => {
    const payments = b.cs_payments ?? []
    const unpaid = payments.filter((p) => p.status !== 'paid')
    return {
      id: b.id,
      checkIn: b.check_in,
      checkOut: b.check_out,
      pending: unpaid.reduce((sum, p) => sum + Number(p.amount), 0),
      ids: unpaid.map((p) => p.id),
    }
  }
  const sortPastDesc = (stays: ReturnType<typeof toHistoryStay>[]) =>
    stays.sort((a, b) => b.checkOut.localeCompare(a.checkOut))

  const ownPastStays = sortPastDesc(
    ((myBookings ?? []) as RawHistoryBooking[])
      // isMyOwnBooking (02/11/2026) : couvre aussi un séjour auto-étiqueté
      // à son propre nom (voir le grand correctif plus haut) -- doit
      // atterrir dans SON historique, pas disparaître ni être compté
      // ailleurs.
      .filter((b) => isMyOwnBooking(b) && b.check_out < todayISOForReserver)
      .map(toHistoryStay)
  )
  const ownHistoryColor = colorForPaletteIndex(
    profile.family_group,
    typeof profile.color_hue === 'number' ? profile.color_hue : fallbackIndexForName(`${profile.first_name} ${profile.last_name}`)
  )

  // Enfants sans compte (has_login = false) de la meme famille nucleaire :
  // leur "sejour" n'existe qu'en tant qu'accompagnant (guest_name) saisi
  // par le titulaire lui-meme OU par un autre membre de la famille
  // nucleaire -- voir guestHistoryBookings ci-dessus, qui couvre deja les
  // deux. "Historique de <prenom>" apparait ainsi chez CHAQUE parent
  // ayant un vrai compte (puisque ce calcul tourne independamment sur la
  // page de chacun), sans lien ni table supplementaire.
  const loginlessChildren = otherFamilyMembers.filter((m) => !m.has_login)
  const historyWidgets = [
    { key: 'own', label: 'Votre historique', color: ownHistoryColor, stays: ownPastStays },
    ...loginlessChildren.map((child) => {
      const nameCandidates = [child.first_name, `${child.first_name} ${child.last_name}`]
      const stays = sortPastDesc(
        (guestHistoryBookings as RawHistoryBooking[])
          .filter((b) => {
            const g = b.guest_name?.trim()
            return !!g && b.check_out < todayISOForReserver && findClosestNameMatch(g, nameCandidates) !== -1
          })
          .map(toHistoryStay)
      )
      const childFamily = (child.family_group as FamilyGroup | null) ?? profile.family_group
      const childColor = colorForPaletteIndex(
        childFamily,
        typeof child.color_hue === 'number' ? child.color_hue : fallbackIndexForName(`${child.first_name} ${child.last_name}`)
      )
      return { key: child.id, label: `Historique de ${child.first_name}`, color: childColor, stays }
    }),
  ]

  const realBookings: PlanningBooking[] = (bookings ?? []).map((b) => {
    const roomsField = (b as { rooms?: { name: string } | { name: string }[] | null }).rooms
    const roomLabel = Array.isArray(roomsField) ? roomsField[0]?.name ?? null : roomsField?.name ?? null

    const profilesField = (
      b as {
        profiles?:
          | { first_name: string; last_name: string; family_group: string; color_hue?: number; date_of_birth?: string | null }
          | { first_name: string; last_name: string; family_group: string; color_hue?: number; date_of_birth?: string | null }[]
          | null
      }
    ).profiles
    const profileObj = Array.isArray(profilesField) ? profilesField[0] : profilesField

    return {
      id: b.id,
      // Pour savoir qui peut éditer ce séjour depuis le planning (voir
      // canEditBooking dans PlanningView.tsx : son titulaire, ou un admin).
      user_id: b.user_id,
      check_in: b.check_in,
      check_out: b.check_out,
      guest_name: b.guest_name,
      house_side: b.house_side ?? null,
      room_label: roomLabel,
      // Affichée au clic sur un séjour qui n'est pas le tien (demandé par
      // Nicolas le 27/09/2026) — voir PlanningView.tsx, revealedBookingId.
      notes: b.notes ?? null,
      // Tranche d'age memorisee (26/10/2026, voir
      // migration_booking_age_bracket.sql) -- lue directement depuis la
      // colonne (select('*', ...) ci-dessus l'inclut deja).
      age_bracket: (b as { age_bracket?: 'child' | 'adult' | null }).age_bracket ?? null,
      profiles: profileObj
        ? {
            first_name: profileObj.first_name,
            last_name: profileObj.last_name,
            family_group: profileObj.family_group,
            date_of_birth: profileObj.date_of_birth ?? null,
          }
        : null,
      color: resolveColor(b.guest_name ?? null, profileObj?.family_group as FamilyGroup | undefined, profileObj?.color_hue),
    }
  })

  const planningBookings = realBookings
  const planningEvents = events ?? []

  return (
    <div className="space-y-6">
      {/* Historique du widget "Prochain séjour" sur cet onglet (voir
          ReserverSejour.tsx) : ajouté le 19/09/2026 derrière un bouton
          "Réserver un séjour" qui menait à /dashboard/reserver (ancien
          formulaire BookingForm) ; le 21/09/2026, ce bouton a d'abord
          arrêté de naviguer pour à la place déplier directement ici le
          widget "Prochain séjour + Contribution séjour" qui vivait jusque-là sur
          la page d'accueil (demandé par Nicolas) ; puis, le même jour,
          Aurélie a demandé de retirer ce bouton entièrement ("elle n'est
          plus utile") — le widget s'affiche donc maintenant directement dès
          l'arrivée sur l'onglet, sans étape intermédiaire. */}
      <PlanningPageClient
        profile={profile}
        myOwnBookings={myOwnBookings}
        guestFutureBookings={guestFutureBookings}
        initialCsBalance={initialCsBalance}
        initialPlanningBookings={planningBookings}
        planningEvents={planningEvents}
        currentUserId={user.id}
        guestDefaults={guestNameDefaults}
        familyMembers={otherFamilyMembers}
        delegatedStays={delegatedStays}
      />

      {/* Widget "Votre historique" (01/11/2026, demande d'Aurelie) : un
          par personne (titulaire + chaque enfant sans compte de sa
          famille nucleaire), voir historyWidgets plus haut et
          StaysHistoryWidget.tsx -- place sous le widget "Reserver un
          sejour", dans l'ordre meme ou chacun a ete demande. */}
      {historyWidgets.map((w) => (
        <StaysHistoryWidget key={w.key} label={w.label} personColor={w.color} stays={w.stays} />
      ))}
    </div>
  )
}
