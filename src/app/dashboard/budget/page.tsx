import { PageTitle } from '@/components/layout/PageTitle'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BudgetBoard } from '@/components/budget/BudgetBoard'
import type { BudgetStatement } from '@/types'

// Onglet "Budget" (voir claude/prompt-onglet-budget.md) -- mise en forme
// posée le 15/10/2026 à la demande de Nicolas, avant la création de la
// table `budget_transactions` (migration à écrire séparément, questions
// ouvertes du prompt encore en cours) et de la route d'extraction IA
// (prompt en cours de calibrage dans la conversation, comme pour
// Activités).
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
// Mise à jour du 16/10/2026 (Nicolas) : l'onglet n'est plus accessible que
// depuis la grille des onglets (TileNav), plus depuis le bandeau du bas
// (BottomNav) -- et les relevés déposés (budget_statements, voir
// migration_budget_statements.sql, PAS encore appliquée) sont listés ici
// avec une URL signée, même principe que "Documents" : le bucket Storage
// est privé, la lecture passe par des URLs signées générées côté serveur,
// jamais une URL publique.
//
// Mise à jour du 17/10/2026 (Nicolas) : l'onglet n'est plus réservé aux
// admins dans sa totalité (c'était le cas depuis le 15/10/2026, question
// ouverte 6 du prompt) -- seul le widget "Déposer le relevé bancaire" (et
// la liste des relevés déjà déposés, qui va avec) reste réservé aux
// admins, voir BudgetBoard.tsx ; le reste du tableau de bord (sélecteur
// de compte, cartes de synthèse, transactions, bilan annuel) est
// désormais visible par les admins ET la famille. Cohérent avec la RLS
// de budget_statements (migration_budget_statements.sql, PAS encore
// appliquée), qui reste elle admin-only en lecture/écriture : on évite
// donc ici d'interroger budget_statements pour un compte "family", qui
// n'y aurait de toute façon pas accès.
export default async function BudgetPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  // "friend" reste exclu (comme Réalisations/Entretien, voir TileNav.tsx) ;
  // admin et family accèdent désormais tous les deux à la page.
  if (profile?.role !== 'admin' && profile?.role !== 'family') redirect('/dashboard')
  const isAdmin = profile?.role === 'admin'

  // Les relevés déposés (et leurs URLs signées) ne servent qu'au widget
  // admin-only de BudgetBoard.tsx -- inutile de les charger pour un
  // compte "family", qui ne les verra pas de toute façon (et que la RLS
  // de budget_statements bloquerait en lecture).
  let statementsWithUrl: (BudgetStatement & { downloadUrl: string | null })[] = []
  if (isAdmin) {
    // `budget_statements` n'existe pas encore en base tant que la
    // migration n'est pas appliquée par Louis -- `data` reste alors
    // simplement vide (pattern déjà suivi ailleurs sur le site, voir
    // documents/page.tsx), la page ne plante pas pour autant.
    const { data: statements } = await supabase
      .from('budget_statements')
      .select('*')
      .order('created_at', { ascending: false })

    const paths = (statements ?? []).map((s) => s.storage_path)
    const signedByPath = new Map<string, string>()
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage.from('budget-statements').createSignedUrls(paths, 60 * 60)
      for (const entry of signed ?? []) {
        if (entry.path && entry.signedUrl) signedByPath.set(entry.path, entry.signedUrl)
      }
    }
    statementsWithUrl = (statements ?? []).map((s: BudgetStatement) => ({
      ...s,
      downloadUrl: signedByPath.get(s.storage_path) ?? null,
    }))
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageTitle>Budget</PageTitle>
      <BudgetBoard isAdmin={isAdmin} initialTransactions={[]} initialStatements={statementsWithUrl} />
    </div>
  )
}
