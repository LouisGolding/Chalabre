import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function BudgetPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role === 'friend') redirect('/dashboard')

  // Get all TM payments
  const { data: tmPayments } = await supabase
    .from('tm_payments')
    .select('*, profiles(first_name, last_name)')
    .order('month', { ascending: false })

  // Get all TS payments
  const { data: tsPayments } = await supabase
    .from('ts_payments')
    .select('*, profiles(first_name, last_name)')
    .order('created_at', { ascending: false })

  // Get budget entries
  const { data: budgetEntries } = await supabase
    .from('budget_entries')
    .select('*')
    .order('date', { ascending: false })

  const totalTMPaid = tmPayments?.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0) ?? 0
  const totalTSPaid = tsPayments?.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0) ?? 0
  const totalIncome = totalTMPaid + totalTSPaid
  const totalExpenses = budgetEntries?.filter(e => e.entry_type === 'expense').reduce((sum, e) => sum + e.amount, 0) ?? 0

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-stone-800">Budget</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Solde disponible</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${totalIncome - totalExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalIncome - totalExpenses)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Total encaissé (TM + TS)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-stone-700">{formatCurrency(totalIncome)}</div>
            <p className="text-xs text-stone-400 mt-1">TM: {formatCurrency(totalTMPaid)} · TS: {formatCurrency(totalTSPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Total dépenses</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{formatCurrency(totalExpenses)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent TM */}
      <Card>
        <CardHeader><CardTitle>Taxes Mensuelles (TM)</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tmPayments?.slice(0, 10).map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm">{p.profiles?.first_name} {p.profiles?.last_name}</p>
                  <p className="text-xs text-stone-400">{p.month}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatCurrency(p.amount)}</span>
                  <Badge variant={p.status === 'paid' ? 'default' : 'destructive'}>
                    {p.status === 'paid' ? 'Payé' : 'En attente'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent TS */}
      <Card>
        <CardHeader><CardTitle>Taxes de Séjour (TS)</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tsPayments?.slice(0, 10).map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm">{p.profiles?.first_name} {p.profiles?.last_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatCurrency(p.amount)}</span>
                  <Badge variant={p.status === 'paid' ? 'default' : 'destructive'}>
                    {p.status === 'paid' ? 'Payé' : 'En attente'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
