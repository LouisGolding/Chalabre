import { PageTitle } from '@/components/layout/PageTitle'
import { getCurrentUserAndProfile } from '@/lib/auth/current-user'
import { redirect } from 'next/navigation'
import { BudgetBoard } from '@/components/budget/BudgetBoard'
import type { BudgetStatement, BudgetStripeTransaction, BudgetTransaction } from '@/types'
import { occupantDisplayName, properCase } from '@/lib/utils'

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
  const { supabase, user, profile } = await getCurrentUserAndProfile()
  if (!user) redirect('/auth/login')

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

  // Transactions Stripe réellement encaissées (cotisations + taxes de
  // séjour, statut "paid") -- widget dépliable visible par admin ET
  // famille (demande de Nicolas, 17/10/2026), donc chargé ici
  // inconditionnellement, contrairement aux relevés déposés plus haut.
  // Pas de typage Supabase généré dans ce projet (voir
  // dashboard/admin/paiements/page.tsx) : types explicites plutôt que
  // `any`.
  type TmPaymentRow = {
    id: string
    amount: number
    month: string
    paid_at: string | null
    profiles: { family_group: string; first_name: string; last_name: string } | null
  }
  type TsPaymentRow = {
    id: string
    amount: number
    paid_at: string | null
    profiles: { first_name: string; last_name: string } | null
    bookings: { house_side: string | null; guest_name: string | null } | null
  }

  const { data: tmPaymentsRaw } = await supabase
    .from('tm_payments')
    .select('id, amount, month, paid_at, profiles(family_group, first_name, last_name)')
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })

  const { data: tsPaymentsRaw } = await supabase
    .from('ts_payments')
    .select('id, amount, paid_at, profiles(first_name, last_name), bookings(house_side, guest_name)')
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })

  const tmPayments = (tmPaymentsRaw ?? []) as unknown as TmPaymentRow[]
  const tsPayments = (tsPaymentsRaw ?? []) as unknown as TsPaymentRow[]

  const stripeTransactions: BudgetStripeTransaction[] = []

  // Cotisation mensuelle -- rattachée au côté de la maison du cotisant.
  for (const p of tmPayments) {
    const account = p.profiles?.family_group
    if (account !== 'lalande' && account !== 'canat') continue
    stripeTransactions.push({
      id: `tm-${p.id}`,
      account,
      kind: 'cotisation',
      label: `Cotisation ${p.month} — ${p.profiles ? properCase(p.profiles.first_name) : ''} ${p.profiles ? properCase(p.profiles.last_name) : ''}`.trim(),
      amount: Number(p.amount),
      paidAt: p.paid_at ?? '',
    })
  }

  // Taxe de séjour -- rattachée au côté de la maison OÙ le séjour a eu
  // lieu (pas forcément celui du payeur), "petite_maison" routée sur
  // Lalande (voir le commentaire sur BudgetStripeTransaction,
  // src/types/index.ts). Un séjour sans `house_side` renseigné (créé
  // avant l'ajout de ce champ) n'est rattaché à aucun des deux comptes.
  for (const p of tsPayments) {
    const side = p.bookings?.house_side
    const account = side === 'petite_maison' ? 'lalande' : side
    if (account !== 'lalande' && account !== 'canat') continue
    stripeTransactions.push({
      id: `ts-${p.id}`,
      account,
      kind: 'taxe_sejour',
      // Nom de l'occupant réel du séjour (ex. "Otto Lalande"), pas
      // forcément celui du compte qui a payé -- voir occupantDisplayName
      // (demandé par Aurélie le 26/10/2026).
      label: `Taxe de séjour — ${occupantDisplayName(p.bookings?.guest_name, p.profiles)}`,
      amount: Number(p.amount),
      paidAt: p.paid_at ?? '',
    })
  }

  stripeTransactions.sort((a, b) => b.paidAt.localeCompare(a.paidAt))

  // Transactions extraites des relevés par l'IA (voir
  // /api/budget/statements/extract) -- lecture admin ET famille. Tant que
  // migration_budget_transactions.sql n'est pas appliquée, `data` reste
  // vide et la page ne plante pas (même principe que budget_statements).
  const { data: transactions } = await supabase
    .from('budget_transactions')
    .select('*')
    .order('transaction_date', { ascending: false })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageTitle>Budget</PageTitle>
      <BudgetBoard
        isAdmin={isAdmin}
        transactions={(transactions ?? []).map((t: BudgetTransaction) => ({ ...t, amount: Number(t.amount) }))}
        statements={statementsWithUrl}
        stripeTransactions={stripeTransactions}
      />
    </div>
  )
}
