import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MembersTable, MemberRow } from '@/components/admin/MembersTable'

// Onglet "Membres" — réservé aux admins (accès via le bandeau du bas, pas
// le bandeau du haut). Liste tous les comptes créés sur le site, avec un
// bouton pour donner ou retirer l'accès admin à quelqu'un d'autre.
//
// Refonte du 29/09/2026, demandée par Nicolas :
// - Titre remonté au même style que les autres onglets (centré, majuscules,
//   regular, gris foncé — voir la classe reprise de guide/taches/contacts).
// - Trois tableaux distincts, un par catégorie (CANAT / LALANDE / INVITÉS),
//   classés par défaut par ordre alphabétique (Nom) — la colonne "Statut"
//   devient donc inutile (chaque tableau porte déjà sa catégorie) et a été
//   retirée de MembersTable.
// - Colonne "Solde TS (année en cours)" retirée : elle réapparaîtra plus
//   tard dans l'onglet "Suivi paiements", donc les requêtes ts_payments /
//   upcomingBookings et les maps tsDueByUser / nextStayByUser qui ne
//   servaient qu'à ça ont été supprimées.
// - Section "Cotisation mensuelle" retirée (elle vivra ailleurs plus tard).
//   Le composant EditableTmTier n'est donc plus utilisé ici mais n'a pas
//   été supprimé du repo, comme convenu pour CotisationPill précédemment —
//   il reste disponible si cette fonctionnalité revient sous une autre
//   forme.
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

  const toRows = (familyGroup: 'canat' | 'lalande' | 'friend'): MemberRow[] =>
    (profiles ?? [])
      .filter((p) => p.family_group === familyGroup)
      .map((p) => ({
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        email: p.email,
        role: p.role,
        createdAt: p.created_at,
      }))

  const groups: { key: 'canat' | 'lalande' | 'friend'; label: string }[] = [
    { key: 'canat', label: 'Canat' },
    { key: 'lalande', label: 'Lalande' },
    { key: 'friend', label: 'Invités' },
  ]

  return (
    <div className="space-y-8">
      <h1 className="text-2xl md:text-3xl font-normal uppercase tracking-[0.08em] text-foreground mt-4 text-center md:text-left">
        Membres
      </h1>

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
    </div>
  )
}
