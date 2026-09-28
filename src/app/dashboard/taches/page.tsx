import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TasksBoard, TaskItem } from '@/components/dashboard/TasksBoard'

// Onglet renommé "Entretien" le 27/09/2026 à la demande de Nicolas
// (auparavant "Tâches") — route inchangée (/dashboard/taches), voir
// TasksBoard.tsx pour la refonte complète du fonctionnement (catégories,
// urgence, période, récurrence jardin, archives...).
export default async function TachesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, profiles(first_name, last_name)')
    .order('completed', { ascending: true })
    .order('created_at', { ascending: false })

  type TaskRow = {
    id: string
    title: string
    category: TaskItem['category']
    priority: TaskItem['priority']
    period: string | null
    recurrence: TaskItem['recurrence']
    completed: boolean
    completed_at: string | null
    comment: string | null
    profiles: { first_name: string; last_name: string } | null
  }

  const items: TaskItem[] = ((tasks ?? []) as TaskRow[]).map((t) => ({
    id: t.id,
    title: t.title,
    category: t.category,
    priority: t.priority,
    period: t.period,
    recurrence: t.recurrence ?? null,
    completed: t.completed,
    completedAt: t.completed_at ?? null,
    comment: t.comment ?? null,
    authorName: t.profiles ? `${t.profiles.first_name} ${t.profiles.last_name}` : null,
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-normal uppercase tracking-[0.08em] text-foreground mt-6">Entretien</h1>

      <TasksBoard initialTasks={items} canEdit={profile?.role === 'admin'} />
    </div>
  )
}
