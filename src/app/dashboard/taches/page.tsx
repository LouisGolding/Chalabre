import { PageTitle } from '@/components/layout/PageTitle'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TasksBoard, TaskItem } from '@/components/dashboard/TasksBoard'
import { TaskContactTag, TaskNote } from '@/types'

// Onglet renommé "Entretien" le 27/09/2026 à la demande de Nicolas
// (auparavant "Tâches") — route inchangée (/dashboard/taches), voir
// TasksBoard.tsx pour la refonte complète du fonctionnement (catégories,
// urgence, période, récurrence jardin, archives...).
export default async function TachesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  // "friend" exclu, comme Réalisations/Budget (voir TileNav.tsx,
  // hiddenForFriend) -- manquait ici jusqu'au 18/10/2026 (audit
  // pré-lancement, point signalé à Nicolas) : la tuile était bien
  // masquée pour un compte "ami", mais rien n'empêchait d'accéder à
  // /dashboard/taches directement par son URL.
  if (profile?.role !== 'admin' && profile?.role !== 'family') redirect('/dashboard')

  // Suivi (task_notes) et Contact (task_contacts) : nouvelles tables du
  // 19/10/2026, demandées par Aurélie -- voir
  // migration_task_notes_contacts.sql (pas encore appliquée) et
  // TasksBoard.tsx. Remplacent l'ancien champ unique `tasks.comment`
  // (colonne gardée en base, juste plus lue ici).
  const { data: tasks } = await supabase
    .from('tasks')
    .select(
      '*, profiles(first_name, last_name), task_notes(id, text, rdv_date, created_at, user_id, profile:profiles(first_name, last_name)), task_contacts(contact_id, contacts(id, name, role))'
    )
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
    profiles: { first_name: string; last_name: string } | null
    task_notes:
      | {
          id: string
          text: string
          rdv_date: string | null
          created_at: string
          user_id: string
          profile: { first_name: string; last_name: string } | null
        }[]
      | null
    task_contacts: { contact_id: string; contacts: { id: string; name: string; role: string } | null }[] | null
  }

  const items: TaskItem[] = ((tasks ?? []) as TaskRow[]).map((t) => {
    const notes: TaskNote[] = (t.task_notes ?? [])
      .map((n) => ({
        id: n.id,
        task_id: t.id,
        user_id: n.user_id,
        text: n.text,
        rdv_date: n.rdv_date,
        created_at: n.created_at,
        profile: n.profile
          ? { first_name: n.profile.first_name, last_name: n.profile.last_name }
          : undefined,
      }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))

    const contacts: TaskContactTag[] = (t.task_contacts ?? [])
      .filter((tc) => tc.contacts)
      .map((tc) => ({ contact_id: tc.contact_id, name: tc.contacts!.name, role: tc.contacts!.role }))

    return {
      id: t.id,
      title: t.title,
      category: t.category,
      priority: t.priority,
      period: t.period,
      recurrence: t.recurrence ?? null,
      completed: t.completed,
      completedAt: t.completed_at ?? null,
      authorName: t.profiles ? `${t.profiles.first_name} ${t.profiles.last_name}` : null,
      notes,
      contacts,
    }
  })

  // Contacts de la catégorie "Services" (plombier, électricien,
  // jardinier...) proposés dans le sélecteur de la pastille "Contact" --
  // voir src/lib/contact-categories.ts.
  const { data: serviceContactRows } = await supabase
    .from('contacts')
    .select('id, name, role')
    .eq('category', 'services')
    .order('role', { ascending: true })
    .order('name', { ascending: true })
  const serviceContacts = serviceContactRows ?? []

  return (
    <div className="space-y-6">
      <PageTitle>Entretien</PageTitle>

      <TasksBoard
        initialTasks={items}
        canEdit={profile?.role === 'admin'}
        servicesContacts={serviceContacts}
        currentUserId={user.id}
      />
    </div>
  )
}
