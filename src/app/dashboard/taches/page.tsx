import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ListChecks } from 'lucide-react'
import { TasksBoard, TaskItem } from '@/components/dashboard/TasksBoard'

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
    completed: boolean
    profiles: { first_name: string; last_name: string } | null
  }

  const items: TaskItem[] = ((tasks ?? []) as TaskRow[]).map((t) => ({
    id: t.id,
    title: t.title,
    category: t.category,
    priority: t.priority,
    period: t.period,
    completed: t.completed,
    authorName: t.profiles ? `${t.profiles.first_name} ${t.profiles.last_name}` : null,
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Tâches</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Entretien et réparations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TasksBoard initialTasks={items} canEdit={profile?.role === 'admin'} />
        </CardContent>
      </Card>
    </div>
  )
}
