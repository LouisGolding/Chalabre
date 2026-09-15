'use client'

import { useEffect, useMemo, useState } from 'react'
import { differenceInYears, parseISO } from 'date-fns'
import { calculateTotalTS, formatCurrency, formatDate } from '@/lib/utils'
import { Profile, TSPayment } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PayButton } from '@/components/payment/PayButton'
import { Calendar, CheckCircle2, Plus, X } from 'lucide-react'

type AgeBracket = 'child' | 'adult'
const EPSILON = 0.005

interface BookingData {
  id: string
  check_in: string
  check_out: string
  guest_name?: string | null
  ts_payments?: TSPayment[]
}

interface NextStayCardProps {
  profile: Profile
  // Séjour à venir du titulaire du compte, ou null.
  booking: BookingData | null
  // Séjours déjà saisis pour des accompagnants (bouton "+"), le cas échéant.
  guestBookings?: BookingData[]
}

export function NextStayCard({ profile, booking, guestBookings = [] }: NextStayCardProps) {
  const computedAge = differenceInYears(new Date(), parseISO(profile.date_of_birth))

  const [guestEntries, setGuestEntries] = useState<{ localId: string; booking: BookingData | null }[]>(
    () => guestBookings.map((b) => ({ localId: b.id, booking: b }))
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Prochain séjour
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <StayEntry
          booking={booking}
          defaultAgeBracket={computedAge >= 16 ? 'adult' : 'child'}
          showNameField={false}
        />

        {guestEntries.map((entry) => (
          <div key={entry.localId} className="pt-5 border-t border-stone-100">
            <StayEntry
              booking={entry.booking}
              defaultAgeBracket="adult"
              showNameField
              onRemoved={() =>
                setGuestEntries((prev) => prev.filter((e) => e.localId !== entry.localId))
              }
            />
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={() =>
            setGuestEntries((prev) => [...prev, { localId: crypto.randomUUID(), booking: null }])
          }
        >
          <Plus className="h-4 w-4" />
          Ajouter un séjour
        </Button>
      </CardContent>
    </Card>
  )
}

interface StayEntryProps {
  booking: BookingData | null
  defaultAgeBracket: AgeBracket
  showNameField: boolean
  onRemoved?: () => void
}

function StayEntry({ booking, defaultAgeBracket, showNameField, onRemoved }: StayEntryProps) {
  const initialPayments = booking?.ts_payments ?? []
  const initialPaidAmount = initialPayments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount), 0)
  const initialPending = initialPayments.find((p) => p.status === 'pending') ?? null

  const [guestName, setGuestName] = useState(booking?.guest_name ?? '')
  const [checkIn, setCheckIn] = useState(booking?.check_in ?? '')
  const [checkOut, setCheckOut] = useState(booking?.check_out ?? '')
  const [ageBracket, setAgeBracket] = useState<AgeBracket>(defaultAgeBracket)
  const [bookingId, setBookingId] = useState<string | null>(booking?.id ?? null)
  const [paidAmount, setPaidAmount] = useState(initialPaidAmount)
  const [pendingPayment, setPendingPayment] = useState<TSPayment | null>(initialPending)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [synced, setSynced] = useState(initialPayments.length > 0)
  const [error, setError] = useState<string | null>(null)

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

  const readyToSave = checkIn && checkOut && nights > 0 && (!showNameField || guestName.trim())

  // Enregistrement automatique (avec un léger débounce) dès que les champs sont valides.
  // Se déclenche aussi si le séjour est déjà (partiellement) payé, pour recalculer le solde.
  useEffect(() => {
    if (!readyToSave) return

    setSynced(false)
    setSaving(true)
    setError(null)
    let cancelled = false

    const timeout = setTimeout(async () => {
      try {
        const res = await fetch('/api/bookings/quick', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            checkIn,
            checkOut,
            amount,
            bookingId,
            guestName: showNameField ? guestName.trim() : undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Erreur lors de l’enregistrement')
        if (cancelled) return
        setBookingId(data.bookingId)
        setPaidAmount(data.paidAmount ?? 0)
        setPendingPayment(data.pendingPayment ?? null)
        setSynced(true)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur')
      } finally {
        if (!cancelled) setSaving(false)
      }
    }, 600)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIn, checkOut, ageBracket, guestName, readyToSave])

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
      onRemoved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setRemoving(false)
    }
  }

  return (
    <div className="space-y-4">
      {showNameField && (
        <div className="flex items-start gap-2">
          <div className="flex-1 space-y-2">
            <Label>Nom Prénom</Label>
            <Input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Ex: Emma Lalande"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-6 text-stone-400 hover:text-red-600"
            onClick={handleRemove}
            disabled={removing}
            aria-label="Retirer ce séjour"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Du</Label>
          <Input
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            placeholder="JJ/MM/AAAA"
          />
        </div>
        <div className="space-y-2">
          <Label>Au</Label>
          <Input
            type="date"
            value={checkOut}
            min={checkIn || undefined}
            onChange={(e) => setCheckOut(e.target.value)}
            placeholder="JJ/MM/AAAA"
          />
        </div>
      </div>

      {checkIn && checkOut && nights > 0 && (
        <>
          <div className="space-y-2">
            <Label>Âge</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={ageBracket === 'adult' ? 'default' : 'outline'}
                onClick={() => setAgeBracket('adult')}
              >
                17 ans et +
              </Button>
              <Button
                type="button"
                size="sm"
                variant={ageBracket === 'child' ? 'default' : 'outline'}
                onClick={() => setAgeBracket('child')}
              >
                0-16 ans
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-50 rounded-lg p-4">
            <div>
              <p className="text-sm text-stone-500">
                {paidAmount > 0
                  ? isOverpaid
                    ? `Trop perçu · ${nights} nuit${nights > 1 ? 's' : ''}`
                    : `Reste à payer · ${nights} nuit${nights > 1 ? 's' : ''}`
                  : `Taxe de séjour · ${nights} nuit${nights > 1 ? 's' : ''}`}
              </p>
              <p className={`text-xl font-semibold ${isOverpaid ? 'text-amber-600' : 'text-primary'}`}>
                {isSettled ? formatCurrency(0) : formatCurrency(due)}
              </p>
            </div>

            {isSettled ? (
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
              />
            ) : (
              <span className="text-sm text-stone-400">{saving ? 'Enregistrement...' : ''}</span>
            )}
          </div>
        </>
      )}

      {showNameField && checkIn && checkOut && !guestName.trim() && (
        <p className="text-sm text-stone-400">Indique un nom pour enregistrer ce séjour.</p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!checkIn && !checkOut && !showNameField && (
        <p className="text-sm text-stone-400">
          Indique tes prochaines dates d’arrivée et de départ pour calculer ta taxe de séjour.
        </p>
      )}
    </div>
  )
}
