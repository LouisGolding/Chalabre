import { PageTitle } from '@/components/layout/PageTitle'
import { getCurrentUserAndProfile } from '@/lib/auth/current-user'
import { redirect } from 'next/navigation'
import { TasksBoard, TaskItem } from '@/components/dashboard/TasksBoard'
import { TaskContactTag, TaskNote } from '@/types'

// Onglet renommé "Entretien" le 27/09/2026 à la demande de Nicolas
// (auparavant "Tâches") — route inchangée (/dashboard/taches), voir
// TasksBoard.tsx pour la refonte complète du fonctionnement (catégories,
// urgence, période, récurrence jardin, archives...).
export default async function TachesPage() {
  const { supabase, user, profile } = await getCurrentUserAndProfile()
  if (!user) redirect('/auth/login')
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
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select(
      '*, profiles(first_name, last_name), task_notes(id, text, rdv_date, created_at, user_id, profile:profiles(first_name, last_name)), task_contacts(contact_id, contacts(id, name, role))'
    )
    .order('completed', { ascending: true })
    .order('created_at', { ascending: false })

  // Tant que migration_task_notes_contacts.sql n'est pas appliquée, les
  // tables task_notes/task_contacts n'existent pas et l'embed ci-dessus
  // échoue entièrement (PostgREST ne trouve pas la relation) -- sans ce
  // filet, `tasks` serait `null` et la page afficherait "aucune tâche" alors
  // que les tâches existent toujours bel et bien en base. Repli automatique
  // sur une requête sans ces deux tables, le temps que Louis applique la
  // migration.
  let taskRows = (tasks ?? []) as unknown as RawTaskRow[]
  if (tasksError) {
    const { data: fallbackTasks } = await supabase
      .from('tasks')
      .select('*, profiles(first_name, last_name)')
      .order('completed', { ascending: true })
      .order('created_at', { ascending: false })
    taskRows = ((fallbackTasks ?? []) as unknown as Omit<RawTaskRow, 'task_notes' | 'task_contacts'>[]).map(
      (t) => ({ ...t, task_notes: null, task_contacts: null })
    )
  }

  type RawTaskRow = {
    id: string
    title: string
    category: TaskItem['category']
    priority: TaskItem['priority']
    period: string | null
    recurrence: TaskItem['recurrence']
    completed: boolean
    completed_at: string | null
    // Auteur de la tache (deja selectionne via `*`) -- ajoute le
    // 25/10/2026 pour permettre a chacun d'editer/corriger la ligne
    // qu'il a rentree (demande d'Aurelie) : voir TasksBoard.tsx et
    // migration_tasks_family_access.sql.
    created_by: string | null
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

  const items: TaskItem[] = taskRows.map((t) => {
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
      createdBy: t.created_by,
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
      {/* `canEdit` ci-dessus garde son sens d'origine ("réservé aux
          admins") -- utilisé dans TasksBoard pour la suppression et pour
          autoriser un admin à corriger N'IMPORTE QUELLE ligne. Depuis le
          25/10/2026, l'ajout et la coche sont ouverts à la famille sans
          condition (la page elle-même redirige déjà les comptes "friend"
          plus haut), et chacun peut éditer les lignes qu'il a créées
          lui-même via `createdBy` (voir TaskItem/TasksBoard.tsx). */}
    </div>
  )
}
