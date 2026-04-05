import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PayButton } from '@/components/payment/PayButton'
import { CheckCircle, Clock } from 'lucide-react'

export default async function MesPaiementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, bookings(*, ts_payments(*))')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')

  const { data: tsPayments } = await supabase
    .from('ts_payments')
    .select('*, bookings(check_in, check_out)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const { data: tmPayments } = await supabase
    .from('tm_payments')
    .select('*')
    .eq('user_id', user.id)
    .order('month', { ascending: false })

  const isFriend = profile.role === 'friend'
  const tsPending = tsPayments?.filter(p => p.status !== 'paid') ?? []
  const tsPaid = tsPayments?.filter(p => p.status === 'paid') ?? []
  const tmPending = tmPayments?.filter(p => p.status !== 'paid') ?? []
  const tmPaid = tmPayments?.filter(p => p.status === 'paid') ?? []

  const totalDue =
    tsPending.reduce((s, p) => s + Number(p.amount), 0) +
    tmPending.reduce((s, p) => s + Number(p.amount), 0)

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-stone-800">Mes paiements</h1>
        {totalDue > 0 && (
          <p className="text-red-600 font-medium mt-1">
            Solde dû : {formatCurrency(totalDue)}
          </p>
        )}
        {totalDue === 0 && (
          <p className="text-green-600 font-medium mt-1 flex items-center gap-1">
            <CheckCircle className="h-4 w-4" /> Tout est à jour
          </p>
        )}
      </div>

      {/* TS en attente */}
      {tsPending.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-500" />
              Taxes de séjour à régler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tsPending.map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm">
                    Séjour du {formatDate(p.bookings?.check_in)} au {formatDate(p.bookings?.check_out)}
                  </p>
                  <p className="text-xs text-stone-400">Taxe de séjour</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-red-600">{formatCurrency(p.amount)}</span>
                  <PayButton
                    type="ts"
                    paymentId={p.id}
                    amount={Number(p.amount)}
                    label={`TS — séjour du ${formatDate(p.bookings?.check_in)}`}
                    variant="default"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* TM en attente */}
      {!isFriend && tmPending.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              Cotisations mensuelles à régler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tmPending.map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm">{p.month}</p>
                  <p className="text-xs text-stone-400">Taxe mensuelle</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-orange-600">{formatCurrency(p.amount)}</span>
                  <PayButton
                    type="tm"
                    paymentId={p.id}
                    amount={Number(p.amount)}
                    label={`TM — ${p.month}`}
                    variant="default"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* TS payées */}
      {tsPaid.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-stone-500">Taxes de séjour payées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tsPaid.map(p => (
              <div key={p.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <div>
                  <p className="text-sm text-stone-600">
                    Séjour du {formatDate(p.bookings?.check_in)} au {formatDate(p.bookings?.check_out)}
                  </p>
                  {p.paid_at && <p className="text-xs text-stone-400">Payé le {formatDate(p.paid_at)}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{formatCurrency(p.amount)}</span>
                  <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100">Payé</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* TM payées */}
      {!isFriend && tmPaid.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-stone-500">Cotisations payées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tmPaid.map(p => (
              <div key={p.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <div>
                  <p className="text-sm text-stone-600">{p.month}</p>
                  {p.paid_at && <p className="text-xs text-stone-400">Payé le {formatDate(p.paid_at)}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{formatCurrency(p.amount)}</span>
                  <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100">Payé</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tsPayments?.length === 0 && (isFriend || tmPayments?.length === 0) && (
        <p className="text-stone-400 text-sm">Aucun paiement pour le moment.</p>
      )}
    </div>
  )
}
