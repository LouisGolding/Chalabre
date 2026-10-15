import { PageTitle } from '@/components/layout/PageTitle'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BudgetBoard } from '@/components/budget/BudgetBoard'

// Onglet "Budget" (voir claude/prompt-onglet-budget.md) -- mise en forme
// posée le 15/10/2026 à la demande de Nicolas, avant la création de la
// table `budget_transactions` (migration écrite mais pas appliquée) et de
// la route d'extraction IA (prompt en cours de calibrage dans la
// conversation, comme pour "Activités"). Réservé aux admins dans son
// intégralité, comme "Activités" -- décision de Nicolas le 15/10/2026
// (question ouverte 6 du prompt) plutôt que la restriction
// Guy/Guillaume/Nicolas envisagée en alternative, à revoir si besoin.
//
// Remplace un embryon abandonné de la toute première ébauche du projet
// (commit 445c291 du 05/04/2026) : jamais relié dans la navigation,
// esthétique différente du reste du site, basé sur une table
// `budget_entries` vide et non référencée ailleurs -- confirmé avec
// Nicolas le 15/10/2026 avant de le remplacer. `tm_payments`/`ts_payments`
// (cotisations/taxes de séjour, déjà utilisées par Suivi paiements/Mes
// paiements/le webhook Stripe) restent une piste fiable à réutiliser plus
// tard pour la partie "entrées" du tableau de bord, sans dépendre de l'IA
// pour cette partie-là.
//
// Pas de requête à `budget_transactions` ici : la table n'existe pas
// encore en base, BudgetBoard reçoit un tableau vide en attendant.
export default async function BudgetPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageTitle>Budget</PageTitle>
      <BudgetBoard initialTransactions={[]} />
    </div>
  )
}
