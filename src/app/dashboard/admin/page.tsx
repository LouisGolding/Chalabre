import { PageTitle } from '@/components/layout/PageTitle'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MembersTable, MemberRow } from '@/components/admin/MembersTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'

// Libellés de statut pour la colonne "Statut" du tableau "Listes des
// séjours" tout en bas de cette page -- déplacé ici depuis l'onglet
// "Suivi paiements" le 07/10/2026 (voir plus bas), inchangé sinon.
const statusLabel: Record<string, { label: string; color: string }> = {
  paid:    { label: 'Payé',       color: 'bg-green-100 text-green-700' },
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700' },
  overdue: { label: 'Échoué',     color: 'bg-red-100 text-red-700' },
}

// Forme des lignes renvoyees par la requete ts_payments avec ses jointures
// (profiles, bookings) -- pas de typage Supabase genere dans ce projet,
// donc type explicite ici plutot qu'un `any` (demande du projet : eslint
// doit rester propre sur `@typescript-eslint/no-explicit-any`).
type TsPaymentRow = {
  id: string
  user_id: string
  amount: number
  status: string
  paid_at: string | null
  stripe_payment_intent_id: string | null
  profiles: { first_name: string; last_name: string; family_group: string } | null
  bookings: { check_in: string; check_out: string } | null
}

// Onglet "Membres" — réservé aux admins (accès via le bandeau du bas, pas
// le bandeau du haut). Liste tous les comptes créés sur le site, avec un
// bouton pour donner ou retirer l'accès admin à quelqu'un d'autre.
//
// Refonte du 29/09/2026, demandée par Nicolas :
// - Titre remonté au même style que les autres onglets (centré, majuscules,
//   regular, gris foncé — voir la classe reprise de guide/taches/contacts).
// - Trois tableaux distincts, un par catégorie (CANAT / LALANDE / INVITÉS,
//   voir groups plus bas), classés par défaut par ordre alphabétique (Nom).
// - Section "Cotisation mensuelle" retirée (elle vivra ailleurs plus tard).
//   Le composant EditableTmTier n'est donc plus utilisé ici mais n'a pas
//   été supprimé du repo, comme convenu pour CotisationPill précédemment —
//   il reste disponible si cette fonctionnalité revient sous une autre
//   forme.
//
// Fusion du 07/10/2026, demandée par Nicolas :
// - Chacun des 3 tableaux (MembersTable) affiche désormais aussi les
//   totaux de taxe de séjour de l'année en cours par membre (colonnes
//   "Total TS <année>" / "Payé" / "Reste dû") — anciennement le tableau
//   séparé "Soldes par membre" de l'onglet "Suivi paiements", maintenant
//   retiré de cette page-là et fusionné directement dans chaque tableau
//   Membres. Calculé ici à partir de la même requête ts_payments que la
//   liste des séjours ci-dessous (voir tsByUser), filtrée sur l'année en
//   cours via la date de check-in du séjour.
// - Le tableau "Listes des séjours" (déplacé lui aussi depuis "Suivi
//   paiements") est affiché en dernier sur cette page, après les 3
//   tableaux par catégorie.
export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('last_name')

  // Même requête que l'ancienne "Listes des séjours" de l'onglet "Suivi
  // paiements" -- sert à la fois à afficher cette liste en bas de page et
  // à calculer les totaux TS par membre de l'année en cours (tsByUser).
  const { data: tsPaymentsRaw } = await supabase
    .from('ts_payments')
    .select('*, profiles(first_name, last_name, family_group), bookings(check_in, check_out)')
    .order('created_at', { ascending: false })
  const tsPayments = (tsPaymentsRaw ?? []) as unknown as TsPaymentRow[]

  const currentYear = new Date().getFullYear()

  // Totaux TS par membre, année en cours uniquement (année du check-in du
  // séjour, pas de la date de paiement) -- recalculé à chaque chargement
  // de page, jamais stocké (même principe que les tâches récurrentes de
  // l'onglet Entretien, point 18 de points-a-regler-avec-louis.md).
  const tsByUser = new Map<string, { total: number; paid: number }>()
  for (const t of tsPayments) {
    const checkIn = t.bookings?.check_in
    if (!checkIn || new Date(checkIn).getFullYear() !== currentYear) continue
    const agg = tsByUser.get(t.user_id) ?? { total: 0, paid: 0 }
    agg.total += Number(t.amount)
    if (t.status === 'paid') agg.paid += Number(t.amount)
    tsByUser.set(t.user_id, agg)
  }

  const toRows = (familyGroup: 'canat' | 'lalande' | 'friend'): MemberRow[] =>
    (profiles ?? [])
      .filter((p) => p.family_group === familyGroup)
      .map((p) => {
        const ts = tsByUser.get(p.id) ?? { total: 0, paid: 0 }
        return {
          id: p.id,
          firstName: p.first_name,
          lastName: p.last_name,
          email: p.email,
          role: p.role,
          createdAt: p.created_at,
          tsTotalYear: ts.total,
          tsPaidYear: ts.paid,
        }
      })

  const groups: { key: 'canat' | 'lalande' | 'friend'; label: string }[] = [
    { key: 'canat', label: 'Canat' },
    { key: 'lalande', label: 'Lalande' },
    { key: 'friend', label: 'Invités' },
  ]

  return (
    <div className="space-y-8">
      <PageTitle>Membres</PageTitle>

      <div className="space-y-6">
        {groups.map(({ key, label }) => (
          <div key={key} className="space-y-2">
            <h2 className="bg-muted/70 px-3 py-1.5 text-lg md:text-[22px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {label}
            </h2>
            <MembersTable rows={toRows(key)} />
          </div>
        ))}
      </div>

      {/* Listes des séjours -- deplace ici depuis l'onglet "Suivi
          paiements" le 07/10/2026, affiche en dernier sur cette page,
          demande par Nicolas. Contenu et presentation inchanges. */}
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
                {tsPayments.map((p) => (
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
    </div>
  )
}
