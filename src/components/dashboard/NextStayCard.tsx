'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { differenceInYears, parseISO } from 'date-fns'
import { calculateTotalTS, formatCurrency, formatDate } from '@/lib/utils'
import { HouseSide, Profile, TSPayment } from '@/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PayButton } from '@/components/payment/PayButton'
import { CheckCircle2, Minus, Plus } from 'lucide-react'

type AgeBracket = 'child' | 'adult'
const EPSILON = 0.005

interface BookingData {
  id: string
  check_in: string
  check_out: string
  guest_name?: string | null
  house_side?: HouseSide | null
  ts_payments?: TSPayment[]
}

// Séjour enregistré (créé ou mis à jour) par un StayEntry, remonté au
// planning (voir PlanningPageClient.tsx) pour que la ligne colorée
// correspondante apparaisse instantanément, sans recharger la page
// (demandé par Aurélie le 21/09/2026). colorHue vient de la réponse de
// /api/bookings/quick (voir src/lib/colors.ts, oklchForHue).
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
  // Séjour à venir du titulaire du compte, ou null.
  booking: BookingData | null
  // Séjours déjà saisis pour des accompagnants (bouton "+"), le cas échéant.
  guestBookings?: BookingData[]
  onBookingSaved?: (booking: SavedStayInfo) => void
  onBookingDeleted?: (bookingId: string) => void
}

// Fond transparent (l'arrière-plan de la page transparaît derrière),
// typographie Bahnschrift : "Prochain séjour" / "Taxe de séjour" en
// semi-gras, dates et montant en semi-léger — comme sur le montage
// envoyé par Aurélie.
//
// Migré le 21/09/2026 (demandé par Nicolas) depuis la page d'accueil vers
// l'onglet Planning, où il apparaît sous le bouton "Réserver un séjour"
// déjà présent là-bas (voir ReserverSejour.tsx) — ce composant n'a donc
// plus sa propre pastille de déclenchement, contrairement à la version
// du 20/09/2026 : il s'affiche directement, tel quel. Le titre "Prochain
// séjour" est affiché par ReserverSejour (même ligne que la pastille
// "Solde taxe de séjour", alignée avec le bouton "Réserver un séjour" —
// 2e demande d'Aurélie le 21/09/2026), donc plus ici.
export function NextStayCard({ profile, booking, guestBookings = [], onBookingSaved, onBookingDeleted }: NextStayCardProps) {
  const computedAge = differenceInYears(new Date(), parseISO(profile.date_of_birth))

  const [guestEntries, setGuestEntries] = useState<{ localId: string; booking: BookingData | null }[]>(
    () => guestBookings.map((b) => ({ localId: b.id, booking: b }))
  )

  // Séjour principal : "- Supprimer ce séjour" ne fait disparaître aucun
  // widget (il y en a toujours un pour le titulaire), il réinitialise
  // simplement les champs — d'où l'état levé ici et la clé de remount.
  const [primaryBooking, setPrimaryBooking] = useState<BookingData | null>(booking)
  const [primaryState, setPrimaryState] = useState<{ bookingId: string | null; hasData: boolean }>({
    bookingId: booking?.id ?? null,
    hasData: !!booking,
  })
  const [primaryResetKey, setPrimaryResetKey] = useState(0)
  const [deletingPrimary, setDeletingPrimary] = useState(false)

  const handleDeletePrimary = async () => {
    if (primaryState.bookingId) {
      setDeletingPrimary(true)
      try {
        await fetch(`/api/bookings/quick?id=${primaryState.bookingId}`, { method: 'DELETE' })
      } catch {
        // On réinitialise les champs localement même si la requête échoue.
      } finally {
        setDeletingPrimary(false)
      }
      onBookingDeleted?.(primaryState.bookingId)
    }
    setPrimaryBooking(null)
    setPrimaryState({ bookingId: null, hasData: false })
    setPrimaryResetKey((k) => k + 1)
  }

  return (
    <div className="space-y-6">
      <StayEntry
        key={primaryResetKey}
        booking={primaryBooking}
        defaultAgeBracket={computedAge >= 16 ? 'adult' : 'child'}
        defaultHouseSide={profile.family_group === 'canat' || profile.family_group === 'lalande' ? profile.family_group : undefined}
        showNameField={false}
        onStateChange={setPrimaryState}
        onSaved={onBookingSaved}
      />

      {/* Rendu juste sous le séjour principal (et non plus au niveau de la
          rangée "Ajouter un séjour" tout en bas) : sinon, dès qu'un
          accompagnant est ajouté, cette pastille se retrouvait éloignée du
          séjour qu'elle supprime — demandé par Aurélie le 21/09/2026. */}
      {primaryState.hasData && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 bg-card/40 backdrop-blur-sm"
          onClick={handleDeletePrimary}
          disabled={deletingPrimary}
        >
          <Minus className="h-4 w-4" />
          Supprimer ce séjour
        </Button>
      )}

      {guestEntries.map((entry) => (
        <div key={entry.localId} className="pt-5 border-t border-foreground/10">
          <StayEntry
            booking={entry.booking}
            defaultAgeBracket="adult"
            // Un accompagnant (ex. Otto, un enfant sans compte) est saisi
            // par un titulaire qui dort forcément du même côté que lui à
            // cette occasion : on présume donc le même côté de la maison
            // que le titulaire, comme pour son propre séjour ci-dessus,
            // plutôt que de laisser ce choix vide. Avant ce correctif,
            // rien ne se sauvegardait tant que ce choix n'était pas fait à
            // la main (readyToSave restait faux) — bug repéré par Aurélie
            // le 21/09/2026 : "j'inscris le séjour d'Otto, rien ne se
            // produit".
            defaultHouseSide={profile.family_group === 'canat' || profile.family_group === 'lalande' ? profile.family_group : undefined}
            showNameField
            onRemoved={() =>
              setGuestEntries((prev) => prev.filter((e) => e.localId !== entry.localId))
            }
            onSaved={onBookingSaved}
            onDeleted={onBookingDeleted}
          />
        </div>
      ))}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 bg-card/40 backdrop-blur-sm"
          onClick={() =>
            setGuestEntries((prev) => [...prev, { localId: crypto.randomUUID(), booking: null }])
          }
        >
          <Plus className="h-4 w-4" />
          Ajouter un séjour
        </Button>
      </div>
    </div>
  )
}

interface StayEntryProps {
  booking: BookingData | null
  defaultAgeBracket: AgeBracket
  // Pré-rempli avec le côté de la maison du titulaire du compte (déduit de
  // son profil) quand c'est pertinent ; laissé vide pour les accompagnants,
  // qui peuvent dormir de l'un ou l'autre côté.
  defaultHouseSide?: HouseSide
  showNameField: boolean
  onRemoved?: () => void
  onStateChange?: (state: { bookingId: string | null; hasData: boolean }) => void
  onSaved?: (booking: SavedStayInfo) => void
  onDeleted?: (bookingId: string) => void
}

function StayEntry({
  booking,
  defaultAgeBracket,
  defaultHouseSide,
  showNameField,
  onRemoved,
  onStateChange,
  onSaved,
  onDeleted,
}: StayEntryProps) {
  const initialPayments = booking?.ts_payments ?? []
  const initialPaidAmount = initialPayments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount), 0)
  const initialPending = initialPayments.find((p) => p.status === 'pending') ?? null

  const [guestName, setGuestName] = useState(booking?.guest_name ?? '')
  const [checkIn, setCheckIn] = useState(booking?.check_in ?? '')
  const [checkOut, setCheckOut] = useState(booking?.check_out ?? '')
  const [ageBracket, setAgeBracket] = useState<AgeBracket>(defaultAgeBracket)
  const [houseSide, setHouseSide] = useState<HouseSide | null>(booking?.house_side ?? defaultHouseSide ?? null)
  const [bookingId, setBookingId] = useState<string | null>(booking?.id ?? null)
  const [paidAmount, setPaidAmount] = useState(initialPaidAmount)
  const [pendingPayment, setPendingPayment] = useState<TSPayment | null>(initialPending)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [synced, setSynced] = useState(initialPayments.length > 0)
  const [error, setError] = useState<string | null>(null)

  // bookingId "vu" par le prochain enregistrement (voir l'effet ci-dessous) :
  // un ref plutôt que l'état React seul, pour être lu/écrit de façon
  // synchrone dans la file d'enregistrements (saveQueueRef) sans dépendre
  // d'un re-rendu.
  const bookingIdRef = useRef(bookingId)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const isMountedRef = useRef(true)
  useEffect(
    () => () => {
      isMountedRef.current = false
    },
    []
  )

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0
    const diff = Math.ceil(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
    )
    return diff > 0 ? diff : 0
  }, [checkIn, checkOut])

  // Montant total de la TS pour le séjour tel qu'il est saisi actuellement.
  const amount = useMemo(() => {
    if (nights <= 0) return 0
    return calculateTotalTS(new Date(checkIn), new Date(checkOut), ageBracket === 'child' ? 10 : 20, true)
  }, [checkIn, checkOut, nights, ageBracket])

  // Solde restant à régler = montant total actuel − ce qui a déjà été payé.
  // Peut être négatif si les dates ont été raccourcies après paiement (trop perçu).
  const due = useMemo(() => Math.round((amount - paidAmount) * 100) / 100, [amount, paidAmount])
  const isSettled = paidAmount > 0 && Math.abs(due) < EPSILON
  const isOverpaid = due < -EPSILON

  const readyToSave = checkIn && checkOut && nights > 0 && !!houseSide && (!showNameField || guestName.trim())

  // Enregistrement automatique (avec un léger débounce) dès que les champs
  // sont valides. Se déclenche aussi si le séjour est déjà (partiellement)
  // payé, pour recalculer le solde.
  //
  // Les enregistrements sont mis à la file (saveQueueRef) plutôt qu'envoyés
  // en parallèle : si un enregistrement précédent est encore en cours
  // (requête réseau pas encore terminée) quand un nouveau se déclenche, ce
  // dernier attend que le précédent se termine et pose le véritable
  // bookingId (bookingIdRef) avant de partir à son tour. Sans ça, les deux
  // partiraient avec bookingId=null (le premier n'ayant pas encore reçu sa
  // réponse) et créeraient deux séjours en base au lieu d'un seul mis à
  // jour — doublon repéré par Aurélie le 21/09/2026 sur le planning
  // (compteur de présence à "2" pour une seule personne).
  useEffect(() => {
    if (!readyToSave) return

    setSynced(false)
    setSaving(true)
    setError(null)

    const timeout = setTimeout(() => {
      saveQueueRef.current = saveQueueRef.current.then(async () => {
        // Garde-fou : si la requête reste bloquée (réseau capricieux), on
        // n'affiche pas "Enregistrement..." indéfiniment — au bout de 15s
        // sans réponse, on abandonne et on affiche une erreur explicite,
        // pour que ce soit visible et qu'on sache qu'il faut réessayer
        // (demandé par Nicolas le 23/09/2026, après un séjour resté
        // bloqué sur "Enregistrement..." sans qu'on sache pourquoi).
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
              bookingId: bookingIdRef.current,
              guestName: showNameField ? guestName.trim() : undefined,
              houseSide,
            }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error ?? 'Erreur lors de l’enregistrement')

          bookingIdRef.current = data.bookingId
          if (!isMountedRef.current) return
          setBookingId(data.bookingId)
          setPaidAmount(data.paidAmount ?? 0)
          setPendingPayment(data.pendingPayment ?? null)
          setSynced(true)
          onSaved?.({
            id: data.bookingId,
            check_in: checkIn,
            check_out: checkOut,
            guest_name: showNameField ? guestName.trim() || null : null,
            house_side: houseSide,
            colorHue: typeof data.colorHue === 'number' ? data.colorHue : null,
          })
        } catch (err) {
          if (isMountedRef.current) {
            const timedOut = err instanceof Error && err.name === 'AbortError'
            setError(timedOut ? 'La connexion est trop lente, réessaie.' : err instanceof Error ? err.message : 'Erreur')
          }
        } finally {
          clearTimeout(timeoutId)
          if (isMountedRef.current) setSaving(false)
        }
      })
    }, 600)

    return () => {
      clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIn, checkOut, ageBracket, houseSide, guestName, readyToSave])

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

  // Signale au parent l'identifiant de réservation courant et si des champs
  // ont été saisis, pour piloter l'affichage de "Supprimer ce séjour" côté
  // séjour principal (pas de widget à faire disparaître, juste un reset).
  useEffect(() => {
    onStateChange?.({ bookingId, hasData: !!(checkIn || checkOut) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, checkIn, checkOut])

  const ageToggle = (
    <div className="flex gap-2">
      <Button
        type="button"
        size="sm"
        variant={ageBracket === 'child' ? 'default' : 'outline'}
        className={
          ageBracket === 'child'
            ? 'bg-foreground text-background hover:bg-foreground/80'
            : 'bg-card/40 backdrop-blur-sm'
        }
        onClick={() => setAgeBracket('child')}
      >
        0-16 ans
      </Button>
      <Button
        type="button"
        size="sm"
        variant={ageBracket === 'adult' ? 'default' : 'outline'}
        className={
          ageBracket === 'adult'
            ? 'bg-foreground text-background hover:bg-foreground/80'
            : 'bg-card/40 backdrop-blur-sm'
        }
        onClick={() => setAgeBracket('adult')}
      >
        17 ans et +
      </Button>
    </div>
  )

  // Côté de la maison (Canat / Lalande / Petite maison) où dort la
  // personne pour ce séjour — détermine sur quel compte bancaire la taxe
  // de séjour est versée. Même pastille que le sélecteur d'âge, juste à
  // côté. "Petite maison" (demandé par Aurélie le 21/09/2026) : une
  // dépendance distincte de la maison principale, même tarif de taxe de
  // séjour que Canat/Lalande, mais son paiement suit le même circuit que
  // Lalande (voir HouseSide dans src/types/index.ts).
  const houseSideToggle = (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant={houseSide === 'canat' ? 'default' : 'outline'}
        className={
          houseSide === 'canat'
            ? 'bg-foreground text-background hover:bg-foreground/80'
            : 'bg-card/40 backdrop-blur-sm'
        }
        onClick={() => setHouseSide('canat')}
      >
        Canat
      </Button>
      <Button
        type="button"
        size="sm"
        variant={houseSide === 'lalande' ? 'default' : 'outline'}
        className={
          houseSide === 'lalande'
            ? 'bg-foreground text-background hover:bg-foreground/80'
            : 'bg-card/40 backdrop-blur-sm'
        }
        onClick={() => setHouseSide('lalande')}
      >
        Lalande
      </Button>
      <Button
        type="button"
        size="sm"
        variant={houseSide === 'petite_maison' ? 'default' : 'outline'}
        className={
          houseSide === 'petite_maison'
            ? 'bg-foreground text-background hover:bg-foreground/80'
            : 'bg-card/40 backdrop-blur-sm'
        }
        onClick={() => setHouseSide('petite_maison')}
      >
        Petite maison
      </Button>
    </div>
  )

  const paymentStatus = isSettled ? (
    <Badge className="bg-green-600 hover:bg-green-600 gap-1">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Payé
    </Badge>
  ) : isOverpaid ? null : due > EPSILON && pendingPayment && synced && !saving ? (
    <PayButton
      type="ts"
      paymentId={pendingPayment.id}
      amount={due}
      label={`Taxe de séjour — ${formatDate(checkIn)} au ${formatDate(checkOut)}`}
      className="bg-foreground text-background hover:bg-foreground/80"
    />
  ) : (
    <span className="text-sm font-light text-muted-foreground">{saving ? 'Enregistrement...' : ''}</span>
  )

  // Grille "dates / âge" + "Taxe de séjour", strictement identique pour le
  // séjour principal et pour les séjours d'accompagnants (bouton "+") :
  // fond transparent, dates soulignées, montant en semi-léger. Le titre
  // "Prochain séjour" est affiché par ReserverSejour.tsx (voir plus haut),
  // pas ici.
  const stayFields = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-light text-base md:text-lg text-foreground">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            Du
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="border-0 border-b border-foreground/30 bg-transparent px-1 py-0.5 font-light text-base md:text-lg text-foreground outline-none focus:border-foreground"
            />
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            au
            <input
              type="date"
              value={checkOut}
              min={checkIn || undefined}
              onChange={(e) => setCheckOut(e.target.value)}
              className="border-0 border-b border-foreground/30 bg-transparent px-1 py-0.5 font-light text-base md:text-lg text-foreground outline-none focus:border-foreground"
            />
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {ageToggle}
          {houseSideToggle}
        </div>
      </div>

      {/* Pastille "Solde taxe de séjour" déplacée sous "Cotisation
          mensuelle" en haut de la page d'accueil le 18/09/2026, puis sur
          l'onglet Planning (à côté de "Prochain séjour") le 21/09/2026 —
          voir ReserverSejour.tsx — ne s'affiche donc plus ici. */}
      {checkIn && checkOut && nights > 0 && (
        <div>
          <h2 className="font-normal text-xl md:text-2xl text-foreground">Taxe de séjour</h2>
          <p className="mt-2 font-light text-base md:text-lg text-foreground">
            {nights} nuit{nights > 1 ? 's' : ''} ·{' '}
            <span className={`font-semibold ${isOverpaid ? 'text-amber-600' : 'text-foreground'}`}>
              {isSettled ? formatCurrency(0) : formatCurrency(due)}
            </span>
          </p>
          <div className="mt-3">{paymentStatus}</div>
        </div>
      )}
    </div>
  )

  if (!showNameField) {
    return (
      <div className="space-y-4">
        {stayFields}

        {!checkIn && !checkOut && (
          <p className="text-sm font-light text-muted-foreground">
            Indique tes prochaines dates d’arrivée et de départ pour calculer ta taxe de séjour.
          </p>
        )}

        {checkIn && checkOut && nights > 0 && !houseSide && (
          <p className="text-sm font-light text-muted-foreground">
            Indique le côté de la maison (Canat ou Lalande) pour enregistrer ce séjour.
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nom Prénom</Label>
        <Input
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="Ex: Emma Lalande"
        />
      </div>

      {stayFields}

      {checkIn && checkOut && !guestName.trim() && (
        <p className="text-sm text-muted-foreground">Indique un nom pour enregistrer ce séjour.</p>
      )}

      {checkIn && checkOut && nights > 0 && guestName.trim() && !houseSide && (
        <p className="text-sm text-muted-foreground">
          Indique le côté de la maison (Canat ou Lalande) pour enregistrer ce séjour.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 bg-card/40 backdrop-blur-sm"
        onClick={handleRemove}
        disabled={removing}
      >
        <Minus className="h-4 w-4" />
        Supprimer ce séjour
      </Button>
    </div>
  )
}
