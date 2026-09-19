import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PlanningView, PlanningBooking, PlanningEvent } from '@/components/planning/PlanningView'
import { colorForName, oklchForHue } from '@/lib/colors'

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
function buildColorResolver(colorByName: Map<string, number>) {
  return function resolveColor(guestName: string | null, ownerHue: number | null | undefined): string {
    if (guestName) {
      const hue = colorByName.get(guestName.trim().toLowerCase())
      if (hue !== undefined) return oklchForHue(hue)
      return colorForName(guestName)
    }
    if (ownerHue !== null && ownerHue !== undefined) return oklchForHue(ownerHue)
    return colorForName('Séjour')
  }
}

export default async function PlanningPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, profiles(first_name, last_name, family_group, color_hue), rooms(name)')
    .order('check_in', { ascending: true })

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .order('start_date', { ascending: true })

  const { data: allProfilesForColor } = await supabase
    .from('profiles')
    .select('first_name, last_name, color_hue')

  const { data: guestPeople } = await supabase
    .from('guest_people')
    .select('name, color_hue')

  const colorByName = new Map<string, number>()
  for (const p of allProfilesForColor ?? []) {
    if (typeof p.color_hue === 'number') {
      colorByName.set(`${p.first_name} ${p.last_name}`.trim().toLowerCase(), p.color_hue)
    }
  }
  for (const g of guestPeople ?? []) {
    const key = g.name.trim().toLowerCase()
    if (!colorByName.has(key) && typeof g.color_hue === 'number') colorByName.set(key, g.color_hue)
  }
  const resolveColor = buildColorResolver(colorByName)

  const realBookings: PlanningBooking[] = (bookings ?? []).map((b) => {
    const roomsField = (b as { rooms?: { name: string } | { name: string }[] | null }).rooms
    const roomLabel = Array.isArray(roomsField) ? roomsField[0]?.name ?? null : roomsField?.name ?? null

    const profilesField = (
      b as { profiles?: { first_name: string; last_name: string; family_group: string; color_hue?: number } | { first_name: string; last_name: string; family_group: string; color_hue?: number }[] | null }
    ).profiles
    const profileObj = Array.isArray(profilesField) ? profilesField[0] : profilesField

    return {
      id: b.id,
      check_in: b.check_in,
      check_out: b.check_out,
      guest_name: b.guest_name,
      house_side: b.house_side ?? null,
      room_label: roomLabel,
      profiles: profileObj
        ? { first_name: profileObj.first_name, last_name: profileObj.last_name, family_group: profileObj.family_group }
        : null,
      color: resolveColor(b.guest_name ?? null, profileObj?.color_hue),
    }
  })

  const planningBookings = isDev ? [...realBookings, ...TEST_BOOKINGS] : realBookings
  const planningEvents = isDev ? [...(events ?? []), ...TEST_EVENTS] : (events ?? [])

  return (
    <div className="space-y-6">
      {/* Point 3 des remarques de Nicolas (19/09/2026) : la refonte du menu
          (2 lignes de 3 onglets, montage d'Aurélie) avait laissé la page
          "Réserver" orpheline — elle existait toujours mais plus aucun lien
          n'y menait. Plutôt que d'ajouter un 7e onglet au menu, on la
          raccroche ici : le planning est l'endroit où on regarde les dates
          avant de réserver. Le widget "Prochain séjour" de l'accueil reste
          la voie rapide ; cette page reste la réservation complète
          (chambres, accompagnants, calcul détaillé de la taxe de séjour). */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Planning</h1>
        <Link
          href="/dashboard/reserver"
          className="inline-flex h-9 items-center rounded-lg bg-foreground px-3.5 text-sm font-medium text-background transition-opacity hover:opacity-85"
        >
          Réserver un séjour
        </Link>
      </div>
      <PlanningView bookings={planningBookings} events={planningEvents} />
    </div>
  )
}
