'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { differenceInYears, parseISO } from 'date-fns'
import { calculateTotalTS, cn, firstNameOnly, formatCurrency, normalizeName, stayPhase } from '@/lib/utils'
import { FamilyGroup, HouseSide, Profile, TSPayment } from '@/types'
import { TSBalancePayButton } from '@/components/payment/TSBalancePayButton'
import { ChevronDown, Minus } from 'lucide-react'
import type { TsBalanceResult, TsGuestBalance } from '@/lib/ts-balance'
import { colorForPaletteIndex, coloredTextureStyle, fallbackIndexForName } from '@/lib/colors'

type AgeBracket = 'child' | 'adult'

// Refonte du widget "Prochain séjour" en bannières dépliables (demandée
// par Nicolas le 23/09/2026, pendant qu'on réglait le format mobile
// ensemble) : chaque séjour (le sien, puis un par accompagnant) a
// désormais sa propre bannière — titre évolutif à gauche selon que le
// séjour n'existe pas encore / est à venir / est en cours, pastille de
// solde TS toujours visible à droite (cliquable, lien de paiement groupé
// — voir TSBalancePayButton) — et ne se déplie qu'au clic sur le titre.
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
  ts_payments?: TSPayment[]
  // Couleur de cet occupant (voir src/lib/colors.ts -- depuis le 29/09/2026,
  // color_hue est un index de palette, a lire avec color_family), resolue
  // cote serveur -- sert a colorer le fond de sa banniere ci-dessous.
  color_hue?: number | null
  color_family?: FamilyGroup | null
}

export interface SavedStayInfo {
  id: string
  check_in: string
  check_out: string
  guest_name: string | null
  house_side: HouseSide | null
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
  // Solde TS (le sien + un par accompagnant déjà saisi), pour les
  // pastilles des bannières — voir ReserverSejour.tsx pour le calcul et
  // le rafraîchissement.
  tsBalance: TsBalanceResult
  onBookingSaved?: (booking: SavedStayInfo) => void
  onBookingDeleted?: (bookingId: string) => void
  // Séjours déjà validés mais en cours de modification (champs touchés,
  // pas encore revalidés) : leur ligne ne doit pas rester affichée sur le
  // planning tant qu'elle n'est pas revalidée (demandé par Nicolas le
  // 23/09/2026 — "tu effaces automatiquement tout ce qui concerne ce
  // séjour"), sans rien supprimer réellement en base. Ce callback remonte
  // la liste à jour des identifiants de séjour à masquer du planning.
  onHiddenBookingIdsChange?: (ids: string[]) => void
}

function findGuestBucket(tsBalance: TsBalanceResult, fullName: string | null): TsGuestBalance | null {
  if (!fullName) return null
  const target = normalizeName(fullName)
  return tsBalance.guests.find((g) => normalizeName(g.name) === target) ?? null
}

// Montant compact ("90" ou "90,50"), sans le formatage de formatCurrency
// (espace + decimales systematiques) -- meme convention que TaxeSejourPill,
// pour que "TS : -90€" tienne sur une seule ligne a cote du titre (demande
// par Nicolas le 29/09/2026, pastille visible widget ferme comme ouvert).
function compactAmount(amount: number): string {
  return Number.isInteger(amount) ? `${amount}` : amount.toFixed(2).replace('.', ',')
}
function soldeLabel(pending: number) {
  return pending > 0 ? `-${compactAmount(pending)}` : compactAmount(0)
}

// Pastilles liees au solde TS ("TS: X€" fermee, "Total taxe de sejour: X€"
// ouverte) et pastilles d'action du widget deplie ("Supprimer ce sejour",
// "Modifier"/"Valider") : encadre transparent, typo dans la couleur du
// widget, majuscules trackees. Jusqu'au 04/10/2026, le survol/clic
// reprenait le mecanisme de TaxeSejourPill.tsx sur l'accueil (le cadre se
// remplit de blanc, le texte se decoupe pour laisser deviner la photo de
// fond fixe de l'accueil) -- mais sur Planning, le fond reel n'est jamais
// cette photo (c'est le beige canson du widget), donc le survol affichait
// un carre blanc plaque, incoherent avec le reste de la page. Un premier
// correctif a rendu le cadre entierement transparent au survol/clic, mais
// Nicolas a precise vouloir un vrai changement de couleur visible, dans le
// meme beige canson que le fond de la page (`--background`, voir
// globals.css) plutot qu'aucun changement du tout -- d'ou `hover:bg-background`
// ci-dessous (et non `hover:bg-transparent`). L'ancien decoupage photo du
// texte (propre a l'accueil, voir stayPillTextClass plus bas) reste retire,
// toujours sans objet ici. Les deux pastilles de solde restent toujours en
// gras, et gardent le rouge d'alerte sur le montant quand il est negatif
// (montant du) -- demande par Nicolas le 29/09/2026.
const stayPillOuterClass =
  'group inline-flex w-fit items-center gap-1.5 whitespace-nowrap border border-foreground/30 bg-transparent px-3 py-1.5 text-xs uppercase tracking-[0.1em] transition-colors hover:bg-background disabled:pointer-events-none disabled:opacity-50 md:text-sm'

// Pastilles de solde ("TS :" / "Total taxe de sejour :") : meme pastille
// que les boutons d'action (Supprimer/Valider) mais tracking resserre a
// 0,08em (au lieu de 0,1em) et libelle en semi-gras (au lieu d'extra-gras)
// -- harmonisation typo demandee par Nicolas le 30/09/2026, voir
// "Typographie La Batisse.pdf". Les boutons d'action (stayPillOuterClass
// employe directement plus bas) ne sont pas concernes par cette demande.
const balancePillOuterClass = stayPillOuterClass.replace('tracking-[0.1em]', 'tracking-[0.08em]')

// Demande par Nicolas le 04/10/2026 : plus de decoupage photo au survol
// (voir stayPillOuterClass ci-dessus) -- le texte garde simplement sa
// couleur, lisible directement sur le fond canson du widget.
function stayPillTextClass(light: boolean, extra?: string) {
  return cn('transition-colors', light ? 'text-foreground/60' : 'text-foreground', extra)
}

// Montant d'une pastille de solde : rouge plein (pas de decoupage photo,
// pour rester bien visible) quand une somme est due, sinon meme traitement
// transparent que le reste de la pastille.
function StayPillAmount({ pending, light }: { pending: number; light: boolean }) {
  if (pending > 0) {
    return <span className="font-extrabold text-red-600">{soldeLabel(pending)}€</span>
  }
  return (
    <span className={stayPillTextClass(light, 'font-extrabold')}>
      {soldeLabel(pending)}€
    </span>
  )
}

function BalancePill({ pending, ids, light }: { pending: number; ids: string[]; light: boolean }) {
  const content = (
    <>
      <span className={stayPillTextClass(light, 'font-semibold')}>
        TS:
      </span>{' '}
      <StayPillAmount pending={pending} light={light} />
    </>
  )
  if (ids.length === 0) {
    return <span className={balancePillOuterClass}>{content}</span>
  }
  return (
    <TSBalancePayButton ids={ids} className={balancePillOuterClass}>
      {content}
    </TSBalancePayButton>
  )
}

function TotalTaxeSejourStayPill({ pending, ids, light }: { pending: number; ids: string[]; light: boolean }) {
  const inner = (
    <>
      <span className={stayPillTextClass(light, 'font-semibold')}>
        Total taxe de séjour :
      </span>{' '}
      <StayPillAmount pending={pending} light={light} />
    </>
  )
  if (ids.length === 0) {
    return <span className={balancePillOuterClass}>{inner}</span>
  }
  return (
    <TSBalancePayButton ids={ids} className={balancePillOuterClass}>
      {inner}
    </TSBalancePayButton>
  )
}

// Bannière dépliable : titre à gauche (bascule le contenu au clic),
// pastille de solde à droite (clic séparé, lien de paiement). Fond
// "canson" opaque (classe .card-canson, globals.css) pour la
// bannière générique "Ajouter un séjour" -- même couleur que la
// grille d'onglets (TileNav.tsx), demandé par Nicolas le 30/09/2026.
function StayBanner({
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
  // Widget colore (bgColor present) : texte en transparence pour laisser
  // apparaitre la couleur de fond (demande par Nicolas le 29/09/2026) --
  // ne s'applique pas a la banniere generique "Ajouter un sejour", qui
  // garde sa typo pleine (noire).
  const light = !!bgColor
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
            light ? 'text-foreground/60' : 'text-foreground'
          )}
        >
          <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', isOpen && 'rotate-180')} />
          <span className="truncate">{title}</span>
        </button>
        {!isOpen && pill}
      </div>
      {/* Plus de ligne de separation ni de padding haut uniforme : l'espace
          entre le titre et la pastille "Total taxe de sejour" fait
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
  tsBalance,
  onBookingSaved,
  onBookingDeleted,
  onHiddenBookingIdsChange,
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
  // bande d'Otto ... son widget doit automatiquement changer, sa taxe de
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
        },
        colorHue: saved.colorHue,
        colorFamily: saved.colorFamily,
        remountKey: 0,
      },
    ])
    setAddSlotResetKey((k) => k + 1)
  }

  return (
    <div className="space-y-3">
      <StayEntry
        key={primaryResetKey}
        entryKey="primary"
        booking={primaryBooking}
        defaultAgeBracket={computedAge >= 16 ? 'adult' : 'child'}
        defaultHouseSide={profile.family_group === 'canat' || profile.family_group === 'lalande' ? profile.family_group : undefined}
        showNameField={false}
        titleWhenEmpty="Réserver votre séjour"
        titleWhenUpcoming="Votre prochain séjour"
        titleWhenOngoing="Votre séjour en cours"
        pending={tsBalance.own.pending}
        ids={tsBalance.own.items.map((i) => i.id)}
        bgColor={ownerColor}
        onSaved={onBookingSaved}
        onDeleted={handlePrimaryDeleted}
        onHiddenChange={(id) => setEntryHidden('primary', id)}
      />

      {guestEntries.map((entry) => {
        const bucket = findGuestBucket(tsBalance, entry.booking?.guest_name ?? null)
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

      <StayEntry
        key={`add-${addSlotResetKey}`}
        entryKey="add-slot"
        booking={null}
        defaultAgeBracket="adult"
        defaultHouseSide={profile.family_group === 'canat' || profile.family_group === 'lalande' ? profile.family_group : undefined}
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

interface StayEntryProps {
  entryKey: string
  booking: BookingData | null
  defaultAgeBracket: AgeBracket
  defaultHouseSide?: HouseSide
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
}

function fieldsSnapshot(booking: BookingData | null, defaultAgeBracket: AgeBracket, defaultHouseSide?: HouseSide) {
  return {
    checkIn: booking?.check_in ?? '',
    checkOut: booking?.check_out ?? '',
    notes: booking?.notes ?? '',
    ageBracket: defaultAgeBracket,
    houseSide: booking?.house_side ?? defaultHouseSide ?? null,
    guestName: booking?.guest_name ?? '',
  }
}

function StayEntry({
  booking,
  defaultAgeBracket,
  defaultHouseSide,
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
}: StayEntryProps) {
  const initialSnapshot = fieldsSnapshot(booking, defaultAgeBracket, defaultHouseSide)

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
    return calculateTotalTS(new Date(checkIn), new Date(checkOut), ageBracket === 'child' ? 10 : 20, true)
  }, [checkIn, checkOut, nights, ageBracket])

  const hasSavedBooking = bookingId !== null
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
          guestName: showNameField ? guestName.trim() : undefined,
          houseSide,
          notes: notes.trim() || null,
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
        guest_name: showNameField ? guestName.trim() || null : null,
        house_side: houseSide,
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
  const pill = <BalancePill pending={pending} ids={ids} light={light} />

  return (
    <StayBanner title={title} pill={pill} isOpen={isOpen} onToggle={handleToggle} bgColor={bgColor}>
      <TotalTaxeSejourStayPill pending={pending} ids={ids} light={light} />

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
            light ? 'text-foreground/60' : 'text-foreground'
          )}
        />
      )}

      {/* Disposition/typo du contenu deplie alignees sur le visuel envoye par
          Nicolas le 29/09/2026 : libelles courts en majuscules + tracking
          (meme langage que les pastilles "TOTAL TAXE DE SEJOUR"/"Aujourd'hui"
          de l'accueil), valeurs en ultra gras, plus de boutons a fond plein
          pour l'age/l'aile -- de simples libelles textuels, gras si
          selectionnes. */}
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-4 gap-y-1 text-xs uppercase tracking-[0.08em] md:text-sm',
          light ? 'text-foreground/60' : 'text-foreground'
        )}
      >
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          Du :
          <input
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className={cn(
              'border-0 border-b border-foreground/30 bg-transparent px-1 py-0.5 text-xs font-extrabold uppercase tracking-[0.08em] outline-none focus:border-foreground md:text-sm',
              light ? 'text-foreground/60' : 'text-foreground'
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
              light ? 'text-foreground/60' : 'text-foreground'
            )}
          />
        </span>
      </div>

      <div
        className={cn(
          'flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs uppercase tracking-[0.08em] md:text-sm',
          light ? 'text-foreground/60' : 'text-foreground'
        )}
      >
        <span className="whitespace-nowrap">Note :</span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: Gare de Pamiers 14h45"
          className={cn(
            // Semi-gras (600) plutot qu'extra-gras (800) -- demande par
            // Nicolas le 02/10/2026, uniquement sur ce champ (pas sur les
            // dates juste au-dessus, qui restent en font-extrabold).
            'min-w-[9rem] flex-1 border-0 border-b border-foreground/30 bg-transparent px-1 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] outline-none focus:border-foreground placeholder:font-normal placeholder:normal-case placeholder:tracking-normal md:text-sm',
            // Gris clair du placeholder aligne sur les libelles non
            // selectionnes (0-16 ans / Canat / Petite maison, opacity-60
            // sur text-foreground) plutot que le token muted-foreground
            // (trop brun/fonce) -- demande par Nicolas le 29/09/2026.
            light ? 'text-foreground/60 placeholder:text-foreground/40' : 'text-foreground placeholder:text-foreground/60'
          )}
        />
      </div>

      {/* gap-x-2 (8px) + tracking reduit a 0.02em (au lieu de gap-x-3/16px et
          0.08em) : sur un ecran mobile reel (375px, iPhone standard) le
          gap-x-3 seul ne suffisait plus a faire tenir les 5 libelles
          (0-16 ans / 17 ans et + / Canat / Lalande / Petite maison) sur une
          seule ligne -- demande par Nicolas le 29/09/2026 ("reduit les
          espaces entre les lettres si necessaire"). Marge verifiee
          d'environ 27px a 375px de large. */}
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs uppercase tracking-[0.02em] md:gap-x-4 md:text-sm md:tracking-[0.08em]',
          light ? 'text-foreground/60' : 'text-foreground'
        )}
      >
        <button
          type="button"
          className={cn('transition-opacity hover:opacity-80', ageBracket === 'child' ? 'font-extrabold' : 'font-normal opacity-60')}
          onClick={() => setAgeBracket('child')}
        >
          0-16 ans
        </button>
        <button
          type="button"
          className={cn('transition-opacity hover:opacity-80', ageBracket === 'adult' ? 'font-extrabold' : 'font-normal opacity-60')}
          onClick={() => setAgeBracket('adult')}
        >
          17 ans et +
        </button>
        <button
          type="button"
          className={cn('transition-opacity hover:opacity-80', houseSide === 'canat' ? 'font-extrabold' : 'font-normal opacity-60')}
          onClick={() => setHouseSide('canat')}
        >
          Canat
        </button>
        <button
          type="button"
          className={cn('transition-opacity hover:opacity-80', houseSide === 'lalande' ? 'font-extrabold' : 'font-normal opacity-60')}
          onClick={() => setHouseSide('lalande')}
        >
          Lalande
        </button>
        <button
          type="button"
          className={cn('transition-opacity hover:opacity-80', houseSide === 'petite_maison' ? 'font-extrabold' : 'font-normal opacity-60')}
          onClick={() => setHouseSide('petite_maison')}
        >
          Petite maison
        </button>
      </div>

      {nights > 0 && (
        <div
          className={cn(
            'flex flex-wrap items-baseline gap-x-1.5 text-xs uppercase tracking-[0.08em] md:text-sm',
            light ? 'text-foreground/60' : 'text-foreground'
          )}
        >
          <span>Taxe de séjour :</span>
          <span className="font-extrabold">
            {nights} nuit{nights > 1 ? 's' : ''} : {formatCurrency(amount)}
          </span>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {showDelete ? (
          <button type="button" className={stayPillOuterClass} onClick={handleRemove} disabled={removing || saving}>
            <Minus className={cn('h-3.5 w-3.5', light ? 'text-foreground/60' : 'text-foreground')} />
            <span className={stayPillTextClass(light)}>
              Supprimer ce séjour
            </span>
          </button>
        ) : (
          <span />
        )}
        <button type="button" className={stayPillOuterClass} disabled={!canSubmit || saving} onClick={handleValidate}>
          <span className={stayPillTextClass(light)}>
            {saving ? 'Enregistrement...' : hasSavedBooking && !dirty ? 'Modifier' : 'Valider'}
          </span>
        </button>
      </div>
    </StayBanner>
  )
}
