import { PageTitle } from '@/components/layout/PageTitle'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Forme des lignes du journal payment_events -- pas de typage Supabase
// genere dans ce projet, donc type explicite plutot qu'un `any` (eslint
// `@typescript-eslint/no-explicit-any` doit rester propre).
type PaymentEventRow = {
  id: string
  status: string
  stripe_event_type: string
  amount: number | null
  processed_at: string
}

export default async function AdminPaiementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  // Seuls amount/status sont necessaires ici (calcul des KPIs ci-dessous)
  // -- le detail complet (profils, sejours...) a demenage avec le
  // tableau "Listes des sejours" dans l'onglet "Membres" le 07/10/2026,
  // demande par Nicolas (voir dashboard/admin/page.tsx).
  const { data: tsPayments } = await supabase
    .from('ts_payments')
    .select('amount, status')

  // Tous les paiements TM
  const { data: tmPayments } = await supabase
    .from('tm_payments')
    .select('amount, status')

  // Audit log
  const { data: eventsRaw } = await supabase
    .from('payment_events')
    .select('*')
    .order('processed_at', { ascending: false })
    .limit(50)
  const events = (eventsRaw ?? []) as unknown as PaymentEventRow[]

  const totalPaid = [
    ...(tsPayments?.filter(p => p.status === 'paid') ?? []),
    ...(tmPayments?.filter(p => p.status === 'paid') ?? []),
  ].reduce((s, p) => s + Number(p.amount), 0)

  const totalPending = [
    ...(tsPayments?.filter(p => p.status !== 'paid') ?? []),
    ...(tmPayments?.filter(p => p.status !== 'paid') ?? []),
  ].reduce((s, p) => s + Number(p.amount), 0)

  return (
    <div className="space-y-6">
      <PageTitle>Suivi des paiements</PageTitle>

      {/* KPIs -- titres traites comme ceux des widgets du Guide de la
          maison (text-sm md:text-base uppercase tracking-wide, voir
          GuideCard.tsx) -- demande par Nicolas le 05/10/2026. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm md:text-base uppercase tracking-wide">Total encaissé</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm md:text-base uppercase tracking-wide">En attente</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-orange-500">{formatCurrency(totalPending)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm md:text-base uppercase tracking-wide">Transactions Stripe</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-stone-700">{events.filter(e => e.status === 'success').length}</div></CardContent>
        </Card>
      </div>

      {/* Audit log */}
      {events.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Journal des événements Stripe</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {events.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                  <div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium mr-2 ${e.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {e.status === 'success' ? 'Succès' : 'Échec'}
                    </span>
                    <span className="text-stone-600">{e.stripe_event_type}</span>
                    {e.amount && <span className="ml-2 font-medium">{formatCurrency(e.amount)}</span>}
                  </div>
                  <div className="text-xs text-stone-400 font-mono">{formatDate(e.processed_at)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
