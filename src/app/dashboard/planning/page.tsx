import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PlanningBooking, PlanningEvent } from '@/components/planning/PlanningView'
import { PlanningPageClient } from '@/components/planning/PlanningPageClient'
import { colorForName, colorForPaletteIndex, fallbackIndexForName } from '@/lib/colors'
import type { FamilyGroup } from '@/types'
import { computeTsBalance } from '@/lib/ts-balance'

// ============================================================
// DONNÉES DE TEST — mois d'août 2026 uniquement, pour travailler la mise
// en forme du planning avec Aurélie (demandé le 18/09/2026, à partir
// d'une capture d'écran de son tableau Excel d'août). Ces séjours et
// événements sont codés en dur ici : aucun appel à Supabase, donc rien
// n'est écrit en base et rien n'apparaît ailleurs dans le site (page
// d'accueil, Membres, etc.) — uniquement sur cette page, et uniquement
// en développement (jamais en production, voir isDev ci-dessous).
// Noms volontairement fictifs pour ne pas mélanger avec de vrais comptes.
// À RETIRER une fois la mise en forme validée avec Aurélie.
// ============================================================
const isDev = process.env.NODE_ENV !== 'production'

const TEST_BOOKINGS: PlanningBooking[] = [
  // --- Lalande ---
  { id: 'test-1a', check_in: '2026-08-04', check_out: '2026-08-13', guest_name: 'Nico, Auré & Otto', house_side: 'lalande', room_label: 'Colombier + 2 enfants' },
  { id: 'test-1b', check_in: '2026-08-23', check_out: '2026-08-28', guest_name: 'Nico, Auré & Otto', house_side: 'lalande', room_label: 'Colombier + 2 enfants' },
  { id: 'test-2a', check_in: '2026-08-04', check_out: '2026-08-09', guest_name: 'Guy', house_side: 'lalande', room_label: 'Angle' },
  { id: 'test-2b', check_in: '2026-08-21', check_out: '2026-08-30', guest_name: 'Guy', house_side: 'lalande', room_label: 'Angle' },
  { id: 'test-3', check_in: '2026-08-10', check_out: '2026-08-16', guest_name: 'Margaux, Virgil & Alma', house_side: 'lalande', room_label: 'Marguerite + enfant' },
  { id: 'test-4', check_in: '2026-08-24', check_out: '2026-08-28', guest_name: 'Mathieu, Sabra & César', house_side: 'lalande', room_label: null },
  { id: 'test-5', check_in: '2026-08-08', check_out: '2026-08-16', guest_name: 'Emma, Guilhem, Agathe, Zoé & Oscar', house_side: 'lalande', room_label: 'Patio + Mezzanine + Frêne' },
  { id: 'test-6', check_in: '2026-08-08', check_out: '2026-08-16', guest_name: 'Catherine', house_side: 'lalande', room_label: 'Nord 1' },
  { id: 'test-7', check_in: '2026-08-09', check_out: '2026-08-13', guest_name: 'Jérôme', house_side: 'lalande', room_label: 'Bureau' },
  { id: 'test-8', check_in: '2026-08-09', check_out: '2026-08-14', guest_name: 'Antoine, Sarah & Joanna', house_side: 'lalande', room_label: 'Atelier + enfant' },
  { id: 'test-9', check_in: '2026-08-09', check_out: '2026-08-16', guest_name: 'Mathieu, Sabine, Juliette & Charlotte', house_side: 'lalande', room_label: 'Mamie + Frêne' },
  { id: 'test-10', check_in: '2026-08-10', check_out: '2026-08-16', guest_name: 'Nicole & Claude', house_side: 'lalande', room_label: 'Oiseau' },
  { id: 'test-11', check_in: '2026-08-09', check_out: '2026-08-16', guest_name: 'Olivier', house_side: 'lalande', room_label: 'Nord 2' },
  { id: 'test-12', check_in: '2026-08-09', check_out: '2026-08-16', guest_name: 'Camille & Adèle', house_side: 'lalande', room_label: 'Canat 1er + Frêne' },
  { id: 'test-13a', check_in: '2026-08-01', check_out: '2026-08-08', guest_name: 'Alex', house_side: 'lalande', room_label: null },
  { id: 'test-13b', check_in: '2026-08-17', check_out: '2026-08-31', guest_name: 'Alex', house_side: 'lalande', room_label: null },

  // --- Canat ---
  { id: 'test-14', check_in: '2026-08-17', check_out: '2026-08-30', guest_name: 'Eva, Gui, Sofia & Viktor', house_side: 'canat', room_label: null },
  { id: 'test-15', check_in: '2026-08-04', check_out: '2026-08-13', guest_name: 'Anto, Xa, Anaïs & Val', house_side: 'canat', room_label: null },
  { id: 'test-16', check_in: '2026-08-01', check_out: '2026-08-30', guest_name: 'Louis & Roméo', house_side: 'canat', room_label: null },
  { id: 'test-17a', check_in: '2026-08-01', check_out: '2026-08-16', guest_name: 'JP & Brigitte', house_side: 'canat', room_label: null },
  { id: 'test-17b', check_in: '2026-08-19', check_out: '2026-08-31', guest_name: 'JP & Brigitte', house_side: 'canat', room_label: null },
  { id: 'test-18', check_in: '2026-08-09', check_out: '2026-08-15', guest_name: 'Amicie', house_side: 'canat', room_label: null },
  { id: 'test-19', check_in: '2026-08-07', check_out: '2026-08-13', guest_name: 'Alex', house_side: 'canat', room_label: null },
  { id: 'test-20', check_in: '2026-08-09', check_out: '2026-08-18', guest_name: 'Audrey', house_side: 'canat', room_label: null },
]

const TEST_EVENTS: PlanningEvent[] = [
  { id: 'test-e1', title: 'Pat', start_date: '2026-08-10', end_date: '2026-08-11' },
  { id: 'test-e2', title: 'Marché', start_date: '2026-08-11', end_date: '2026-08-11' },
  { id: 'test-e3', title: 'Potiers', start_date: '2026-08-12', end_date: '2026-08-12' },
  { id: 'test-e4', title: 'Sérénades', start_date: '2026-08-13', end_date: '2026-08-16' },
]

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')

  // Résolution des couleurs par nom (voir buildColorResolver plus haut) :
  // remontée ici, avant le calcul de guestFutureBookings, pour pouvoir
  // attacher une teinte à chaque séjour d'accompagnant — sert à colorer
  // le fond des bannières "Prochain séjour X" dans NextStayCard.tsx
  // (demandé par Nicolas le 29/09/2026 : la bannière reprend la couleur
  // déjà attribuée à la personne, la même que sur le planning).
  const { data: allProfilesForColor } = await supabase
    .from('profiles')
    .select('first_name, last_name, family_group, color_hue')

  const { data: guestPeople } = await supabase
    .from('guest_people')
    .select('name, family_group, color_hue')

  const colorByName = new Map<string, PaletteRef>()
  for (const p of allProfilesForColor ?? []) {
    if (typeof p.color_hue === 'number' && p.family_group) {
      colorByName.set(`${p.first_name} ${p.last_name}`.trim().toLowerCase(), {
        family: p.family_group as FamilyGroup,
        index: p.color_hue,
      })
    }
  }
  for (const g of guestPeople ?? []) {
    const key = g.name.trim().toLowerCase()
    if (!colorByName.has(key) && typeof g.color_hue === 'number' && g.family_group) {
      colorByName.set(key, { family: g.family_group as FamilyGroup, index: g.color_hue })
    }
  }
  const resolveColor = buildColorResolver(colorByName)
  // Même correspondance, mais renvoie la référence de palette (famille +
  // index) plutôt que la couleur CSS prête à l'emploi — c'est ce dont
  // NextStayCard a besoin pour appliquer le même calcul
  // (colorForPaletteIndex) que le reste du site.
  const resolvePaletteRef = (guestName: string): PaletteRef =>
    colorByName.get(guestName.trim().toLowerCase()) ?? { family: 'friend', index: fallbackIndexForName(guestName) }

  // Séjour à venir du titulaire du compte + ceux déjà saisis pour des
  // accompagnants (bouton "+") : mêmes données que l'ex-widget de
  // l'accueil, pour alimenter ReserverSejour ci-dessous (widget migré ici
  // le 21/09/2026, demandé par Nicolas).
  const { data: myBookings } = await supabase
    .from('bookings')
    .select('*, ts_payments(*)')
    .eq('user_id', user.id)
    .order('check_in', { ascending: true })

  // "check_out >= aujourd'hui" plutôt que "check_in >= aujourd'hui" : un
  // séjour en cours (déjà commencé, pas encore terminé) doit rester ici
  // pour afficher la bannière "... EN COURS" (demandé par Nicolas le
  // 23/09/2026) plutôt que de disparaître de ce widget dès le jour
  // d'arrivée.
  const todayISOForReserver = new Date().toISOString().slice(0, 10)
  const myFutureBookings = (myBookings ?? []).filter((b) => b.check_out >= todayISOForReserver)
  const nextBooking = myFutureBookings.find((b) => !b.guest_name) ?? null
  const guestFutureBookings = myFutureBookings
    .filter((b) => b.guest_name)
    .sort((a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime())
    .map((b) => {
      const ref = b.guest_name ? resolvePaletteRef(b.guest_name) : null
      return { ...b, color_hue: ref?.index ?? null, color_family: ref?.family ?? null }
    })

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, profiles(first_name, last_name, family_group, color_hue, date_of_birth), rooms(name)')
    .order('check_in', { ascending: true })

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .order('start_date', { ascending: true })

  // Solde de taxe de séjour "à la manière d'un solde bancaire" (demandé
  // par Aurélie le 22/09/2026) : voir computeTsBalance pour le détail —
  // reparti entre le solde propre du titulaire ("Votre solde TS", y
  // compris ses séjours saisis par quelqu'un d'autre sous son nom) et un
  // solde par accompagnant pour lequel ce compte a saisi un séjour ("TS -
  // <prénom>"). Rafraîchi ensuite en direct via /api/ts-balance (même
  // fonction) sans recharger la page.
  const initialTsBalance = await computeTsBalance(supabase, user.id)

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

  const planningBookings = isDev ? [...realBookings, ...TEST_BOOKINGS] : realBookings
  const planningEvents = isDev ? [...(events ?? []), ...TEST_EVENTS] : (events ?? [])

  return (
    <div className="space-y-6">
      {/* Historique du widget "Prochain séjour" sur cet onglet (voir
          ReserverSejour.tsx) : ajouté le 19/09/2026 derrière un bouton
          "Réserver un séjour" qui menait à /dashboard/reserver (ancien
          formulaire BookingForm) ; le 21/09/2026, ce bouton a d'abord
          arrêté de naviguer pour à la place déplier directement ici le
          widget "Prochain séjour + Taxe de séjour" qui vivait jusque-là sur
          la page d'accueil (demandé par Nicolas) ; puis, le même jour,
          Aurélie a demandé de retirer ce bouton entièrement ("elle n'est
          plus utile") — le widget s'affiche donc maintenant directement dès
          l'arrivée sur l'onglet, sans étape intermédiaire. */}
      <PlanningPageClient
        profile={profile}
        nextBooking={nextBooking}
        guestFutureBookings={guestFutureBookings}
        initialTsBalance={initialTsBalance}
        initialPlanningBookings={planningBookings}
        planningEvents={planningEvents}
        currentUserId={user.id}
        isAdmin={profile.role === 'admin'}
      />
    </div>
  )
}
