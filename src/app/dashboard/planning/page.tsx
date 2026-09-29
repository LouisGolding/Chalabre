import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PlanningBooking } from '@/components/planning/PlanningView'
import { PlanningPageClient } from '@/components/planning/PlanningPageClient'
import { colorForName, colorForPaletteIndex, fallbackIndexForName } from '@/lib/colors'
import type { FamilyGroup } from '@/types'
import { computeTsBalance } from '@/lib/ts-balance'

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
    .select('id, first_name, last_name, family_group, color_hue')

  const { data: guestPeople } = await supabase
    .from('guest_people')
    .select('name, family_group, color_hue, created_by')

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

  const planningBookings = realBookings
  const planningEvents = events ?? []

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
