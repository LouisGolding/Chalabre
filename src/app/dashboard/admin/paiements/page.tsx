import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const statusLabel: Record<string, { label: string; color: string }> = {
  paid:    { label: 'Payé',       color: 'bg-green-100 text-green-700' },
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700' },
  overdue: { label: 'Échoué',     color: 'bg-red-100 text-red-700' },
}

export default async function AdminPaiementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  // Tous les paiements TS
  const { data: tsPayments } = await supabase
    .from('ts_payments')
    .select('*, profiles(first_name, last_name, family_group), bookings(check_in, check_out)')
    .order('created_at', { ascending: false })

  // Tous les paiements TM
  const { data: tmPayments } = await supabase
    .from('tm_payments')
    .select('*, profiles(first_name, last_name, family_group)')
    .order('month', { ascending: false })

  // Soldes par utilisateur
  const { data: balances } = await supabase
    .from('user_balances')
    .select('*')
    .order('ts_pending', { ascending: false })

  // Audit log
  const { data: events } = await supabase
    .from('payment_events')
    .select('*')
    .order('processed_at', { ascending: false })
    .limit(50)

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
      <h1 className="text-2xl md:text-3xl font-normal uppercase tracking-[0.08em] text-foreground text-center md:text-left">Suivi des paiements</h1>

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
          <CardContent><div className="text-2xl font-bold text-stone-700">{events?.filter(e => e.status === 'success').length ?? 0}</div></CardContent>
        </Card>
      </div>

      {/* Soldes par utilisateur -- demande par Nicolas le 05/10/2026 :
          titre traite comme les widgets du Guide de la maison ; colonnes
          "Famille" renommee "Statut" (meme donnee affichee, b.family_group,
          seul le libelle change), "TS dû" renommee "TS totales dues",
          "Total payé" (ex. TS+TM) renommee "TS totales payées" et
          recalculee en TS seul (b.ts_paid_total, le TM n'est plus suivi
          sur cette page, voir plus bas) ; nouvelle colonne "Reste à
          payer" = TS totales dues - TS totales payées ; colonnes "TM dû"
          et "Total dû" (qui melangeaient TS et TM) retirees. */}
      <Card>
        <CardHeader><CardTitle className="text-sm md:text-base uppercase tracking-wide">Soldes par membre</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-stone-400 text-left">
                  <th className="pb-2 font-medium">Membre</th>
                  <th className="pb-2 font-medium">Statut</th>
                  <th className="pb-2 font-medium text-right">TS totales dues</th>
                  <th className="pb-2 font-medium text-right">TS totales payées</th>
                  <th className="pb-2 font-medium text-right">Reste à payer</th>
                </tr>
              </thead>
              <tbody>
                {balances?.map((b: any) => {
                  const remaining = b.ts_pending - b.ts_paid_total
                  return (
                    <tr key={b.user_id} className="border-b last:border-0 hover:bg-stone-50">
                      <td className="py-2 font-medium">{b.user_name}</td>
                      <td className="py-2 capitalize text-stone-400">{b.family_group}</td>
                      <td className={`py-2 text-right ${b.ts_pending > 0 ? 'text-red-600' : 'text-stone-400'}`}>
                        {formatCurrency(b.ts_pending)}
                      </td>
                      <td className="py-2 text-right text-green-600">
                        {formatCurrency(b.ts_paid_total)}
                      </td>
                      <td className={`py-2 text-right font-semibold ${remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(remaining)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* TS détail -- titre renomme "Listes des sejours" (ex. "Taxes de
          sejour (TS)") et traite comme les widgets du Guide de la maison,
          demande par Nicolas le 05/10/2026. */}
      <Card>
        <CardHeader><CardTitle className="text-sm md:text-base uppercase tracking-wide">Listes des séjours</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-stone-400 text-left">
                  <th className="pb-2 font-medium">Membre</th>
                  <th className="pb-2 font-medium">Séjour</th>
                  <th className="pb-2 font-medium text-right">Montant</th>
                  <th className="pb-2 font-medium">Statut</th>
                  <th className="pb-2 font-medium">Payé le</th>
                  <th className="pb-2 font-medium text-xs text-stone-300">Stripe ID</th>
                </tr>
              </thead>
              <tbody>
                {tsPayments?.map((p: any) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-stone-50">
                    <td className="py-2 font-medium">{p.profiles?.first_name} {p.profiles?.last_name}</td>
                    <td className="py-2 text-stone-500 text-xs">
                      {p.bookings?.check_in ? `${formatDate(p.bookings.check_in)} → ${formatDate(p.bookings.check_out)}` : '—'}
                    </td>
                    <td className="py-2 text-right font-semibold">{formatCurrency(p.amount)}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusLabel[p.status]?.color}`}>
                        {statusLabel[p.status]?.label}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-stone-400">{p.paid_at ? formatDate(p.paid_at) : '—'}</td>
                    <td className="py-2 text-xs text-stone-300 font-mono truncate max-w-[120px]">
                      {p.stripe_payment_intent_id ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Audit log */}
      {events && events.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Journal des événements Stripe</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {events.map((e: any) => (
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
