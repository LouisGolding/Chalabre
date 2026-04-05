'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calculateTotalTS, formatCurrency } from '@/lib/utils'
import { Profile, Room } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { differenceInYears, parseISO } from 'date-fns'

interface BookingFormProps {
  profile: Profile
  rooms: Room[]
}

export function BookingForm({ profile, rooms }: BookingFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [roomId, setRoomId] = useState('')
  const [notes, setNotes] = useState('')

  const userAge = differenceInYears(new Date(), parseISO(profile.date_of_birth))

  const tsAmount = checkIn && checkOut
    ? calculateTotalTS(new Date(checkIn), new Date(checkOut), userAge, true)
    : 0

  const nights = checkIn && checkOut
    ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        user_id: profile.id,
        room_id: roomId || null,
        check_in: checkIn,
        check_out: checkOut,
        notes: notes || null,
      })
      .select()
      .single()

    if (bookingError) {
      setError(bookingError.message)
      setLoading(false)
      return
    }

    // Create TS payment record
    await supabase.from('ts_payments').insert({
      booking_id: booking.id,
      user_id: profile.id,
      amount: tsAmount,
      status: 'pending',
    })

    router.push('/dashboard/planning')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nouveau séjour</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Arrivée</Label>
              <Input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Départ</Label>
              <Input
                type="date"
                value={checkOut}
                min={checkIn}
                onChange={(e) => setCheckOut(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Chambre (optionnel)</Label>
            <Select onValueChange={(val: string | null) => setRoomId(val ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="Pas de préférence" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map(room => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name} ({room.family_group === 'lalande' ? 'Lalande' : 'Canat'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes (horaire train, etc.)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Arrivée gare de Bram à 14h30"
            />
          </div>

          {nights > 0 && (
            <div className="bg-stone-50 rounded-lg p-4 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Durée</span>
                <span className="font-medium">{nights} nuit{nights > 1 ? 's' : ''}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Taxe de séjour</span>
                <span className="font-semibold text-primary">{formatCurrency(tsAmount)}</span>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Réservation...' : 'Confirmer le séjour'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
