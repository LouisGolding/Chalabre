import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatDate, formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Home, Calendar, Users, TrendingUp } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')

  // Get user's bookings
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, ts_payments(*)')
    .eq('user_id', user.id)
    .order('check_in', { ascending: true })

  const today = new Date()
  const pastBookings = bookings?.filter(b => new Date(b.check_out) < today) ?? []
  const futureBookings = bookings?.filter(b => new Date(b.check_in) >= today) ?? []
  const nextBooking = futureBookings[0]
  const lastBooking = pastBookings[pastBookings.length - 1]

  // Get current occupants
  const { data: currentBookings } = await supabase
    .from('bookings')
    .select('*, profiles(first_name, last_name)')
    .lte('check_in', today.toISOString().split('T')[0])
    .gte('check_out', today.toISOString().split('T')[0])

  // Get TS balance
  const { data: tsPayments } = await supabase
    .from('ts_payments')
    .select('amount, status')
    .eq('user_id', user.id)

  const tsPending = tsPayments?.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0) ?? 0

  // Get TM status
  const currentMonth = today.toISOString().slice(0, 7)
  const { data: tmPayment } = await supabase
    .from('tm_payments')
    .select('*')
    .eq('user_id', user.id)
    .eq('month', currentMonth)
    .single()

  const isFriend = profile.role === 'friend'

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold text-stone-800">
          Bonjour, {profile.first_name} {profile.last_name}
        </h1>
        <p className="text-stone-500 mt-1">Bienvenue à La Bâtisse</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dernier séjour</CardTitle>
            <Calendar className="h-4 w-4 text-stone-400" />
          </CardHeader>
          <CardContent>
            {lastBooking ? (
              <div className="text-lg font-semibold text-stone-700">
                {formatDate(lastBooking.check_out)}
              </div>
            ) : (
              <p className="text-stone-400 text-sm">Aucun séjour</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prochain séjour</CardTitle>
            <Home className="h-4 w-4 text-stone-400" />
          </CardHeader>
          <CardContent>
            {nextBooking ? (
              <div>
                <div className="text-lg font-semibold text-stone-700">
                  {formatDate(nextBooking.check_in)}
                </div>
                <p className="text-xs text-stone-400">au {formatDate(nextBooking.check_out)}</p>
              </div>
            ) : (
              <p className="text-stone-400 text-sm">Aucun séjour prévu</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solde TS</CardTitle>
            <TrendingUp className="h-4 w-4 text-stone-400" />
          </CardHeader>
          <CardContent>
            <div className={`text-lg font-semibold ${tsPending > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {tsPending > 0 ? `-${formatCurrency(tsPending)}` : formatCurrency(0)}
            </div>
            <p className="text-xs text-stone-400">
              {tsPending > 0 ? 'À régler' : 'À jour'}
            </p>
          </CardContent>
        </Card>

        {!isFriend && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">TM ce mois</CardTitle>
              <TrendingUp className="h-4 w-4 text-stone-400" />
            </CardHeader>
            <CardContent>
              {tmPayment ? (
                <div>
                  <div className={`text-lg font-semibold ${tmPayment.status === 'paid' ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(tmPayment.amount)}
                  </div>
                  <Badge variant={tmPayment.status === 'paid' ? 'default' : 'destructive'} className="text-xs mt-1">
                    {tmPayment.status === 'paid' ? 'Payé' : 'En attente'}
                  </Badge>
                </div>
              ) : (
                <p className="text-stone-400 text-sm">Non renseigné</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Current occupants */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Présents en ce moment
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentBookings && currentBookings.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {currentBookings.map((booking: any) => (
                <Badge key={booking.id} variant="secondary">
                  {booking.profiles?.first_name} {booking.profiles?.last_name}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-stone-400 text-sm">Personne en ce moment</p>
          )}
        </CardContent>
      </Card>

      {/* Upcoming bookings */}
      {futureBookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Mes prochains séjours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {futureBookings.slice(0, 3).map((booking) => (
                <div key={booking.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-stone-700">
                      {formatDate(booking.check_in)} → {formatDate(booking.check_out)}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {Math.ceil((new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / (1000 * 60 * 60 * 24))} nuits
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
