import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MembersTable, MemberRow } from '@/components/admin/MembersTable'
import { EditableTmTier } from '@/components/admin/EditableTmTier'
import { formatDate } from '@/lib/utils'

// Onglet "Membres" — réservé aux admins (accès via le bandeau du bas, pas
// le bandeau du haut). Liste tous les comptes créés sur le site, avec leur
// solde de taxe de séjour sur l'année en cours et un bouton pour donner ou
// retirer l'accès admin à quelqu'un d'autre. Colonnes demandées par
// Aurélie le 17/09/2026 : Nom / Prénom / Email / Statut / Solde TS (année
// en cours) / Autorisations / Date de création. La cotisation mensuelle
// (tm_tier), déjà éditable par un admin depuis la précédente version de
// cette page, reste éditable juste en dessous du tableau — désormais en
// deux tableaux séparés (Famille CANAT / Famille LALANDE, demandé par
// Aurélie le 18/09/2026), les comptes "invité" (family_group='friend')
// n'y apparaissent plus.
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

  const today = new Date().toISOString().split('T')[0]
  const currentYear = new Date().getFullYear()

  // Solde TS de l'année en cours : on part des paiements non réglés, dont
  // le séjour (via booking_id) tombe dans l'année en cours.
  const { data: tsPayments } = await supabase
    .from('ts_payments')
    .select('user_id, amount, status, bookings(check_in)')
    .neq('status', 'paid')

  const tsDueByUser = new Map<string, number>()
  for (const p of tsPayments ?? []) {
    const checkIn = (p as { bookings?: { check_in?: string } | null }).bookings?.check_in
    if (!checkIn) continue
    if (new Date(checkIn).getFullYear() !== currentYear) continue
    tsDueByUser.set(p.user_id, (tsDueByUser.get(p.user_id) ?? 0) + Number(p.amount))
  }

  // Prochain séjour de chacun (pour le tri "date de séjour").
  const { data: upcomingBookings } = await supabase
    .from('bookings')
    .select('user_id, check_in')
    .gte('check_in', today)
    .order('check_in', { ascending: true })

  const nextStayByUser = new Map<string, string>()
  for (const b of upcomingBookings ?? []) {
    if (!nextStayByUser.has(b.user_id)) nextStayByUser.set(b.user_id, b.check_in)
  }

  const rows: MemberRow[] = (profiles ?? []).map((p) => ({
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    email: p.email,
    familyGroup: p.family_group,
    role: p.role,
    tsDueThisYear: tsDueByUser.get(p.id) ?? 0,
    nextStay: nextStayByUser.get(p.id) ?? null,
    createdAt: p.created_at,
  }))

  return (
    <div className="space-y-8">
      <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Membres</h1>

      <MembersTable rows={rows} />

      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-foreground">Cotisation mensuelle</h2>
        {(
          [
            { key: 'canat', label: 'Famille CANAT' },
            { key: 'lalande', label: 'Famille LALANDE' },
          ] as const
        ).map(({ key, label }) => {
          const members = (profiles ?? []).filter((p) => p.family_group === key)
          return (
            <div key={key} className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
              <div className="space-y-2">
                {members.length > 0 ? (
                  members.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0">
                      <div>
                        <p className="font-medium text-foreground">{p.first_name} {p.last_name}</p>
                        <p className="text-xs text-muted-foreground">Inscrit le {formatDate(p.created_at)}</p>
                      </div>
                      <EditableTmTier profileId={p.id} initialAmount={p.tm_tier} />
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun membre pour l&apos;instant.</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
