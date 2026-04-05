import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

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

  const roleColors: Record<string, string> = {
    admin: 'destructive',
    family: 'default',
    friend: 'secondary',
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-stone-800">Administration</h1>

      <Card>
        <CardHeader>
          <CardTitle>Utilisateurs ({profiles?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {profiles?.map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium">{p.first_name} {p.last_name}</p>
                  <p className="text-xs text-stone-400">{p.email} · Inscrit le {formatDate(p.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {p.family_group === 'friend' ? 'Ami' : `Famille ${p.family_group}`}
                  </Badge>
                  <Badge variant={roleColors[p.role] as any}>
                    {p.role}
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
