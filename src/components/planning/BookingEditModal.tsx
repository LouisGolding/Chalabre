'use client'

import { useMemo, useState } from 'react'
import { differenceInCalendarDays } from 'date-fns'
import { calculateTotalTS, formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import type { HouseSide } from '@/types'

// Modale d'édition d'un séjour, ouverte en cliquant sur sa ligne colorée
// dans le planning (voir PlanningView.tsx). Complète le glisser-déposer
// (déplacer / étendre depuis les bords) par une saisie exacte des dates,
// et permet de le supprimer — y compris pour un séjour déjà passé
// (demandé par Nicolas le 21/09/2026 : "il faut que ce séjour soit
// modifiable à tout moment même après le séjour").
//
// Le montant de la taxe de séjour est toujours recalculé en intégralité
// ici à partir des dates et de la tranche d'âge actuellement affichées —
// jamais additionné à ce qui existait avant l'édition (même logique que
// StayEntry dans NextStayCard.tsx et que /api/bookings/quick, qui écrase
// la ligne existante plutôt que d'en garder une trace).
export interface EditableBooking {
  id: string
  check_in: string
  check_out: string
  house_side?: HouseSide | null
  label: string
  // 10 (enfant) ou 20 (adulte) — cf. calculateTotalTS. Déduit par
  // PlanningView de la date de naissance du titulaire (ou "adulte" par
  // défaut pour un accompagnant, comme dans StayEntry), faute de tranche
  // d'âge mémorisée en base pour un séjour existant.
  ageRateHint: number
}

interface BookingEditModalProps {
  booking: EditableBooking
  editable: boolean
  saving: boolean
  error: string | null
  onClose: () => void
  onSave: (checkIn: string, checkOut: string, houseSide: HouseSide, ageBracket: 'child' | 'adult') => void
  onDelete: () => void
}

export function BookingEditModal({ booking, editable, saving, error, onClose, onSave, onDelete }: BookingEditModalProps) {
  const [checkIn, setCheckIn] = useState(booking.check_in)
  const [checkOut, setCheckOut] = useState(booking.check_out)
  const [houseSide, setHouseSide] = useState<HouseSide>(booking.house_side ?? 'lalande')
  const [ageBracket, setAgeBracket] = useState<'child' | 'adult'>(booking.ageRateHint === 10 ? 'child' : 'adult')

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0
    const diff = differenceInCalendarDays(new Date(checkOut), new Date(checkIn))
    return diff > 0 ? diff : 0
  }, [checkIn, checkOut])

  const amount = useMemo(() => {
    if (nights <= 0) return 0
    return calculateTotalTS(new Date(checkIn), new Date(checkOut), ageBracket === 'child' ? 10 : 20, true)
  }, [checkIn, checkOut, nights, ageBracket])

  const canSubmit = editable && !!checkIn && !!checkOut && nights > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-xl bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-foreground">{booking.label}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!editable && (
          <p className="mt-2 text-sm text-muted-foreground">
            Ce séjour appartient à un autre compte : lecture seule.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-foreground">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            Du
            <input
              type="date"
              value={checkIn}
              disabled={!editable}
              onChange={(e) => setCheckIn(e.target.value)}
              className="border-0 border-b border-foreground/30 bg-transparent px-1 py-0.5 text-foreground outline-none focus:border-foreground disabled:opacity-60"
            />
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            au
            <input
              type="date"
              value={checkOut}
              min={checkIn || undefined}
              disabled={!editable}
              onChange={(e) => setCheckOut(e.target.value)}
              className="border-0 border-b border-foreground/30 bg-transparent px-1 py-0.5 text-foreground outline-none focus:border-foreground disabled:opacity-60"
            />
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!editable}
              variant={ageBracket === 'child' ? 'default' : 'outline'}
              className={ageBracket === 'child' ? 'bg-foreground text-background hover:bg-foreground/80' : ''}
              onClick={() => setAgeBracket('child')}
            >
              0-16 ans
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!editable}
              variant={ageBracket === 'adult' ? 'default' : 'outline'}
              className={ageBracket === 'adult' ? 'bg-foreground text-background hover:bg-foreground/80' : ''}
              onClick={() => setAgeBracket('adult')}
            >
              17 ans et +
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!editable}
              variant={houseSide === 'canat' ? 'default' : 'outline'}
              className={houseSide === 'canat' ? 'bg-foreground text-background hover:bg-foreground/80' : ''}
              onClick={() => setHouseSide('canat')}
            >
              Canat
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!editable}
              variant={houseSide === 'lalande' ? 'default' : 'outline'}
              className={houseSide === 'lalande' ? 'bg-foreground text-background hover:bg-foreground/80' : ''}
              onClick={() => setHouseSide('lalande')}
            >
              Lalande
            </Button>
          </div>
        </div>

        {nights > 0 && (
          <p className="mt-4 text-sm font-light text-muted-foreground">
            {nights} nuit{nights > 1 ? 's' : ''} · Taxe de séjour :{' '}
            <span className="font-semibold text-foreground">{formatCurrency(amount)}</span>
          </p>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {editable && (
          <div className="mt-5 flex items-center justify-between gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onDelete} disabled={saving}>
              Supprimer ce séjour
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
                Annuler
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!canSubmit || saving}
                className="bg-foreground text-background hover:bg-foreground/80"
                onClick={() => onSave(checkIn, checkOut, houseSide, ageBracket)}
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
