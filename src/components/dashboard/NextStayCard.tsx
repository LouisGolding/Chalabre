'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { differenceInYears, parseISO } from 'date-fns'
import {
  actionPillClass,
  calculateCSRate,
  calculateTotalCS,
  cn,
  firstNameOnly,
  formatCurrency,
  formatFrenchDateInput,
  normalizeName,
  stayPhase,
  viewTogglePillClass,
} from '@/lib/utils'
import { FamilyGroup, HouseSide, Profile, CSPayment } from '@/types'
import { CSBalancePayButton } from '@/components/payment/CSBalancePayButton'
import { ChevronDown, Minus } from 'lucide-react'
import type { CsBalanceResult, CsGuestBalance } from '@/lib/cs-balance'
import { colorForPaletteIndex, coloredTextureStyle, fallbackIndexForName, shouldUseWhiteText } from '@/lib/colors'
import { findClosestNameMatch } from '@/lib/fuzzy-name'

type AgeBracket = 'child' | 'adult'

// "Option famille" (30/10/2026, demande d'Aurélie) : un autre membre de
// la même famille nucléaire (profiles.nuclear_family, voir
// src/lib/nuclear-family.ts), pour préremplir automatiquement sa propre
// bannière quand le titulaire active l'option -- voir
// otherFamilyMembersForWidget dans planning/page.tsx pour le calcul
// côté serveur.
export interface FamilyMemberOption {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  color_hue: number | null
  family_group: string | null
}

// Age plausible a la date donnee (entre 0 et 110 ans) -- une date de
// naissance hors de cette plage (ex. dans le futur, cas d'une erreur de
// saisie a l'inscription deja signalee a Louis pour Virgil Jullien et
// Mathieu Lalande le 30/10/2026) n'est PAS consideree comme connue : on
// revient alors au choix manuel 0-16/17+ plutot que d'afficher/calculer
// un montant de contribution sejour silencieusement faux.
function plausibleAgeAt(dobIso: string, refIso: string): number | null {
  const age = differenceInYears(new Date(refIso + 'T00:00:00'), parseISO(dobIso))
  return age >= 0 && age <= 110 ? age : null
}

// Refonte du widget "Prochain séjour" en bannières dépliables (demandée
// par Nicolas le 23/09/2026, pendant qu'on réglait le format mobile
// ensemble) : chaque séjour (le sien, puis un par accompagnant) a
// désormais sa propre bannière — titre évolutif à gauche selon que le
// séjour n'existe pas encore / est à venir / est en cours, pastille de
// solde CS toujours visible à droite (cliquable, lien de paiement groupé
// — voir CSBalancePayButton) — et ne se déplie qu'au clic sur le titre.
// Remplace l'ancien enregistrement automatique (debounce à chaque frappe)
// par un enregistrement explicite ("Valider"/"Modifier"), pour éviter
// qu'un séjour se retrouve à moitié saisi en base pendant la frappe.

interface BookingData {
  id: string
  check_in: string
  check_out: string
  guest_name?: string | null
  house_side?: HouseSide | null
  notes?: string | null
  cs_payments?: CSPayment[]
  // Couleur de cet occupant (voir src/lib/colors.ts -- depuis le 29/09/2026,
  // color_hue est un index de palette, a lire avec color_family), resolue
  // cote serveur -- sert a colorer le fond de sa banniere ci-dessous.
  color_hue?: number | null
  color_family?: FamilyGroup | null
  // Tranche d'age choisie pour ce sejour (0-16/17+), memorisee en base
  // depuis le 26/10/2026 (voir migration_booking_age_bracket.sql) -- sert
  // a pre-remplir fieldsSnapshot ci-dessous sans deviner "adulte" par
  // defaut pour un accompagnant a chaque reouverture.
  age_bracket?: 'child' | 'adult' | null
}

export interface SavedStayInfo {
  id: string
  check_in: string
  check_out: string
  guest_name: string | null
  house_side: HouseSide | null
  age_bracket: 'child' | 'adult'
  colorHue: number | null
  colorFamily: FamilyGroup | null
}

interface NextStayCardProps {
  profile: Profile
  // Séjour à venir (ou en cours) du titulaire du compte, ou null.
  booking: BookingData | null
  // Séjours déjà saisis pour des accompagnants (bannière "Ajouter un
  // séjour"), le cas échéant.
  guestBookings?: BookingData[]
  // Solde CS (le sien + un par accompagnant déjà saisi), pour les
  // pastilles des bannières — voir ReserverSejour.tsx pour le calcul et
  // le rafraîchissement.
  csBalance: CsBalanceResult
  onBookingSaved?: (booking: SavedStayInfo) => void
  onBookingDeleted?: (bookingId: string) => void
  // Séjours déjà validés mais en cours de modification (champs touchés,
  // pas encore revalidés) : leur ligne ne doit pas rester affichée sur le
  // planning tant qu'elle n'est pas revalidée (demandé par Nicolas le
  // 23/09/2026 — "tu effaces automatiquement tout ce qui concerne ce
  // séjour"), sans rien supprimer réellement en base. Ce callback remonte
  // la liste à jour des identifiants de séjour à masquer du planning.
  onHiddenBookingIdsChange?: (ids: string[]) => void
  // Tranche d'âge + côté de maison du séjour le plus récent déjà saisi
  // pour chaque accompagnant connu (27/10/2026, demande d'Aurélie : "si
  // tu as le renseignement, coche déjà... sa tranche d'âge" — ici étendu
  // au côté de maison) -- calculé côté serveur (planning/page.tsx) à
  // partir de l'historique des séjours (le sien + ceux de sa famille
  // nucléaire), indexé par le nom tel qu'enregistré. Pré-remplit
  // "Ajouter un séjour" dès que le nom tapé correspond (tolérance aux
  // fautes de frappe, voir findClosestNameMatch) à un nom déjà vu --
  // reste modifiable avant d'enregistrer.
  guestDefaults?: Record<string, { ageBracket: AgeBracket; houseSide: HouseSide }>
  // "Option famille" (30/10/2026) : voir FamilyMemberOption plus haut.
  // Absent ou vide => pas de bascule "Famille" affichee (compte sans
  // famille nucleaire enregistree, ou seul dans la sienne).
  familyMembers?: FamilyMemberOption[]
  // Paiement delegue (01/11/2026, cas unique Alexandre -> Guy, voir
  // DelegatedStay plus haut) : un widget en lecture seule par sejour
  // affiche en plus des siens propres, pour que ce compte puisse regler
  // la contribution sejour d'un autre a sa place. Absent ou vide => rien
  // n'est affiche (cas normal, tout le monde sauf Guy).
  delegatedStays?: DelegatedStay[]
}

// Paiement delegue (01/11/2026, demande d'Aurelie : "le sejour
// d'Alexandre doit apparaitre comme un widget entier sur le tableau de
// bord de Guy [...] pour que Guy puisse payer a sa place") -- voir
// profiles.cs_payer_id (supabase/migration_profiles_ts_payer_delegate.sql)
// et planning/page.tsx pour le calcul cote serveur. Traite comme un cas
// unique (pas de bascule "famille" generale) : contrairement a
// FamilyMemberOption plus haut, chaque sejour (passe, en cours ou a
// venir) d'Alexandre devient ici son propre widget, pas seulement le
// prochain -- voir DelegatedStayBanner ci-dessous, en LECTURE SEULE (pas
// d'edition des dates depuis le compte de Guy, seul le reglement de la
// contribution sejour est actionnable).
export interface DelegatedStay {
  ownerFullName: string
  ownerColor: string
  booking: { id: string; check_in: string; check_out: string; house_side: HouseSide | null; notes: string | null }
  pending: number
  ids: string[]
}

function findGuestBucket(csBalance: CsBalanceResult, fullName: string | null): CsGuestBalance | null {
  if (!fullName) return null
  const target = normalizeName(fullName)
  return csBalance.guests.find((g) => normalizeName(g.name) === target) ?? null
}

// Montant compact ("90" ou "90,50"), sans le formatage de formatCurrency
// (espace + decimales systematiques) -- meme convention que ContributionSejourPill,
// pour que "CS : -90€" tienne sur une seule ligne a cote du titre (demande
// par Nicolas le 29/09/2026, pastille visible widget ferme comme ouvert).
function compactAmount(amount: number): string {
  return Number.isInteger(amount) ? `${amount}` : amount.toFixed(2).replace('.', ',')
}
function soldeLabel(pending: number) {
  return pending > 0 ? `-${compactAmount(pending)}` : compactAmount(0)
}

// Pastilles de solde ("CS: X€" fermee, "Total contribution sejour: X€"
// ouverte) : encadre transparent, typo dans la couleur du widget,
// majuscules trackees. Jusqu'au 04/10/2026, le survol/clic reprenait le
// mecanisme de ContributionSejourPill.tsx sur l'accueil (le cadre se remplit de
// blanc, le texte se decoupe pour laisser deviner la photo de fond fixe
// de l'accueil) -- mais sur Planning, le fond reel n'est jamais cette
// photo (c'est le beige canson du widget), donc le survol affichait un
// carre blanc plaque, incoherent avec le reste de la page. Deux
// corrections successives de Nicolas le 04/10/2026 : d'abord cadre
// entierement transparent (aucun changement visible, juge insuffisant),
// puis aplat beige uni (`hover:bg-background`, le changement de couleur
// etait la mais sans le grain), et enfin la texture canson elle-meme en
// plus de la couleur -- d'ou la classe `pill-canson-hover` (definie dans
// globals.css, meme texture que le fond de page) ci-dessous. L'ancien
// decoupage photo du texte (propre a l'accueil, voir stayPillTextClass
// plus bas) reste retire, toujours sans objet ici. Les deux pastilles de
// solde restent toujours en gras, et gardent le rouge d'alerte sur le
// montant quand il est negatif (montant du) -- demande par Nicolas le
// 29/09/2026.
//
// Jusqu'au 04/10/2026 cette pastille etait aussi utilisee (via
// stayPillOuterClass, derivee par un simple changement de tracking) pour
// les boutons d'action "Supprimer ce sejour"/"Modifier"/"Valider"
// juste en dessous -- separe depuis que ces boutons suivent le nouveau
// style commun "pastille d'action" (actionPillClass, voir utils.ts),
// harmonise ce jour-la avec 4 autres pastilles du site (Entretien,
// Realisations). Les deux styles n'ont plus rien en commun.
export const balancePillOuterClass =
  'pill-canson-hover group inline-flex w-fit items-center gap-1.5 whitespace-nowrap border border-foreground/30 px-3 py-1.5 text-xs uppercase tracking-[0.08em] transition-colors disabled:pointer-events-none disabled:opacity-50 md:text-sm'

// Demande par Nicolas le 04/10/2026 : plus de decoupage photo au survol
// (voir stayPillOuterClass ci-dessus) -- le texte garde simplement sa
// couleur, lisible directement sur le fond canson du widget.
function stayPillTextClass(light: boolean, darkBg: boolean, extra?: string) {
  if (darkBg) return cn('transition-colors', 'text-white', extra)
  return cn('transition-colors', darkBg ? 'text-white' : light ? 'text-foreground/60' : 'text-foreground', extra)
}

// Montant d'une pastille de solde : rouge plein (pas de decoupage photo,
// pour rester bien visible) quand une somme est due, sinon meme traitement
// transparent que le reste de la pastille.
function StayPillAmount({ pending, light, darkBg }: { pending: number; light: boolean; darkBg: boolean }) {
  if (pending > 0) {
    // Le rouge d'alerte reste tel quel : suffisamment fonce pour rester
    // lisible aussi bien sur un fond clair que sur un fond de personne
    // sombre (pas de bascule en blanc sur ce cas precis).
    return <span className="font-extrabold text-red-600">{soldeLabel(pending)}€</span>
  }
  return (
    <span className={stayPillTextClass(light, darkBg, 'font-extrabold')}>
      {soldeLabel(pending)}€
    </span>
  )
}

function BalancePill({
  pending,
  ids,
  light,
  darkBg,
}: {
  pending: number
  ids: string[]
  light: boolean
  darkBg: boolean
}) {
  const content = (
    <>
      <span className={stayPillTextClass(light, darkBg, 'font-semibold')}>
        CS:
      </span>{' '}
      <StayPillAmount pending={pending} light={light} darkBg={darkBg} />
    </>
  )
  const outerClass = cn(balancePillOuterClass, darkBg && 'border-white/40')
  if (ids.length === 0) {
    return <span className={outerClass}>{content}</span>
  }
  return (
    <CSBalancePayButton ids={ids} className={outerClass}>
      {content}
    </CSBalancePayButton>
  )
}

function TotalContributionSejourStayPill({
  pending,
  ids,
  light,
  darkBg,
  label,
}: {
  pending: number
  ids: string[]
  light: boolean
  darkBg: boolean
  // "Total contribution séjour famille :" quand l'option famille est active sur
  // ce widget (30/10/2026, demande d'Aurélie) -- voir pillLabel dans
  // StayEntry, prop absente ou undefined ailleurs (texte par défaut).
  label?: string
}) {
  const inner = (
    <>
      <span className={stayPillTextClass(light, darkBg, 'font-semibold')}>
        {label ?? 'Total contribution séjour :'}
      </span>{' '}
      <StayPillAmount pending={pending} light={light} darkBg={darkBg} />
    </>
  )
  const outerClass = cn(balancePillOuterClass, darkBg && 'border-white/40')
  if (ids.length === 0) {
    return <span className={outerClass}>{inner}</span>
  }
  return (
    <CSBalancePayButton ids={ids} className={outerClass}>
      {inner}
    </CSBalancePayButton>
  )
}

// Bannière dépliable : titre à gauche (bascule le contenu au clic),
// pastille de solde à droite (clic séparé, lien de paiement). Fond
// "canson" opaque (classe .card-canson, globals.css) pour la
// bannière générique "Ajouter un séjour" -- même couleur que la
// grille d'onglets (TileNav.tsx), demandé par Nicolas le 30/09/2026.
// Le titre lui-même reste toujours en text-foreground plein, meme sur un
// fond colore (plus de variante "claire" en text-foreground/60) -- demande
// par Nicolas le 04/10/2026 : traiter ce titre exactement comme celui de
// "Partager ce qui a ete fait" (RealisationsBoard.tsx), qui n'a jamais eu
// cette distinction. Le reste du contenu deplie (pastilles de solde,
// champs, boutons) garde sa propre logique "light" via StayEntry
// -- inchangee, portee volontairement limitee au titre.
export function StayBanner({
  title,
  pill,
  isOpen,
  onToggle,
  children,
  bgColor,
}: {
  title: string
  pill: React.ReactNode
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
  // Couleur de fond du widget = la couleur deja attribuee a la personne
  // concernee (meme teinte que sur le planning, voir src/lib/colors.ts) --
  // demande par Nicolas le 29/09/2026. Absente pour la banniere generique
  // "Ajouter un sejour" (personne encore identifiee), qui garde le fond
  // "canson" opaque par defaut (.card-canson).
  bgColor?: string
}) {
  // Bascule le titre en blanc quand la couleur de fond de la banniere est
  // sombre (demande par Nicolas le 09/10/2026, apres le test du compte de
  // Guy -- voir shouldUseWhiteText dans src/lib/colors.ts pour le seuil
  // retenu et le raisonnement). N'a aucun effet pour la banniere generique
  // "Ajouter un sejour" (pas de bgColor, fond canson clair).
  const darkBg = !!bgColor && shouldUseWhiteText(bgColor)

  return (
    <div
      className={cn('rounded-xl border border-border', !bgColor && 'card-canson')}
      style={bgColor ? coloredTextureStyle(bgColor) : undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className={cn(
            'flex min-w-0 items-center gap-2 text-left text-sm md:text-base font-medium uppercase tracking-wide hover:opacity-80',
            darkBg ? 'text-white' : 'text-foreground'
          )}
        >
          <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', isOpen && 'rotate-180')} />
          <span className="truncate">{title}</span>
        </button>
        {!isOpen && pill}
      </div>
      {/* Plus de ligne de separation ni de padding haut uniforme : l'espace
          entre le titre et la pastille "Total contribution sejour" fait
          12px (8px de py-2 sur l'entete + 4px de pt-1 ici) -- entete
          reduit de 12px a 8px de hauteur le 30/09/2026 a la demande de
          Nicolas (toutes les bannieres repliees), qui avait initialement
          ete calee a 16px le 29/09/2026. */}
      {isOpen && <div className="space-y-4 px-4 pt-1 pb-4">{children}</div>}
    </div>
  )
}

export function NextStayCard({
  profile,
  booking,
  guestBookings = [],
  csBalance,
  onBookingSaved,
  onBookingDeleted,
  onHiddenBookingIdsChange,
  guestDefaults,
  familyMembers = [],
  delegatedStays = [],
}: NextStayCardProps) {
  const computedAge = differenceInYears(new Date(), parseISO(profile.date_of_birth))

  // Couleur du titulaire (voir src/lib/colors.ts) : son index de palette
  // enregistre en base (dans sa propre famille) si connu, sinon un repli
  // calcule depuis son nom (memes regles que le planning, resolveColor
  // dans planning/page.tsx).
  const ownerIndex =
    typeof profile.color_hue === 'number' ? profile.color_hue : fallbackIndexForName(`${profile.first_name} ${profile.last_name}`)
  const ownerColor = colorForPaletteIndex(profile.family_group, ownerIndex)

  const [guestEntries, setGuestEntries] = useState<
    {
      localId: string
      booking: BookingData | null
      colorHue: number | null
      colorFamily: FamilyGroup | null
      // Incrémenté pour forcer StayEntry à remonter avec ses dates à jour --
      // voir l'effet de resynchronisation plus bas (glisser sur le planning).
      remountKey: number
    }[]
  >(() =>
    guestBookings.map((b) => ({
      localId: b.id,
      booking: b,
      colorHue: typeof b.color_hue === 'number' ? b.color_hue : null,
      colorFamily: b.color_family ?? null,
      remountKey: 0,
    }))
  )
  const [primaryBooking, setPrimaryBooking] = useState<BookingData | null>(booking)

  // Pastilles 0-16/17+ masquees sur la banniere du titulaire quand sa
  // propre date de naissance est connue et plausible (demande d'Aurelie
  // le 02/11/2026 : "pas besoin d'afficher le choix" quand on a deja
  // l'info pour calculer la contribution sejour) -- meme garde-fou
  // (plausibleAgeAt, bornes 0-110) que pour les membres de la famille
  // plus bas, qui exclut deja naturellement le sentinel 1900-01-01 (age
  // calcule > 110 ans). Calculee par rapport au prochain sejour s'il y en
  // a un (coherent avec le reste du widget), sinon par rapport a
  // aujourd'hui.
  const ownerKnownAge = plausibleAgeAt(profile.date_of_birth, primaryBooking?.check_in ?? new Date().toISOString().slice(0, 10))
  const [primaryResetKey, setPrimaryResetKey] = useState(0)
  const [addSlotResetKey, setAddSlotResetKey] = useState(0)

  // Resynchronisation depuis un glisser fait directement sur une bande
  // colorée du planning (voir PlanningPageClient.handleDatesPersistedFromCalendar) :
  // les champs de StayEntry (checkIn/checkOut...) ne sont initialisés qu'une
  // fois, au montage, depuis `booking`/`guestBookings` -- un simple
  // changement de ces props ne suffit donc pas à les mettre à jour, il faut
  // remonter StayEntry (changement de `key`). On ne le fait que lorsque les
  // dates ont réellement changé (comparées à une signature mémorisée), pour
  // ne jamais remonter -- et donc refermer -- une bannière pour rien à
  // chaque re-rendu. Demandé par Nicolas le 02/10/2026 : "si je réduis la
  // bande d'Otto ... son widget doit automatiquement changer, sa contribution
  // séjour aussi".
  const primarySignatureRef = useRef(`${booking?.id ?? ''}|${booking?.check_in ?? ''}|${booking?.check_out ?? ''}`)
  useEffect(() => {
    const sig = `${booking?.id ?? ''}|${booking?.check_in ?? ''}|${booking?.check_out ?? ''}`
    if (sig === primarySignatureRef.current) return
    primarySignatureRef.current = sig
    setPrimaryBooking(booking)
    setPrimaryResetKey((k) => k + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id, booking?.check_in, booking?.check_out])

  const guestSignaturesRef = useRef(new Map(guestBookings.map((b) => [b.id, `${b.check_in}|${b.check_out}`])))
  useEffect(() => {
    setGuestEntries((prev) => {
      let changed = false
      const next = prev.map((entry) => {
        const incoming = guestBookings.find((b) => b.id === entry.localId)
        if (!incoming) return entry
        const sig = `${incoming.check_in}|${incoming.check_out}`
        if (guestSignaturesRef.current.get(entry.localId) === sig) return entry
        guestSignaturesRef.current.set(entry.localId, sig)
        changed = true
        return { ...entry, booking: incoming, remountKey: entry.remountKey + 1 }
      })
      return changed ? next : prev
    })
  }, [guestBookings])

  // Union des séjours masqués (planning) remontés par chaque bannière
  // pendant qu'elle est en cours de modification — voir StayEntry plus
  // bas. Une entrée par bannière (clé locale), fusionnées ici.
  const [hiddenByEntry, setHiddenByEntry] = useState<Record<string, string>>({})
  const setEntryHidden = (key: string, bookingId: string | null) => {
    setHiddenByEntry((prev) => {
      if (bookingId === null) {
        if (!(key in prev)) return prev
        const next = { ...prev }
        delete next[key]
        return next
      }
      if (prev[key] === bookingId) return prev
      return { ...prev, [key]: bookingId }
    })
  }
  useEffect(() => {
    onHiddenBookingIdsChange?.(Object.values(hiddenByEntry))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenByEntry])

  const handlePrimaryDeleted = (bookingId: string) => {
    onBookingDeleted?.(bookingId)
    setPrimaryBooking(null)
    setPrimaryResetKey((k) => k + 1)
  }

  const handleAddSlotSaved = (saved: SavedStayInfo) => {
    onBookingSaved?.(saved)
    setGuestEntries((prev) => [
      ...prev,
      {
        localId: saved.id,
        booking: {
          id: saved.id,
          check_in: saved.check_in,
          check_out: saved.check_out,
          guest_name: saved.guest_name,
          house_side: saved.house_side,
          age_bracket: saved.age_bracket,
        },
        colorHue: saved.colorHue,
        colorFamily: saved.colorFamily,
        remountKey: 0,
      },
    ])
    setAddSlotResetKey((k) => k + 1)
  }

  // "Option famille" (30/10/2026, demande d'Aurélie, voir la maquette
  // "Réserver en famille") : n'est proposable qu'une fois le séjour du
  // titulaire lui-même enregistré (primaryBooking non nul) -- ses dates
  // servent de référence, verrouillées pour chaque accompagnant tant que
  // l'option reste active (voir StayEntry, prop lockedDates). Remise à
  // zéro des "Retirer" individuels à chaque activation plutôt que de les
  // garder caches indéfiniment.
  const [familyOn, setFamilyOn] = useState(false)
  const [removedFamilyIds, setRemovedFamilyIds] = useState<Set<string>>(new Set())
  const familyToggleAvailable = familyMembers.length > 0
  const handleFamilyToggle = () => {
    setFamilyOn((v) => {
      if (!v) setRemovedFamilyIds(new Set())
      return !v
    })
  }

  // Un membre de la famille déjà représenté par une bannière "accompagnant"
  // existante (nom déjà saisi, tolérant aux fautes de frappe -- même
  // logique que guestDefaults plus haut) ne reçoit pas de bannière
  // "famille" en plus -- une fois enregistrée (onSaved plus bas), sa
  // bannière rejoint guestEntries et sort naturellement d'ici au rendu
  // suivant.
  //
  // Bug corrigé le 02/11/2026 (signalé par Aurélie : "j'ai vu la ligne
  // otto 2 fois") : la comparaison ne se faisait qu'avec le NOM COMPLET
  // (ex. "Otto Lalande"), alors qu'un séjour d'enfant saisi à la main est
  // quasi toujours entré avec le seul PRÉNOM (ex. "Otto" -- voir la même
  // convention dans admin/page.tsx, firstNameOnly(g.guestName)). L'écart
  // entre "otto lalande" et "otto" dépasse largement la tolérance aux
  // fautes de frappe de findClosestNameMatch (8 caractères d'écart), donc
  // aucune correspondance n'était trouvée : Otto ressortait à la fois
  // dans guestEntries (son séjour déjà enregistré) ET dans
  // activeFamilyMembers (régénéré par le toggle Famille) -- d'où le
  // doublon à l'écran. On teste désormais le nom complet ET le seul
  // prénom contre les noms déjà saisis, pour couvrir les deux façons dont
  // un accompagnant a pu être enregistré avant l'option Famille.
  const existingGuestNames = guestEntries.map((e) => e.booking?.guest_name?.trim()).filter((n): n is string => !!n)
  const isAlreadyRepresented = (m: FamilyMemberOption) => {
    const fullName = `${m.first_name} ${m.last_name}`.trim()
    return (
      findClosestNameMatch(fullName, existingGuestNames) !== -1 ||
      findClosestNameMatch(m.first_name, existingGuestNames) !== -1
    )
  }
  const activeFamilyMembers =
    familyOn && primaryBooking
      ? familyMembers.filter((m) => !removedFamilyIds.has(m.id) && !isAlreadyRepresented(m))
      : []

  // Pastille "Total contribution séjour famille" (30/10/2026) sur le titulaire :
  // son propre solde + celui de chaque membre de la famille actuellement
  // affiché ci-dessous -- ids fusionnés pour régler tout en une seule
  // session Stripe (voir CSBalancePayButton). undefined quand l'option
  // n'est pas active : StayEntry garde alors son solde habituel.
  const familyPendingOverride = familyOn
    ? csBalance.own.pending +
      activeFamilyMembers.reduce((sum, m) => sum + (findGuestBucket(csBalance, `${m.first_name} ${m.last_name}`)?.pending ?? 0), 0)
    : undefined
  const familyIdsOverride = familyOn
    ? [
        ...csBalance.own.items.map((i) => i.id),
        ...activeFamilyMembers.flatMap((m) => findGuestBucket(csBalance, `${m.first_name} ${m.last_name}`)?.items.map((i) => i.id) ?? []),
      ]
    : undefined

  // Correctif du 02/11/2026 (demande de Nicolas : "dans le widget
  // 'votre prochain séjour', on devrait simplement avoir à payer la
  // contribution séjour qui correspond à CE séjour, et non le cumul de
  // toutes les contributions séjour de nos séjours précédents, puisque mtn
  // on a un historique [...] pour le cas des séjours famille, tu peux
  // en faire le cumul, seule exception") : jusqu'ici, pendant/ids de ce
  // widget reprenaient csBalance.own en entier -- TOUT ce qui reste dû
  // sur TOUS les séjours propres du titulaire, passés compris (voir le
  // grand commentaire de computeCsBalance dans cs-balance.ts, "jamais
  // remis à zéro d'un séjour à l'autre"). Ce cumul-là reste affiché,
  // mais seulement sur la pastille de la page d'accueil (voir
  // dashboard/page.tsx, ContributionSejourPill) -- ici, on filtre csBalance.own.items
  // à ceux du SEUL séjour affiché par ce widget (primaryBooking.id, voir
  // CsBalanceItem.bookingId dans cs-balance.ts). Sans effet quand
  // familyOn (familyPendingOverride/idsOverride ci-dessus prennent le
  // relais, cumul volontairement conservé pour ce cas précis).
  const primaryStayItems = primaryBooking
    ? csBalance.own.items.filter((i) => i.bookingId === primaryBooking.id)
    : []
  const primaryStayPending = primaryStayItems.reduce((sum, i) => sum + i.amount, 0)
  const primaryStayIds = primaryStayItems.map((i) => i.id)

  return (
    <div className="space-y-3">
      <StayEntry
        key={primaryResetKey}
        entryKey="primary"
        booking={primaryBooking}
        defaultAgeBracket={computedAge >= 16 ? 'adult' : 'child'}
        knownAgeBracket={ownerKnownAge !== null ? (ownerKnownAge >= 16 ? 'adult' : 'child') : undefined}
        defaultHouseSide={profile.family_group === 'canat' || profile.family_group === 'lalande' ? profile.family_group : undefined}
        showNameField={false}
        titleWhenEmpty="Réserver votre séjour"
        titleWhenUpcoming="Votre prochain séjour"
        titleWhenOngoing="Votre séjour en cours"
        pending={primaryStayPending}
        ids={primaryStayIds}
        bgColor={ownerColor}
        onSaved={onBookingSaved}
        onDeleted={handlePrimaryDeleted}
        onHiddenChange={(id) => setEntryHidden('primary', id)}
        familyToggle={familyToggleAvailable ? { on: familyOn, onToggle: handleFamilyToggle, disabled: !primaryBooking } : undefined}
        pillLabel={familyOn ? 'Total contribution séjour famille :' : 'Payer ici sa contribution séjour :'}
        pendingOverride={familyPendingOverride}
        idsOverride={familyIdsOverride}
      />

      {activeFamilyMembers.map((m) => {
        const fullName = `${m.first_name} ${m.last_name}`.trim()
        const memberFamily = (m.family_group as FamilyGroup | null) ?? profile.family_group
        const memberColor = colorForPaletteIndex(
          memberFamily,
          typeof m.color_hue === 'number' ? m.color_hue : fallbackIndexForName(fullName)
        )
        const bucket = findGuestBucket(csBalance, fullName)
        const knownAge = m.date_of_birth && primaryBooking ? plausibleAgeAt(m.date_of_birth, primaryBooking.check_in) : null
        return (
          <StayEntry
            key={`family-${m.id}:${primaryBooking?.check_in ?? ''}:${primaryBooking?.check_out ?? ''}`}
            entryKey={`family-${m.id}`}
            booking={null}
            defaultAgeBracket="adult"
            knownAgeBracket={knownAge !== null ? (knownAge >= 16 ? 'adult' : 'child') : undefined}
            defaultHouseSide={
              primaryBooking?.house_side ?? (profile.family_group === 'canat' || profile.family_group === 'lalande' ? profile.family_group : undefined)
            }
            fixedGuestName={fullName}
            showNameField={false}
            titleWhenEmpty={`Séjour ${fullName}`}
            titleWhenUpcoming={`Séjour ${fullName}`}
            titleWhenOngoing={`Séjour ${fullName}`}
            pending={bucket?.pending ?? 0}
            ids={bucket?.items.map((i) => i.id) ?? []}
            bgColor={memberColor}
            lockedDates={primaryBooking ? { checkIn: primaryBooking.check_in, checkOut: primaryBooking.check_out } : undefined}
            hideLogistics
            onRemoved={() => setRemovedFamilyIds((prev) => new Set(prev).add(m.id))}
            onSaved={(saved) => {
              onBookingSaved?.(saved)
              setGuestEntries((prev) => [
                ...prev,
                {
                  localId: saved.id,
                  booking: {
                    id: saved.id,
                    check_in: saved.check_in,
                    check_out: saved.check_out,
                    guest_name: saved.guest_name,
                    house_side: saved.house_side,
                    age_bracket: saved.age_bracket,
                  },
                  colorHue: saved.colorHue,
                  colorFamily: saved.colorFamily,
                  remountKey: 0,
                },
              ])
            }}
            onDeleted={onBookingDeleted}
            onHiddenChange={() => {}}
          />
        )
      })}

      {guestEntries.map((entry) => {
        const bucket = findGuestBucket(csBalance, entry.booking?.guest_name ?? null)
        const guestFirstName = entry.booking?.guest_name ? firstNameOnly(entry.booking.guest_name) : ''
        // Couleur de cet accompagnant : son index de palette connu (charge
        // au montage, ou renvoye par l'API a l'enregistrement — voir
        // handleAddSlotSaved et le onSaved ci-dessous) dans sa famille
        // connue (sinon celle du titulaire du compte, par defaut), sinon un
        // repli calcule depuis son nom.
        const guestFamily = entry.colorFamily ?? profile.family_group
        const guestColor = colorForPaletteIndex(
          guestFamily,
          entry.colorHue ?? fallbackIndexForName(entry.booking?.guest_name || 'Accompagnant')
        )
        return (
          <StayEntry
            key={`${entry.localId}:${entry.remountKey}`}
            entryKey={entry.localId}
            booking={entry.booking}
            defaultAgeBracket="adult"
            defaultHouseSide={profile.family_group === 'canat' || profile.family_group === 'lalande' ? profile.family_group : undefined}
            guestDefaults={guestDefaults}
            showNameField
            titleWhenEmpty="Ajouter un séjour"
            titleWhenUpcoming={`Prochain séjour ${guestFirstName}`}
            titleWhenOngoing={`Séjour ${guestFirstName} en cours`}
            pending={bucket?.pending ?? 0}
            ids={bucket?.items.map((i) => i.id) ?? []}
            bgColor={guestColor}
            onRemoved={() => setGuestEntries((prev) => prev.filter((e) => e.localId !== entry.localId))}
            onSaved={(saved) => {
              onBookingSaved?.(saved)
              // Le nom a pu changer pendant cette modification (donc,
              // potentiellement, sa teinte assignee) : on la resynchronise
              // avec ce que l'API a renvoye plutot que de garder l'ancienne.
              setGuestEntries((prev) =>
                prev.map((e) => (e.localId === entry.localId ? { ...e, colorHue: saved.colorHue, colorFamily: saved.colorFamily } : e))
              )
            }}
            onDeleted={onBookingDeleted}
            onHiddenChange={(id) => setEntryHidden(entry.localId, id)}
          />
        )
      })}

      {delegatedStays.map((d) => (
        <DelegatedStayBanner key={d.booking.id} stay={d} />
      ))}

      <StayEntry
        key={`add-${addSlotResetKey}`}
        entryKey="add-slot"
        booking={null}
        defaultAgeBracket="adult"
        defaultHouseSide={profile.family_group === 'canat' || profile.family_group === 'lalande' ? profile.family_group : undefined}
        guestDefaults={guestDefaults}
        showNameField
        titleWhenEmpty="Ajouter un séjour"
        titleWhenUpcoming="Ajouter un séjour"
        titleWhenOngoing="Ajouter un séjour"
        pending={0}
        ids={[]}
        onSaved={handleAddSlotSaved}
        onHiddenChange={() => {}}
        hideDeleteWhenEmpty
      />
    </div>
  )
}

// Widget en lecture seule pour un sejour "delegue" (voir DelegatedStay) --
// meme habillage visuel que StayEntry (StayBanner, pastilles de solde)
// mais sans aucun champ editable ni bouton Supprimer/Modifier : ce
// sejour appartient a quelqu'un d'autre (Alexandre), seul le reglement
// de sa contribution sejour est a faire depuis ce compte (Guy).
function DelegatedStayBanner({ stay }: { stay: DelegatedStay }) {
  const [isOpen, setIsOpen] = useState(false)
  const { booking, ownerFullName, ownerColor, pending, ids } = stay
  const darkBg = shouldUseWhiteText(ownerColor)
  const phase = stayPhase(booking.check_in, booking.check_out)
  const title = phase === 'ongoing' ? `Séjour ${ownerFullName} en cours` : `Séjour ${ownerFullName}`
  const pill = <BalancePill pending={pending} ids={ids} light darkBg={darkBg} />
  const houseSideLabel =
    booking.house_side === 'canat' ? 'Canat' : booking.house_side === 'lalande' ? 'Lalande' : booking.house_side === 'petite_maison' ? 'Petite maison' : null

  return (
    <StayBanner title={title} pill={pill} isOpen={isOpen} onToggle={() => setIsOpen((o) => !o)} bgColor={ownerColor}>
      <TotalContributionSejourStayPill pending={pending} ids={ids} light darkBg={darkBg} />
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-4 gap-y-1 text-xs uppercase tracking-[0.08em] md:text-sm',
          darkBg ? 'text-white' : 'text-foreground/60'
        )}
      >
        <span className="font-extrabold">
          Du {formatFrenchDateInput(booking.check_in)} au {formatFrenchDateInput(booking.check_out)}
        </span>
        {houseSideLabel && <span className="font-extrabold">{houseSideLabel}</span>}
      </div>
      {booking.notes && <p className={cn('text-sm', darkBg ? 'text-white/80' : 'text-foreground/70')}>{booking.notes}</p>}
    </StayBanner>
  )
}

interface StayEntryProps {
  entryKey: string
  booking: BookingData | null
  defaultAgeBracket: AgeBracket
  defaultHouseSide?: HouseSide
  // Voir le commentaire sur NextStayCardProps.guestDefaults plus haut --
  // absent pour la bannière du titulaire (son propre âge/côté se déduisent
  // déjà de son profil, voir defaultAgeBracket/defaultHouseSide passés par
  // l'appelant), utilisé seulement pour les bannières d'accompagnant.
  guestDefaults?: Record<string, { ageBracket: AgeBracket; houseSide: HouseSide }>
  showNameField: boolean
  titleWhenEmpty: string
  titleWhenUpcoming: string
  titleWhenOngoing: string
  pending: number
  ids: string[]
  bgColor?: string
  onRemoved?: () => void
  onSaved?: (booking: SavedStayInfo) => void
  onDeleted?: (bookingId: string) => void
  onHiddenChange: (bookingId: string | null) => void
  // Bannière "Ajouter un séjour" tout en bas : rien à supprimer tant que
  // rien n'a été saisi, on ne montre donc pas "Supprimer ce séjour" à
  // vide (elle referme juste le formulaire).
  hideDeleteWhenEmpty?: boolean
  // "Option famille" (30/10/2026) -- voir FamilyMemberOption et le
  // commentaire dans NextStayCard ci-dessus pour le détail de chacun :
  // nom fixe (pas de champ éditable) pour une bannière famille,
  // tranche d'âge déjà connue (plus de pastilles 0-16/17+) quand sa date
  // de naissance est plausible, dates verrouillées sur celles du
  // titulaire tant que l'option reste active, et (titulaire seulement)
  // la bascule "Famille" + le remplacement de la pastille de solde.
  fixedGuestName?: string
  knownAgeBracket?: AgeBracket
  lockedDates?: { checkIn: string; checkOut: string }
  familyToggle?: { on: boolean; onToggle: () => void; disabled: boolean }
  pillLabel?: string
  pendingOverride?: number
  idsOverride?: string[]
  // Masque le champ "Note" (heure/gare d'arrivee) et les pastilles de
  // cote de maison sur une banniere "Option famille" (demande d'Aurelie
  // le 02/11/2026 : "tu n'as plus besoin d'afficher l'encadre heure
  // d'arrivee, ni le cote de la maison") -- uniquement pour ces
  // bannieres-la : le titulaire et les accompagnants saisis a la main
  // (bouton "+") gardent les deux, ils en ont besoin. Le cote de maison
  // garde de toute facon sa valeur par defaut (defaultHouseSide) meme
  // sans pastilles visibles, donc l'enregistrement du sejour n'est pas
  // bloque.
  hideLogistics?: boolean
}

function fieldsSnapshot(
  booking: BookingData | null,
  defaultAgeBracket: AgeBracket,
  defaultHouseSide?: HouseSide,
  fixedGuestName?: string,
  knownAgeBracket?: AgeBracket,
  lockedDates?: { checkIn: string; checkOut: string }
) {
  return {
    checkIn: lockedDates?.checkIn ?? booking?.check_in ?? '',
    checkOut: lockedDates?.checkOut ?? booking?.check_out ?? '',
    notes: booking?.notes ?? '',
    // Tranche d'age memorisee sur le sejour (26/10/2026) prioritaire sur
    // le defaut calcule par l'appelant -- celui-ci ne reste un repli que
    // pour un sejour jamais enregistre avec cette colonne (anterieur a la
    // migration) ou pas encore enregistre du tout (booking === null).
    ageBracket: booking?.age_bracket ?? knownAgeBracket ?? defaultAgeBracket,
    houseSide: booking?.house_side ?? defaultHouseSide ?? null,
    guestName: fixedGuestName ?? booking?.guest_name ?? '',
  }
}

function StayEntry({
  booking,
  defaultAgeBracket,
  defaultHouseSide,
  guestDefaults,
  showNameField,
  titleWhenEmpty,
  titleWhenUpcoming,
  titleWhenOngoing,
  pending,
  ids,
  bgColor,
  onRemoved,
  onSaved,
  onDeleted,
  onHiddenChange,
  hideDeleteWhenEmpty,
  fixedGuestName,
  knownAgeBracket,
  lockedDates,
  familyToggle,
  pillLabel,
  pendingOverride,
  idsOverride,
  hideLogistics,
}: StayEntryProps) {
  const initialSnapshot = fieldsSnapshot(booking, defaultAgeBracket, defaultHouseSide, fixedGuestName, knownAgeBracket, lockedDates)

  const [checkIn, setCheckIn] = useState(initialSnapshot.checkIn)
  const [checkOut, setCheckOut] = useState(initialSnapshot.checkOut)
  const [notes, setNotes] = useState(initialSnapshot.notes)
  const [ageBracket, setAgeBracket] = useState<AgeBracket>(initialSnapshot.ageBracket)
  const [houseSide, setHouseSide] = useState<HouseSide | null>(initialSnapshot.houseSide)
  const [guestName, setGuestName] = useState(initialSnapshot.guestName)
  const [bookingId, setBookingId] = useState<string | null>(booking?.id ?? null)
  const [snapshot, setSnapshot] = useState(initialSnapshot)

  const [isOpen, setIsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0
    const diff = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
    return diff > 0 ? diff : 0
  }, [checkIn, checkOut])

  const amount = useMemo(() => {
    if (nights <= 0) return 0
    return calculateTotalCS(new Date(checkIn), new Date(checkOut), ageBracket === 'child' ? 10 : 20, true)
  }, [checkIn, checkOut, nights, ageBracket])

  // Tarif par nuit affiche a cote du total (30/10/2026, demande d'Aurelie :
  // "10e/nuit" ou "15e/nuit" a cote de la ligne "Contribution sejour") -- pris
  // sur la date d'arrivee : les rares sejours qui chevauchent le
  // changement de saison (31 octobre) ont un total exact malgre tout
  // (calculateTotalCS additionne nuit par nuit), seul ce tarif affiche
  // suppose une seule saison sur tout le sejour.
  const nightlyRate = useMemo(() => {
    if (nights <= 0 || !checkIn) return 0
    return calculateCSRate(new Date(checkIn), ageBracket === 'child' ? 10 : 20, true)
  }, [checkIn, nights, ageBracket])

  const hasSavedBooking = bookingId !== null

  // Pré-remplissage à la frappe (27/10/2026, demande d'Aurélie) : dès que
  // le nom tapé correspond (tolérance aux fautes de frappe, voir
  // findClosestNameMatch) à un accompagnant déjà connu, reprend sa
  // tranche d'âge et son côté de maison les plus récents plutôt que le
  // défaut générique ("adulte", côté du titulaire qui saisit) -- 
  // uniquement pour un séjour pas encore enregistré (hasSavedBooking :
  // un séjour déjà en base garde ses propres valeurs, voir
  // fieldsSnapshot), et seulement tant que ces deux champs n'ont pas été
  // changés à la main (toujours égaux à leur valeur de départ) : on ne
  // doit jamais écraser un choix explicite.
  useEffect(() => {
    if (!showNameField || hasSavedBooking || !guestDefaults) return
    const typed = guestName.trim()
    if (!typed) return
    const names = Object.keys(guestDefaults)
    const idx = findClosestNameMatch(typed, names)
    if (idx === -1) return
    const match = guestDefaults[names[idx]]
    if (!match) return
    if (ageBracket === defaultAgeBracket) setAgeBracket(match.ageBracket)
    if (houseSide === (defaultHouseSide ?? null)) setHouseSide(match.houseSide)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestName])

  const dirty =
    checkIn !== snapshot.checkIn ||
    checkOut !== snapshot.checkOut ||
    notes.trim() !== snapshot.notes.trim() ||
    ageBracket !== snapshot.ageBracket ||
    houseSide !== snapshot.houseSide ||
    (showNameField && guestName.trim() !== snapshot.guestName.trim())

  // Masque ce séjour du planning tant qu'il est validé-mais-modifié : ce
  // qui est affiché ailleurs (planning) ne doit pas rester une version
  // potentiellement périmée pendant que les champs sont en train de
  // changer (voir commentaire dans NextStayCard). Rien n'est supprimé en
  // base ici — juste un signal d'affichage.
  useEffect(() => {
    onHiddenChange(hasSavedBooking && dirty ? bookingId : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSavedBooking, dirty, bookingId])

  const canSubmit = !!checkIn && !!checkOut && nights > 0 && !!houseSide && (!showNameField || guestName.trim())

  const title = !booking
    ? titleWhenEmpty
    : stayPhase(booking.check_in, booking.check_out) === 'ongoing'
      ? titleWhenOngoing
      : titleWhenUpcoming

  const discardDraft = () => {
    setCheckIn(snapshot.checkIn)
    setCheckOut(snapshot.checkOut)
    setNotes(snapshot.notes)
    setAgeBracket(snapshot.ageBracket)
    setHouseSide(snapshot.houseSide)
    setGuestName(snapshot.guestName)
    setError(null)
  }

  const handleToggle = () => {
    if (isOpen && hasSavedBooking && dirty) discardDraft() // referme sans valider = on annule la modif en cours
    setIsOpen((o) => !o)
  }

  const handleValidate = async () => {
    if (!dirty) {
      setIsOpen(false)
      return
    }
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    try {
      const res = await fetch('/api/bookings/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          checkIn,
          checkOut,
          amount,
          bookingId,
          guestName: showNameField ? guestName.trim() : (fixedGuestName ?? undefined),
          houseSide,
          notes: notes.trim() || null,
          ageBracket,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur lors de l’enregistrement')

      setBookingId(data.bookingId)
      const savedSnapshot = { checkIn, checkOut, notes, ageBracket, houseSide, guestName }
      setSnapshot(savedSnapshot)
      setIsOpen(false)
      onSaved?.({
        id: data.bookingId,
        check_in: checkIn,
        check_out: checkOut,
        guest_name: showNameField ? guestName.trim() || null : (fixedGuestName ?? null),
        house_side: houseSide,
        age_bracket: ageBracket,
        colorHue: typeof data.colorHue === 'number' ? data.colorHue : null,
        colorFamily: data.colorFamily ?? null,
      })
    } catch (err) {
      const timedOut = err instanceof Error && err.name === 'AbortError'
      setError(timedOut ? 'La connexion est trop lente, réessaie.' : err instanceof Error ? err.message : 'Erreur')
    } finally {
      clearTimeout(timeoutId)
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    setError(null)
    if (!bookingId) {
      onRemoved?.()
      return
    }
    setRemoving(true)
    try {
      const res = await fetch(`/api/bookings/quick?id=${bookingId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur lors de la suppression')
      onDeleted?.(bookingId)
      onRemoved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setRemoving(false)
    }
  }

  const showDelete = !(hideDeleteWhenEmpty && !hasSavedBooking && !checkIn && !checkOut && !guestName.trim())

  // Meme signal que dans StayBanner : widget colore => texte en
  // transparence (demande par Nicolas le 29/09/2026), sauf pour "Ajouter
  // un sejour" qui n'a pas de bgColor et garde sa typo noire pleine.
  const light = !!bgColor
  // Meme bascule blanc/sombre que StayBanner (voir plus haut et
  // shouldUseWhiteText dans src/lib/colors.ts) -- calculee ici aussi
  // puisque StayEntry affiche son propre contenu deplie par-dessus la
  // meme couleur de fond, pas seulement le titre de la banniere.
  const darkBg = !!bgColor && shouldUseWhiteText(bgColor)
  // Pastilles de selection (age / cote de la maison) : meme style que
  // viewTogglePillClass partout ailleurs sur le site, avec une bascule en
  // blanc quand le fond de la banniere est sombre (meme raisonnement que
  // le reste de ce fichier, voir shouldUseWhiteText).
  const pillClass = (selected: boolean) =>
    cn(viewTogglePillClass(selected), darkBg && (selected ? 'text-white' : 'text-white/60'), darkBg && 'hover:text-white')
  const pill = <BalancePill pending={pending} ids={ids} light={light} darkBg={darkBg} />

  return (
    <StayBanner title={title} pill={pill} isOpen={isOpen} onToggle={handleToggle} bgColor={bgColor}>
      <TotalContributionSejourStayPill
        pending={pendingOverride ?? pending}
        ids={idsOverride ?? ids}
        light={light}
        darkBg={darkBg}
        label={pillLabel}
      />

      {/* Plus de libelle "Nom Prenom" au-dessus : seul l'encadre ou le nom
          est ecrit reste, avec le meme traitement que le champ "Note"
          (soulignement, majuscules/gras une fois rempli, gris normal en
          placeholder tant que rien n'est saisi) -- demande par Nicolas le
          29/09/2026. */}
      {showNameField && (
        <input
          type="text"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="Prénom nom"
          className={cn(
            'w-full border-0 border-b border-foreground/30 bg-transparent px-1 py-0.5 text-xs font-extrabold uppercase tracking-[0.08em] outline-none focus:border-foreground placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground md:text-sm',
            darkBg ? 'text-white border-white/40 focus:border-white' : light ? 'text-foreground/60' : 'text-foreground'
          )}
        />
      )}

      {/* Disposition/typo du contenu deplie alignees sur le visuel envoye par
          Nicolas le 29/09/2026 : libelles courts en majuscules + tracking
          (meme langage que les pastilles "TOTAL CONTRIBUTION SEJOUR"/"Aujourd'hui"
          de l'accueil), valeurs en ultra gras, plus de boutons a fond plein
          pour l'age/l'aile -- de simples libelles textuels, gras si
          selectionnes. */}
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-4 gap-y-1 text-xs uppercase tracking-[0.08em] md:text-sm',
          darkBg ? 'text-white' : light ? 'text-foreground/60' : 'text-foreground'
        )}
      >
        {lockedDates ? (
          // "Option famille" active (30/10/2026) : dates du titulaire,
          // non modifiables ici -- voir le commentaire sur lockedDates
          // dans StayEntryProps.
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-extrabold">
            Du {formatFrenchDateInput(lockedDates.checkIn)} au {formatFrenchDateInput(lockedDates.checkOut)}
          </span>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              Du :
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className={cn(
                  'border-0 border-b border-foreground/30 bg-transparent px-1 py-0.5 text-xs font-extrabold uppercase tracking-[0.08em] outline-none focus:border-foreground md:text-sm',
                  darkBg ? 'text-white border-white/40 focus:border-white' : light ? 'text-foreground/60' : 'text-foreground'
                )}
              />
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              Au :
              <input
                type="date"
                value={checkOut}
                min={checkIn || undefined}
                onChange={(e) => setCheckOut(e.target.value)}
                className={cn(
                  'border-0 border-b border-foreground/30 bg-transparent px-1 py-0.5 text-xs font-extrabold uppercase tracking-[0.08em] outline-none focus:border-foreground md:text-sm',
                  darkBg ? 'text-white border-white/40 focus:border-white' : light ? 'text-foreground/60' : 'text-foreground'
                )}
              />
            </span>
          </>
        )}
        {familyToggle && (
          // "Option famille" (30/10/2026, demande d'Aurélie) : alignée
          // horizontalement avec les champs de dates, sur le widget du
          // titulaire uniquement -- voir NextStayCard. Désactivée tant
          // que son propre séjour n'est pas encore enregistré (les dates
          // de référence des accompagnants n'existent pas encore).
          <button
            type="button"
            disabled={familyToggle.disabled}
            onClick={familyToggle.onToggle}
            aria-pressed={familyToggle.on}
            className={cn(
              'ml-auto inline-flex items-center gap-2 whitespace-nowrap font-bold disabled:opacity-40',
              darkBg ? 'text-white' : light ? 'text-foreground/60' : 'text-foreground'
            )}
          >
            <span
              className={cn(
                'relative h-5 w-[34px] shrink-0 rounded-full border',
                darkBg ? 'border-white' : 'border-current',
                familyToggle.on && (darkBg ? 'bg-white' : 'bg-current')
              )}
            >
              <span
                className={cn(
                  'absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full transition-transform',
                  familyToggle.on ? 'translate-x-3.5' : 'translate-x-0',
                  familyToggle.on ? (darkBg ? 'bg-foreground' : 'bg-background') : darkBg ? 'bg-white' : 'bg-current'
                )}
              />
            </span>
            Famille
          </button>
        )}
      </div>

      {/* Champ "Note" : plus de libelle ni de soulignement -- demande par
          Nicolas le 04/10/2026, traiter cet encadre exactement comme le
          champ "Titre" de "Partager ce qui a ete fait" (RealisationsBoard.tsx) :
          un encadre arrondi avec un texte d'exemple en gris clair en
          placeholder (ici "Heure et gare ou aeroport d'arrivee"), plus de
          label "Note :" ni de soulignement bas-de-casse/majuscules.
          05/10/2026 : bg-background (fond uni) remplace par bg-transparent
          a la demande de Nicolas, pour que cet encadre laisse voir le
          fond du widget qui le contient (couleur + texture papier posee
          par StayBanner via coloredTextureStyle, ou fond "canson" uni
          pour la banniere generique "Ajouter un sejour") plutot qu'un
          fond gris plat qui jurait avec les bannieres colorees
          (Otto/invites). */}
      {!hideLogistics && (
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Heure et gare ou aéroport d'arrivée"
          className={cn(
            'w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground',
            darkBg ? 'text-white border-white/30' : 'text-foreground'
          )}
        />
      )}

      {/* gap-x-2 (8px) + tracking reduit a 0.02em (au lieu de gap-x-3/16px et
          0.08em) : sur un ecran mobile reel (375px, iPhone standard) le
          gap-x-3 seul ne suffisait plus a faire tenir les 5 libelles
          (0-16 ans / 17 ans et + / Canat / Lalande / Petite maison) sur une
          seule ligne -- demande par Nicolas le 29/09/2026 ("reduit les
          espaces entre les lettres si necessaire"). Marge verifiee
          d'environ 27px a 375px de large. */}
      {/* 0-16 ans / 17 ans et + / Canat / Lalande / Petite maison : meme
          traitement exact que le selecteur de vue du Planning ("Semaine /
          Quinzaine / Mois / Annee", voir PlanningView.tsx et
          viewTogglePillClass dans utils.ts) -- demande par Nicolas le
          04/10/2026. Remplace l'ancien traitement opacity/extrabold (et
          son tracking reduit a 0.02em sur mobile, pense le 29/09/2026 pour
          faire tenir les 5 libelles sur une seule ligne a 375px) -- a
          surveiller sur mobile reel si ca redevient trop juste en largeur
          avec le tracking uniforme a 0.08em. */}
      {(knownAgeBracket === undefined || !hideLogistics) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {knownAgeBracket === undefined && (
            // Choix manuel 0-16/17+ : masqué quand la tranche d'âge est
            // déjà connue avec certitude (date de naissance plausible,
            // voir knownAgeBracket/plausibleAgeAt) -- demandé par Aurélie
            // le 29/10/2026 pour les bannières "Option famille" : "tu ne
            // proposeras plus le choix" pour un profil dont la date de
            // naissance est renseignée.
            <>
              <button type="button" className={pillClass(ageBracket === 'child')} onClick={() => setAgeBracket('child')}>
                0-16 ans
              </button>
              <button type="button" className={pillClass(ageBracket === 'adult')} onClick={() => setAgeBracket('adult')}>
                17 ans et +
              </button>
            </>
          )}
          {/* Pastilles de cote de maison masquees sur une banniere
              "Option famille" (hideLogistics, demande d'Aurelie le
              02/11/2026) -- la valeur par defaut (defaultHouseSide) reste
              appliquee au sejour meme sans ces pastilles visibles. */}
          {!hideLogistics && (
            <>
              <button type="button" className={pillClass(houseSide === 'canat')} onClick={() => setHouseSide('canat')}>
                Canat
              </button>
              <button type="button" className={pillClass(houseSide === 'lalande')} onClick={() => setHouseSide('lalande')}>
                Lalande
              </button>
              <button type="button" className={pillClass(houseSide === 'petite_maison')} onClick={() => setHouseSide('petite_maison')}>
                Petite maison
              </button>
            </>
          )}
        </div>
      )}

      {nights > 0 && (
        // Ligne simplifiee le 02/11/2026 (demande d'Aurelie) : plus de
        // prefixe "Contribution sejour :", on affiche directement
        // "8 nuits : 85€ (10€/nuit)".
        <div
          className={cn(
            'flex flex-wrap items-baseline gap-x-1.5 text-xs uppercase tracking-[0.08em] md:text-sm',
            darkBg ? 'text-white' : light ? 'text-foreground/60' : 'text-foreground'
          )}
        >
          <span className="font-extrabold">
            {nights} nuit{nights > 1 ? 's' : ''} : {formatCurrency(amount)}
          </span>
          <span className="font-normal opacity-70">({nightlyRate}€/nuit)</span>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* "Supprimer ce sejour" / "Modifier"-"Valider" : pastilles
          d'action harmonisees le 04/10/2026 (voir actionPillClass dans
          utils.ts) -- typo toujours dans la couleur des titres de
          widget, donc plus de variante "light" ici (a la difference des
          pastilles de solde juste au-dessus, qui restent dimmees sur
          fond colore). 09/10/2026 : le contour/texte passe quand meme en
          blanc si le fond de la banniere est sombre (voir darkBg plus
          haut), sinon illisible sur une couleur de personne foncee comme
          celle attribuee au compte de Guy. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {showDelete ? (
          <button
            type="button"
            className={cn(actionPillClass, darkBg && 'border-white text-white')}
            onClick={handleRemove}
            disabled={removing || saving}
          >
            <Minus className="h-3.5 w-3.5" />
            Supprimer ce séjour
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          className={cn(actionPillClass, darkBg && 'border-white text-white')}
          disabled={!canSubmit || saving}
          onClick={handleValidate}
        >
          {saving ? 'Enregistrement...' : hasSavedBooking && !dirty ? 'Modifier' : 'Valider'}
        </button>
      </div>
    </StayBanner>
  )
}
