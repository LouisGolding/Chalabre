'use client'

import { useEffect, useMemo, useState } from 'react'
import { differenceInYears, parseISO } from 'date-fns'
import { calculateTotalTS, cn, firstNameOnly, formatCurrency, normalizeName, stayPhase } from '@/lib/utils'
import { HouseSide, Profile, TSPayment } from '@/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { TSBalancePayButton } from '@/components/payment/TSBalancePayButton'
import { ChevronDown, Minus } from 'lucide-react'
import type { TsBalanceResult, TsGuestBalance } from '@/lib/ts-balance'
import { fallbackHueForName, oklchForHue } from '@/lib/colors'

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
  // Teinte pastel de cet occupant (voir src/lib/colors.ts), resolue cote
  // serveur -- sert a colorer le fond de sa banniere ci-dessous.
  color_hue?: number | null
}

export interface SavedStayInfo {
  id: string
  check_in: string
  check_out: string
  guest_name: string | null
  house_side: HouseSide | null
  colorHue: number | null
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

function soldeAmountClass(pending: number) {
  return pending > 0 ? 'text-red-600' : 'text-foreground'
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

const pillClass =
  'inline-flex h-8 w-fit shrink-0 items-center whitespace-nowrap rounded-lg border border-border bg-card/40 px-2.5 text-sm font-extrabold text-foreground backdrop-blur-sm'

function BalancePill({ pending, ids }: { pending: number; ids: string[] }) {
  const content = (
    <>
      TS:<span className={`ml-1 ${soldeAmountClass(pending)}`}>{soldeLabel(pending)}€</span>
    </>
  )
  if (ids.length === 0) {
    return <span className={pillClass}>{content}</span>
  }
  return (
    <TSBalancePayButton ids={ids} className={pillClass}>
      {content}
    </TSBalancePayButton>
  )
}

// Bannière dépliable : titre à gauche (bascule le contenu au clic),
// pastille de solde à droite (clic séparé, lien de paiement). Même
// esthétique que les autres pastilles du site (bg-card/40 + flou).
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
  // translucide par defaut.
  bgColor?: string
}) {
  // Widget colore (bgColor present) : texte en transparence pour laisser
  // apparaitre la couleur de fond (demande par Nicolas le 29/09/2026) --
  // ne s'applique pas a la banniere generique "Ajouter un sejour", qui
  // garde sa typo pleine (noire).
  const light = !!bgColor
  return (
    <div
      className={cn('rounded-xl border border-border backdrop-blur-sm', !bgColor && 'bg-card/40')}
      style={bgColor ? { backgroundColor: bgColor } : undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className={cn(
            'flex min-w-0 items-center gap-2 text-left text-lg md:text-xl font-normal hover:opacity-80',
            light ? 'text-foreground/60' : 'text-foreground'
          )}
        >
          <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', isOpen && 'rotate-180')} />
          <span className="truncate">{title}</span>
        </button>
        {pill}
      </div>
      {isOpen && <div className="space-y-4 border-t border-border/60 px-4 py-4">{children}</div>}
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

  // Couleur du titulaire (voir src/lib/colors.ts) : sa teinte enregistree
  // en base si elle existe deja, sinon un repli calcule depuis son nom
  // (memes regles que le planning, resolveColor dans planning/page.tsx).
  const ownerHue = typeof profile.color_hue === 'number' ? profile.color_hue : fallbackHueForName(`${profile.first_name} ${profile.last_name}`)
  const ownerColor = oklchForHue(ownerHue)

  const [guestEntries, setGuestEntries] = useState<{ localId: string; booking: BookingData | null; colorHue: number | null }[]>(
    () => guestBookings.map((b) => ({ localId: b.id, booking: b, colorHue: typeof b.color_hue === 'number' ? b.color_hue : null }))
  )
  const [primaryBooking, setPrimaryBooking] = useState<BookingData | null>(booking)
  const [primaryResetKey, setPrimaryResetKey] = useState(0)
  const [addSlotResetKey, setAddSlotResetKey] = useState(0)

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
        pill={<BalancePill pending={tsBalance.own.pending} ids={tsBalance.own.items.map((i) => i.id)} />}
        bgColor={ownerColor}
        onSaved={onBookingSaved}
        onDeleted={handlePrimaryDeleted}
        onHiddenChange={(id) => setEntryHidden('primary', id)}
      />

      {guestEntries.map((entry) => {
        const bucket = findGuestBucket(tsBalance, entry.booking?.guest_name ?? null)
        const guestFirstName = entry.booking?.guest_name ? firstNameOnly(entry.booking.guest_name) : ''
        // Couleur de cet accompagnant : sa teinte connue (chargee au
        // montage, ou renvoyee par l'API a l'enregistrement — voir
        // handleAddSlotSaved et le onSaved ci-dessous), sinon un repli
        // calcule depuis son nom.
        const guestColor = oklchForHue(entry.colorHue ?? fallbackHueForName(entry.booking?.guest_name || 'Accompagnant'))
        return (
          <StayEntry
            key={entry.localId}
            entryKey={entry.localId}
            booking={entry.booking}
            defaultAgeBracket="adult"
            defaultHouseSide={profile.family_group === 'canat' || profile.family_group === 'lalande' ? profile.family_group : undefined}
            showNameField
            titleWhenEmpty="Ajouter un séjour"
            titleWhenUpcoming={`Prochain séjour ${guestFirstName}`}
            titleWhenOngoing={`Séjour ${guestFirstName} en cours`}
            pill={<BalancePill pending={bucket?.pending ?? 0} ids={bucket?.items.map((i) => i.id) ?? []} />}
            bgColor={guestColor}
            onRemoved={() => setGuestEntries((prev) => prev.filter((e) => e.localId !== entry.localId))}
            onSaved={(saved) => {
              onBookingSaved?.(saved)
              // Le nom a pu changer pendant cette modification (donc,
              // potentiellement, sa teinte assignee) : on la resynchronise
              // avec ce que l'API a renvoye plutot que de garder l'ancienne.
              setGuestEntries((prev) =>
                prev.map((e) => (e.localId === entry.localId ? { ...e, colorHue: saved.colorHue } : e))
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
        pill={<BalancePill pending={0} ids={[]} />}
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
  pill: React.ReactNode
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
  pill,
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

  return (
    <StayBanner title={title} pill={pill} isOpen={isOpen} onToggle={handleToggle} bgColor={bgColor}>
      {showNameField && (
        <div className="space-y-2">
          <Label>Nom Prénom</Label>
          <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Ex: Emma Lalande" />
        </div>
      )}

      <div
        className={cn(
          'flex flex-wrap items-center gap-x-3 gap-y-1 font-light text-base md:text-lg',
          light ? 'text-foreground/60' : 'text-foreground'
        )}
      >
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          Du
          <input
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className={cn(
              'border-0 border-b border-foreground/30 bg-transparent px-1 py-0.5 font-light text-base md:text-lg outline-none focus:border-foreground',
              light ? 'text-foreground/60' : 'text-foreground'
            )}
          />
        </span>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          au
          <input
            type="date"
            value={checkOut}
            min={checkIn || undefined}
            onChange={(e) => setCheckOut(e.target.value)}
            className={cn(
              'border-0 border-b border-foreground/30 bg-transparent px-1 py-0.5 font-light text-base md:text-lg outline-none focus:border-foreground',
              light ? 'text-foreground/60' : 'text-foreground'
            )}
          />
        </span>
      </div>

      <div className="space-y-2">
        <Label className={light ? 'text-foreground/60' : undefined}>Note</Label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: Gare de Pamiers 14h45"
          className={light ? 'text-foreground/60' : undefined}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={ageBracket === 'child' ? 'default' : 'outline'}
            className={ageBracket === 'child' ? 'bg-foreground text-background hover:bg-foreground/80' : 'bg-card/40 backdrop-blur-sm'}
            onClick={() => setAgeBracket('child')}
          >
            0-16 ans
          </Button>
          <Button
            type="button"
            size="sm"
            variant={ageBracket === 'adult' ? 'default' : 'outline'}
            className={ageBracket === 'adult' ? 'bg-foreground text-background hover:bg-foreground/80' : 'bg-card/40 backdrop-blur-sm'}
            onClick={() => setAgeBracket('adult')}
          >
            17 ans et +
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={houseSide === 'canat' ? 'default' : 'outline'}
            className={houseSide === 'canat' ? 'bg-foreground text-background hover:bg-foreground/80' : 'bg-card/40 backdrop-blur-sm'}
            onClick={() => setHouseSide('canat')}
          >
            Canat
          </Button>
          <Button
            type="button"
            size="sm"
            variant={houseSide === 'lalande' ? 'default' : 'outline'}
            className={houseSide === 'lalande' ? 'bg-foreground text-background hover:bg-foreground/80' : 'bg-card/40 backdrop-blur-sm'}
            onClick={() => setHouseSide('lalande')}
          >
            Lalande
          </Button>
          <Button
            type="button"
            size="sm"
            variant={houseSide === 'petite_maison' ? 'default' : 'outline'}
            className={houseSide === 'petite_maison' ? 'bg-foreground text-background hover:bg-foreground/80' : 'bg-card/40 backdrop-blur-sm'}
            onClick={() => setHouseSide('petite_maison')}
          >
            Petite maison
          </Button>
        </div>
      </div>

      {nights > 0 && (
        <div>
          <h3 className={cn('font-normal text-lg md:text-xl', light ? 'text-foreground/60' : 'text-foreground')}>Calcul de votre taxe de séjour</h3>
          <p className={cn('mt-1 font-light text-base md:text-lg', light ? 'text-foreground/60' : 'text-foreground')}>
            {nights} nuit{nights > 1 ? 's' : ''} : <span className="font-semibold">{formatCurrency(amount)}</span>
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between gap-2">
        {showDelete ? (
          <Button type="button" variant="outline" size="sm" className="gap-1.5 bg-card/40 backdrop-blur-sm" onClick={handleRemove} disabled={removing || saving}>
            <Minus className="h-4 w-4" />
            Supprimer ce séjour
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="button"
          size="sm"
          disabled={!canSubmit || saving}
          className="bg-foreground text-background hover:bg-foreground/80"
          onClick={handleValidate}
        >
          {saving ? 'Enregistrement...' : hasSavedBooking && !dirty ? 'Modifier' : 'Valider'}
        </Button>
      </div>
    </StayBanner>
  )
}
