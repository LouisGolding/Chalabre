'use client'

import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronDown, MessageCircle, Phone, Trash2, X } from 'lucide-react'
import { actionPillClass, cn, viewTogglePillClass } from '@/lib/utils'
import { MONTH_OPTIONS, SEASON_OPTIONS, PERIOD_LABELS, TaskPeriod, isPeriodCurrent } from '@/lib/task-periods'
import { TaskContactTag, TaskNote } from '@/types'

// Refonte complète du 27/09/2026, demandée par Nicolas (l'onglet devient
// "Entretien" — voir taches/page.tsx). Résumé des règles, pour ne pas les
// reperdre :
// - Catégories : Réparation / Plomberie / Électricité / Jardin /
//   Manutention / Autres ("entretien" gardé en base pour les anciennes
//   lignes, plus proposé à la création — voir CATEGORY_LABEL).
// - Urgence : les 3 choix existants (inchangé).
// - Période : mois ou saison (inchangé, juste renommée "Période").
// - Récurrence : uniquement pour la catégorie "Jardin" — 1 fois / chaque
//   mois / chaque année.
// - Une fois ajoutée, une tâche apparaît dans "À faire ce mois-ci" ou
//   "À faire" (selon sa période), sauf le jardin qui a sa propre liste
//   ("Jardin", toutes ses tâches, actives ou récemment cochées).
// - Tâches non-jardin (donc sans récurrence) cochées : au bout de 30
//   jours, passent dans "Archives" (repliée par défaut, cliquable).
// - Tâches jardin cochées : jamais archivées ; disparaissent au bout de
//   15 jours, puis réapparaissent (redeviennent actives) au rythme de
//   leur récurrence — sauf "1 fois", qui ne réapparaît pas. Ce
//   "réveil" est recalculé au chargement de la page (useEffect
//   ci-dessous) : pas de tâche planifiée côté serveur pour l'instant,
//   donc une tâche jardin ne réapparaît vraiment que quand quelqu'un
//   rouvre cette page après l'échéance — suffisant pour l'usage prévu.
// - Tri au choix, par urgence ou par catégorie, appliqué aux 4 listes.
//
// Refonte du 19/10/2026 (demandée par Aurélie, maquette Artifact
// "Entretien — Suivi & Contact") -- remplace l'ancien commentaire
// unique proposé à la coche :
// - "Suivi" : plusieurs notes datées par tâche (table `task_notes`),
//   ajoutables à tout moment (pas seulement en cochant la tâche).
//   Chaque note peut porter une date de RDV facultative -- dès qu'elle
//   est à moins de 30 jours, le RDV apparaît sur la page d'accueil
//   (voir dashboard/page.tsx, widget "RDV à venir"). Append-only, comme
//   les commentaires de Réalisations : pas de modification, suppression
//   par l'auteur ou un admin.
// - "Contact" : un ou plusieurs contacts de la catégorie "Services"
//   (Contacts) associables à la tâche (table `task_contacts`).
// - Les deux sont ouverts à l'admin ET à la famille (indépendant de
//   `canEdit`, réservé lui à l'ajout/suppression de tâche).
//
// Complement du 04/10/2026 (demande par Nicolas) :
// - Pastilles de categorie/urgence/periode/recurrence (formulaire
//   d'ajout) et pastilles de tri : meme traitement exact que le
//   selecteur de vue du Planning (voir viewTogglePillClass, utils.ts) --
//   la periode n'est plus un <select> mais des pastilles, au meme titre
//   que les autres.
// - Plus de mention "Trier par" : juste les 2 pastilles Urgence/
//   Categorie, alignees a droite sur la ligne de titre de chacune des
//   listes "A faire ce mois-ci", "A faire" et "Jardin"/"Periodique" (pas
//   sur Archives).
// - "A faire ce mois-ci" et "A faire" vivent desormais dans leur propre
//   widget ("Taches", nom provisoire choisi faute de consigne precise de
//   Nicolas sur ce point -- a confirmer), affiche avant "Entretien et
//   reparations" (qui garde le formulaire d'ajout, "Jardin" -- rebaptise
//   "Periodique" uniquement dans le libelle affiche, pas en base -- et
//   Archives).
// - Sous-libelles de chaque ligne de tache (categorie, periode, urgence)
//   desormais en majuscules, meme espacement (tracking-wide) que le
//   titre "Entretien et reparations".
// - Le titre d'une tache n'est plus tronque : il passe a la ligne quand
//   il est trop long, le reste de la ligne est inchange.

type Category = 'entretien' | 'reparation' | 'plomberie' | 'electricite' | 'jardin' | 'manutention' | 'autre'
type Priority = 'low' | 'medium' | 'high'
type Recurrence = 'once' | 'monthly' | 'yearly'
type SortMode = 'urgence' | 'categorie'

export interface TaskItem {
  id: string
  title: string
  category: Category
  priority: Priority
  period: string | null
  recurrence: Recurrence | null
  completed: boolean
  completedAt: string | null
  authorName: string | null
  // Suivi & Contact (19/10/2026, demandé par Aurélie) -- remplacent
  // l'ancien champ unique `comment` : plusieurs notes datées (chacune
  // pouvant porter une date de RDV), et plusieurs contacts associés
  // (Services) -- voir migration_task_notes_contacts.sql.
  notes: TaskNote[]
  contacts: TaskContactTag[]
}

// Un contact de la catégorie "Services" (Contacts), proposé dans le
// sélecteur de la pastille "Contact" -- juste ce qu'il faut pour
// l'afficher et l'associer.
export interface ServiceContact {
  id: string
  name: string
  role: string
}

// Ordre demandé par Nicolas pour la pastille catégorie et pour le tri
// "par catégorie". "entretien" (ancienne valeur, plus proposée à la
// création) est ajoutée à la fin pour que d'éventuelles vieilles lignes
// se trient quand même sans planter.
const SELECTABLE_CATEGORIES: Category[] = ['reparation', 'plomberie', 'electricite', 'jardin', 'manutention', 'autre']
const CATEGORY_ORDER: Category[] = [...SELECTABLE_CATEGORIES, 'entretien']

const CATEGORY_LABEL: Record<Category, string> = {
  reparation: 'Réparation',
  plomberie: 'Plomberie',
  electricite: 'Électricité',
  jardin: 'Jardin',
  manutention: 'Manutention',
  autre: 'Autres',
  entretien: 'Entretien',
}

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

// Plus de fond/encadre sur la pastille d'urgence -- demande par Nicolas
// le 05/10/2026 : seule la typo reste coloree (rouge/jaune/vert), comme
// les autres libelles de la ligne (categorie, periode).
const PRIORITY_STYLE: Record<Priority, string> = {
  low: 'text-green-600',
  medium: 'text-amber-600',
  high: 'text-red-600',
}

const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Faible',
  medium: 'Moyenne',
  high: 'Urgente',
}

const RECURRENCE_LABEL: Record<Recurrence, string> = {
  once: '1 fois',
  monthly: 'Chaque mois',
  yearly: 'Chaque année',
}

const DAY_MS = 1000 * 60 * 60 * 24

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  return (Date.now() - new Date(iso).getTime()) / DAY_MS
}

function nextDueTime(completedAt: string, recurrence: Recurrence): number {
  const d = new Date(completedAt)
  if (recurrence === 'monthly') d.setMonth(d.getMonth() + 1)
  else if (recurrence === 'yearly') d.setFullYear(d.getFullYear() + 1)
  return d.getTime()
}

function sortTasks(list: TaskItem[], mode: SortMode): TaskItem[] {
  const copy = [...list]
  if (mode === 'urgence') {
    copy.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
  } else {
    copy.sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
  }
  return copy
}

interface TasksBoardProps {
  initialTasks: TaskItem[]
  // Réservé aux admins côté base (policy "tasks_admin") pour ajouter ou
  // supprimer une tâche ; tout le monde peut voir la liste et cocher (le
  // "cocher" n'a jamais été réservé aux admins côté API, voir route.ts).
  canEdit: boolean
  // Contacts de la catégorie "Services" (Contacts), proposés dans le
  // sélecteur de la pastille "Contact" -- voir taches/page.tsx.
  servicesContacts: ServiceContact[]
  // Sert à savoir si on peut supprimer SA PROPRE note de suivi (en plus
  // d'un admin, qui peut toujours tout supprimer via `canEdit`).
  currentUserId: string
}

export function TasksBoard({ initialTasks, canEdit, servicesContacts, currentUserId }: TasksBoardProps) {
  const [tasks, setTasks] = useState(initialTasks)
  // Widget "déroulant" (demandé par Nicolas le 27/09/2026) : replié par
  // défaut, un clic sur le titre du widget révèle le formulaire d'ajout.
  // Les listes elles-mêmes restent toujours visibles, indépendamment de
  // cet état.
  const [formOpen, setFormOpen] = useState(false)
  const [archivesOpen, setArchivesOpen] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('urgence')

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<Category>('reparation')
  const [priority, setPriority] = useState<Priority>('medium')
  const [period, setPeriod] = useState<TaskPeriod | ''>('')
  const [recurrence, setRecurrence] = useState<Recurrence>('once')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Suivi & Contact (19/10/2026, demandé par Aurélie) : état d'affichage
  // (panneau "Suivi" déplié ou non, sélecteur "Contact" ouvert ou non) et
  // brouillons (texte / date de RDV en cours de saisie), par tâche. Plus
  // lié à la coche -- une note peut s'ajouter à tout moment, pas
  // seulement en cochant la tâche (contrairement à l'ancien champ
  // `comment` unique qu'ils remplacent).
  const [suiviOpen, setSuiviOpen] = useState<Record<string, boolean>>({})
  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null)
  const [draftText, setDraftText] = useState<Record<string, string>>({})
  const [draftDate, setDraftDate] = useState<Record<string, string>>({})

  // "Réveil" des tâches jardin récurrentes dont l'échéance est passée :
  // repassées à "non cochée" au chargement de la page (voir le grand
  // commentaire en tête de fichier — pas de tâche planifiée côté serveur
  // pour l'instant). Ne s'exécute qu'une fois au montage.
  useEffect(() => {
    const due = tasks.filter(
      (t) =>
        t.category === 'jardin' &&
        t.completed &&
        t.recurrence &&
        t.recurrence !== 'once' &&
        t.completedAt &&
        Date.now() >= nextDueTime(t.completedAt, t.recurrence)
    )
    if (due.length === 0) return
    setTasks((prev) =>
      prev.map((t) => (due.some((d) => d.id === t.id) ? { ...t, completed: false, completedAt: null } : t))
    )
    due.forEach((t) => {
      fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id, completed: false }),
      }).catch(() => {})
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = async (task: TaskItem) => {
    const nextCompleted = !task.completed
    const nextCompletedAt = nextCompleted ? new Date().toISOString() : null
    const previous = task
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed: nextCompleted, completedAt: nextCompletedAt } : t))
    )
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, completed: nextCompleted }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, completed: previous.completed, completedAt: previous.completedAt } : t))
      )
      setError('Impossible de mettre à jour cette tâche.')
    }
  }

  // --- Suivi : plusieurs notes datées par tâche, chacune pouvant porter
  //     une date de RDV facultative (voir migration_task_notes_contacts.sql
  //     et dashboard/page.tsx pour le widget d'accueil "RDV à venir"). ---
  const toggleSuivi = (taskId: string) =>
    setSuiviOpen((prev) => ({ ...prev, [taskId]: !prev[taskId] }))

  const addNote = async (taskId: string) => {
    const text = (draftText[taskId] ?? '').trim()
    if (!text) return
    const rdv = draftDate[taskId] || null
    try {
      const res = await fetch('/api/tasks/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, text, rdv_date: rdv }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      const n = data.note
      const note: TaskNote = {
        id: n.id,
        task_id: n.task_id,
        user_id: n.user_id,
        text: n.text,
        rdv_date: n.rdv_date,
        created_at: n.created_at,
        profile: n.profile ? { first_name: n.profile.first_name, last_name: n.profile.last_name } : undefined,
      }
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, notes: [...t.notes, note] } : t)))
      setDraftText((prev) => ({ ...prev, [taskId]: '' }))
      setDraftDate((prev) => ({ ...prev, [taskId]: '' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’ajout de la note')
    }
  }

  const deleteNote = async (taskId: string, noteId: string) => {
    const previous = tasks
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, notes: t.notes.filter((n) => n.id !== noteId) } : t))
    )
    try {
      const res = await fetch(`/api/tasks/notes?id=${noteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setTasks(previous)
      setError('Impossible de supprimer cette note.')
    }
  }

  // --- Contact : plusieurs artisans (catégorie "Services" de Contacts)
  //     associables à une même tâche (confirmé par Aurélie le
  //     19/10/2026). ---
  const attachContact = async (taskId: string, contact: ServiceContact) => {
    setPickerOpenFor(null)
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, contacts: [...t.contacts, { contact_id: contact.id, name: contact.name, role: contact.role }] }
          : t
      )
    )
    try {
      const res = await fetch('/api/tasks/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, contact_id: contact.id }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, contacts: t.contacts.filter((c) => c.contact_id !== contact.id) } : t
        )
      )
      setError('Impossible d’associer ce contact.')
    }
  }

  const detachContact = async (taskId: string, contactId: string) => {
    const previous = tasks
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, contacts: t.contacts.filter((c) => c.contact_id !== contactId) } : t))
    )
    try {
      const res = await fetch(`/api/tasks/contacts?task_id=${taskId}&contact_id=${contactId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setTasks(previous)
      setError('Impossible de retirer ce contact.')
    }
  }

  const addTask = async () => {
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          category,
          priority,
          period: period || null,
          recurrence: category === 'jardin' ? recurrence : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      const t = data.task
      setTasks((prev) => [
        {
          id: t.id,
          title: t.title,
          category: t.category,
          priority: t.priority,
          period: t.period,
          recurrence: t.recurrence ?? null,
          completed: t.completed,
          completedAt: t.completed_at ?? null,
          authorName: null,
          notes: [],
          contacts: [],
        },
        ...prev,
      ])
      setTitle('')
      setPriority('medium')
      setCategory('reparation')
      setPeriod('')
      setRecurrence('once')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’ajout')
    } finally {
      setSaving(false)
    }
  }

  const deleteTask = async (id: string) => {
    const previous = tasks
    setTasks((prev) => prev.filter((t) => t.id !== id))
    try {
      const res = await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setTasks(previous)
      setError('Impossible de supprimer cette tâche.')
    }
  }

  // --- Répartition dans les 4 listes (voir le grand commentaire en tête
  //     de fichier pour la logique complète) ---
  const jardinVisible = tasks.filter((t) => {
    if (t.category !== 'jardin') return false
    if (!t.completed) return true
    const d = daysSince(t.completedAt)
    return d === null || d < 15
  })

  const nonJardin = tasks.filter((t) => t.category !== 'jardin')

  const archived = nonJardin.filter((t) => {
    if (!t.completed) return false
    const d = daysSince(t.completedAt)
    return d !== null && d >= 30
  })
  const archivedIds = new Set(archived.map((t) => t.id))
  const nonJardinVisible = nonJardin.filter((t) => !archivedIds.has(t.id))

  const thisMonth = sortTasks(nonJardinVisible.filter((t) => isPeriodCurrent(t.period)), sortMode)
  const general = sortTasks(nonJardinVisible.filter((t) => !isPeriodCurrent(t.period)), sortMode)
  const jardin = sortTasks(jardinVisible, sortMode)
  const archives = sortTasks(archived, sortMode)

  return (
    <div className="space-y-6">
      {/* Ordre des 2 widgets et position de "Periodique" inverses le
          05/10/2026 a la demande de Nicolas : "Entretien et reparations"
          passe en premier (etait en second depuis la refonte du
          04/10/2026, voir plus bas), et la liste "Periodique" (ex.
          "Jardin") quitte ce widget pour rejoindre "Taches", tout en bas
          (apres "A faire"). */}
      {/* Card alignee sur le gabarit "replie" des widgets du Guide de la
          maison (GuideCard.tsx : Card py-0, entete h-10, contenu masque
          plutot que simplement rempli quand replie) -- demande par
          Nicolas le 05/10/2026 : meme hauteur a l'etat replie que
          "Avant votre arrivee"/"Maison encore occupee"/etc. Avant ce
          changement, Archives restait visible meme replie (CardContent
          toujours rendu) : c'est desormais tout le contenu qui
          apparait/disparait ensemble avec formOpen, comme sur un
          GuideCard. */}
      <Card className="py-0">
        <CardHeader>
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            aria-expanded={formOpen}
            className="flex h-10 w-full items-center justify-between gap-2 text-left hover:opacity-80"
          >
            <CardTitle className="text-sm md:text-base uppercase tracking-wide">Entretien et réparations</CardTitle>
            <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', formOpen && 'rotate-180')} />
          </button>
        </CardHeader>
        {formOpen && (
          <CardContent className="space-y-5 pb-[10px]">
            {/* Plus de ligne grise ici -- demande par Nicolas le
                05/10/2026 : retiree du bas du widget. */}
            {canEdit && (
              <div className="space-y-3">
                {/* Encadre traite exactement comme le champ "Titre" de
                    "Partager ce qui a ete fait" (RealisationsBoard.tsx) --
                    demande par Nicolas le 05/10/2026 : remplace le
                    composant <Input> (shadcn, rounded-md par defaut) par
                    le meme <input> natif + classes que ce champ. */}
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nouvelle tâche…"
                  onKeyDown={(e) => e.key === 'Enter' && addTask()}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                />

              <div>
                <p className="mb-1.5 text-sm md:text-base font-medium uppercase tracking-wide text-muted-foreground">Catégorie</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  {SELECTABLE_CATEGORIES.map((c) => (
                    <button key={c} type="button" onClick={() => setCategory(c)} className={viewTogglePillClass(category === c)}>
                      {CATEGORY_LABEL[c]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-sm md:text-base font-medium uppercase tracking-wide text-muted-foreground">Urgence</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                    <button key={p} type="button" onClick={() => setPriority(p)} className={viewTogglePillClass(priority === p)}>
                      {PRIORITY_LABEL[p]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Periode : convertie en pastilles le 04/10/2026, puis
                  revenue a un menu deroulant le 05/10/2026 (demande par
                  Nicolas : "garde l'option de pastille deroulante comme
                  avant") -- mais avec la typo/esthetique des pastilles
                  mise en place entre-temps (majuscules, tracking 0,08em,
                  gras quand une periode est choisie) a la place de
                  l'ancien style text-xs non majuscule. */}
              <div>
                <p className="mb-1.5 text-sm md:text-base font-medium uppercase tracking-wide text-muted-foreground">Période</p>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as TaskPeriod | '')}
                  className={cn(
                    'h-8 rounded-full border border-input bg-background px-3 text-xs uppercase tracking-[0.08em] md:text-sm',
                    period === '' ? 'font-normal text-foreground/60' : 'font-semibold text-foreground'
                  )}
                >
                  <option value="">Pas de période précise</option>
                  <optgroup label="Mois">
                    {MONTH_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Saisons">
                    {SEASON_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Uniquement pour la catégorie "Jardin", demandé par Nicolas
                  le 27/09/2026 : une tâche jardin a toujours une récurrence
                  (1 fois par défaut), qui pilote sa réapparition après
                  clôture — voir le commentaire en tête de fichier. */}
              {category === 'jardin' && (
                <div>
                  <p className="mb-1.5 text-sm md:text-base font-medium uppercase tracking-wide text-muted-foreground">Récurrence</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {(Object.keys(RECURRENCE_LABEL) as Recurrence[]).map((r) => (
                      <button key={r} type="button" onClick={() => setRecurrence(r)} className={viewTogglePillClass(recurrence === r)}>
                        {RECURRENCE_LABEL[r]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Traite et nomme comme le bouton "Publier" de "Partager ce
                  qui a ete fait" (RealisationsBoard.tsx) -- demande par
                  Nicolas le 05/10/2026 : plus d'icone, meme libelle/etat. */}
              <button type="button" onClick={addTask} disabled={saving} className={actionPillClass}>
                {saving ? 'Publication...' : 'Publier'}
              </button>
            </div>
          )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            {archives.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setArchivesOpen((v) => !v)}
                  className="flex items-center gap-1.5 text-sm md:text-base font-medium uppercase tracking-wide text-muted-foreground"
                >
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', archivesOpen && 'rotate-180')} />
                  Archives
                </button>
                {archivesOpen && (
                  <TaskList
                    title={null}
                    tasks={archives}
                    canEdit={canEdit}
                    currentUserId={currentUserId}
                    onToggle={toggle}
                    onDelete={deleteTask}
                    servicesContacts={servicesContacts}
                    suiviOpen={suiviOpen}
                    pickerOpenFor={pickerOpenFor}
                    draftText={draftText}
                    draftDate={draftDate}
                    onToggleSuivi={toggleSuivi}
                    onOpenPicker={setPickerOpenFor}
                    onClosePicker={() => setPickerOpenFor(null)}
                    onDraftTextChange={(taskId, text) => setDraftText((prev) => ({ ...prev, [taskId]: text }))}
                    onDraftDateChange={(taskId, date) => setDraftDate((prev) => ({ ...prev, [taskId]: date }))}
                    onAddNote={addNote}
                    onDeleteNote={deleteNote}
                    onAttachContact={attachContact}
                    onDetachContact={detachContact}
                  />
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Widget separe pour "A faire ce mois-ci" / "A faire" / "Periodique"
          -- demande par Nicolas le 04/10/2026, "Periodique" ajoutee en bas
          le 05/10/2026. N'apparait pas si ces trois listes sont vides
          alors qu'il existe deja des taches ailleurs (pas besoin d'un
          widget vide) ; apparait avec le message "Aucune tache" quand il
          n'y a vraiment aucune tache nulle part. */}
      {(thisMonth.length > 0 || general.length > 0 || jardin.length > 0 || tasks.length === 0) && (
        <Card>
          <CardHeader>
            {/* Pastilles de tri Urgence/Categorie deplacees ici le
                05/10/2026 (demande par Nicolas) : elles n'apparaissaient
                plus qu'une fois, alignees sur la ligne du titre du widget
                "Liste des taches" (et non plus sur chacune des 3
                sous-listes), justifiees a droite. */}
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm md:text-base uppercase tracking-wide">Liste des tâches</CardTitle>
              <div className="flex items-center gap-x-4">
                <button type="button" onClick={() => setSortMode('urgence')} className={viewTogglePillClass(sortMode === 'urgence')}>
                  Urgence
                </button>
                <button type="button" onClick={() => setSortMode('categorie')} className={viewTogglePillClass(sortMode === 'categorie')}>
                  Catégorie
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {error && <p className="text-sm text-destructive">{error}</p>}

            {tasks.length === 0 && (
              <p className="text-muted-foreground text-sm">Aucune tâche pour le moment.</p>
            )}

            {thisMonth.length > 0 && (
              <TaskList
                title="À faire ce mois-ci"
                tasks={thisMonth}
                canEdit={canEdit}
                currentUserId={currentUserId}
                onToggle={toggle}
                onDelete={deleteTask}
                servicesContacts={servicesContacts}
                suiviOpen={suiviOpen}
                pickerOpenFor={pickerOpenFor}
                draftText={draftText}
                draftDate={draftDate}
                onToggleSuivi={toggleSuivi}
                onOpenPicker={setPickerOpenFor}
                onClosePicker={() => setPickerOpenFor(null)}
                onDraftTextChange={(taskId, text) => setDraftText((prev) => ({ ...prev, [taskId]: text }))}
                onDraftDateChange={(taskId, date) => setDraftDate((prev) => ({ ...prev, [taskId]: date }))}
                onAddNote={addNote}
                onDeleteNote={deleteNote}
                onAttachContact={attachContact}
                onDetachContact={detachContact}
              />
            )}

            {general.length > 0 && (
              <TaskList
                title="À faire"
                tasks={general}
                canEdit={canEdit}
                currentUserId={currentUserId}
                onToggle={toggle}
                onDelete={deleteTask}
                servicesContacts={servicesContacts}
                suiviOpen={suiviOpen}
                pickerOpenFor={pickerOpenFor}
                draftText={draftText}
                draftDate={draftDate}
                onToggleSuivi={toggleSuivi}
                onOpenPicker={setPickerOpenFor}
                onClosePicker={() => setPickerOpenFor(null)}
                onDraftTextChange={(taskId, text) => setDraftText((prev) => ({ ...prev, [taskId]: text }))}
                onDraftDateChange={(taskId, date) => setDraftDate((prev) => ({ ...prev, [taskId]: date }))}
                onAddNote={addNote}
                onDeleteNote={deleteNote}
                onAttachContact={attachContact}
                onDetachContact={detachContact}
              />
            )}

            {jardin.length > 0 && (
              <TaskList
                title="Périodique"
                tasks={jardin}
                canEdit={canEdit}
                currentUserId={currentUserId}
                onToggle={toggle}
                onDelete={deleteTask}
                servicesContacts={servicesContacts}
                suiviOpen={suiviOpen}
                pickerOpenFor={pickerOpenFor}
                draftText={draftText}
                draftDate={draftDate}
                onToggleSuivi={toggleSuivi}
                onOpenPicker={setPickerOpenFor}
                onClosePicker={() => setPickerOpenFor(null)}
                onDraftTextChange={(taskId, text) => setDraftText((prev) => ({ ...prev, [taskId]: text }))}
                onDraftDateChange={(taskId, date) => setDraftDate((prev) => ({ ...prev, [taskId]: date }))}
                onAddNote={addNote}
                onDeleteNote={deleteNote}
                onAttachContact={attachContact}
                onDetachContact={detachContact}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function TaskList({
  title,
  tasks,
  canEdit,
  currentUserId,
  onToggle,
  onDelete,
  servicesContacts,
  suiviOpen,
  pickerOpenFor,
  draftText,
  draftDate,
  onToggleSuivi,
  onOpenPicker,
  onClosePicker,
  onDraftTextChange,
  onDraftDateChange,
  onAddNote,
  onDeleteNote,
  onAttachContact,
  onDetachContact,
}: {
  title: string | null
  tasks: TaskItem[]
  canEdit: boolean
  currentUserId: string
  onToggle: (task: TaskItem) => void
  onDelete: (id: string) => void
  servicesContacts: ServiceContact[]
  suiviOpen: Record<string, boolean>
  pickerOpenFor: string | null
  draftText: Record<string, string>
  draftDate: Record<string, string>
  onToggleSuivi: (taskId: string) => void
  onOpenPicker: (taskId: string) => void
  onClosePicker: () => void
  onDraftTextChange: (taskId: string, text: string) => void
  onDraftDateChange: (taskId: string, date: string) => void
  onAddNote: (taskId: string) => void
  onDeleteNote: (taskId: string, noteId: string) => void
  onAttachContact: (taskId: string, contact: ServiceContact) => void
  onDetachContact: (taskId: string, contactId: string) => void
}) {
  return (
    <div className="space-y-2">
      {/* Les pastilles de tri Urgence/Categorie ne sont plus affichees ici
          -- deplacees une seule fois sur le titre du widget "Liste des
          taches" le 05/10/2026 (demande par Nicolas). */}
      {title && (
        <p className="text-[12px] md:text-[14px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      )}
      {/* Ligne 1px grise claire sous le titre de la liste -- demande par
          Nicolas le 05/10/2026. Absente pour Archives (title deja null). */}
      {title && <div className="border-b border-border" />}
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          canEdit={canEdit}
          currentUserId={currentUserId}
          onToggle={() => onToggle(task)}
          onDelete={() => onDelete(task.id)}
          servicesContacts={servicesContacts}
          suiviOpen={!!suiviOpen[task.id]}
          showPicker={pickerOpenFor === task.id}
          draftText={draftText[task.id] ?? ''}
          draftDate={draftDate[task.id] ?? ''}
          onToggleSuivi={() => onToggleSuivi(task.id)}
          onOpenPicker={() => onOpenPicker(task.id)}
          onClosePicker={onClosePicker}
          onDraftTextChange={(text) => onDraftTextChange(task.id, text)}
          onDraftDateChange={(date) => onDraftDateChange(task.id, date)}
          onAddNote={() => onAddNote(task.id)}
          onDeleteNote={(noteId) => onDeleteNote(task.id, noteId)}
          onAttachContact={(contact) => onAttachContact(task.id, contact)}
          onDetachContact={(contactId) => onDetachContact(task.id, contactId)}
        />
      ))}
    </div>
  )
}

function formatNoteDate(iso: string): string {
  try {
    return format(parseISO(iso), 'd MMM', { locale: fr })
  } catch {
    return ''
  }
}

// Ordre des colonnes demandé par Nicolas le 27/09/2026 : case à cocher,
// catégorie, tâche, période, urgence, puis la poubelle. Pastilles
// "Contact"/"Suivi" ajoutées le 19/10/2026 (demandé par Aurélie) : voir
// la maquette Artifact "Entretien — Suivi & Contact" -- associent la
// tâche à un ou plusieurs artisans (Contacts → Services) et tiennent un
// historique de notes datées, chacune pouvant porter une date de RDV.
// Ouvert à l'admin ET à la famille (indépendant de `canEdit`, réservé
// lui à l'ajout/suppression de tâche).
function TaskRow({
  task,
  canEdit,
  currentUserId,
  onToggle,
  onDelete,
  servicesContacts,
  suiviOpen,
  showPicker,
  draftText,
  draftDate,
  onToggleSuivi,
  onOpenPicker,
  onClosePicker,
  onDraftTextChange,
  onDraftDateChange,
  onAddNote,
  onDeleteNote,
  onAttachContact,
  onDetachContact,
}: {
  task: TaskItem
  canEdit: boolean
  currentUserId: string
  onToggle: () => void
  onDelete: () => void
  servicesContacts: ServiceContact[]
  suiviOpen: boolean
  showPicker: boolean
  draftText: string
  draftDate: string
  onToggleSuivi: () => void
  onOpenPicker: () => void
  onClosePicker: () => void
  onDraftTextChange: (text: string) => void
  onDraftDateChange: (date: string) => void
  onAddNote: () => void
  onDeleteNote: (noteId: string) => void
  onAttachContact: (contact: ServiceContact) => void
  onDetachContact: (contactId: string) => void
}) {
  const attachedIds = new Set(task.contacts.map((c) => c.contact_id))
  const pickerOptions = servicesContacts.filter((c) => !attachedIds.has(c.id))

  return (
    <div className="py-2 border-b border-border last:border-0">
      {/* Version bureau (md et plus) : une seule ligne, inchangee. */}
      <div className="hidden md:flex items-baseline gap-3">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={canEdit ? onToggle : undefined}
          disabled={!canEdit}
          className="self-center h-4 w-4 shrink-0 rounded border-input accent-primary disabled:opacity-40"
        />
        {/* Largeur fixe (au lieu d'un simple shrink-0 qui s'ajuste au texte)
            -- demande par Nicolas le 05/10/2026 : "Electricite"/"Manutention"
            (les libelles de categorie les plus longs) calent cette colonne,
            si bien que le texte de description de chaque tache commence
            desormais systematiquement a la meme position horizontale, quelle
            que soit la categorie affichee sur la ligne. */}
        <span className="w-28 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{CATEGORY_LABEL[task.category]}</span>
        {/* Plus de troncage (truncate) -- demande par Nicolas le
            04/10/2026 : un titre trop long passe a la ligne au lieu
            d'etre coupe, le reste de la ligne reste inchange. */}
        <p className={`flex-1 min-w-0 text-sm font-medium ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
          {task.title}
        </p>
        {task.period && (
          <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
            {PERIOD_LABELS[task.period as keyof typeof PERIOD_LABELS] ?? task.period}
          </span>
        )}
        <span className={`text-xs uppercase tracking-wide shrink-0 ${PRIORITY_STYLE[task.priority]}`}>
          {PRIORITY_LABEL[task.priority]}
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Supprimer cette tâche"
            className="self-center shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Version mobile (en dessous de md) : demande par Nicolas le
          07/10/2026, l'ancien affichage sur une seule ligne rendait le
          texte de la tache illisible (trop comprime entre categorie,
          periode et urgence). Desormais sur 2 lignes : ligne 1 =
          categorie (gauche) / periode (centre) / urgence (droite),
          ligne 2 = le texte complet de la tache, qui retourne a la
          ligne si besoin (plus de compression du texte). */}
      <div className="flex md:hidden flex-col gap-1">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={task.completed}
            onChange={canEdit ? onToggle : undefined}
            disabled={!canEdit}
            className="h-4 w-4 shrink-0 rounded border-input accent-primary disabled:opacity-40"
          />
          <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{CATEGORY_LABEL[task.category]}</span>
          <span className="flex-1 text-center text-xs uppercase tracking-wide text-muted-foreground">
            {task.period ? (PERIOD_LABELS[task.period as keyof typeof PERIOD_LABELS] ?? task.period) : ''}
          </span>
          <span className={`text-xs uppercase tracking-wide shrink-0 ${PRIORITY_STYLE[task.priority]}`}>
            {PRIORITY_LABEL[task.priority]}
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={onDelete}
              aria-label="Supprimer cette tâche"
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className={`pl-7 text-sm font-medium break-words ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
          {task.title}
        </p>
      </div>

      {/* Pastilles "Contact" et "Suivi" (19/10/2026) -- voir le grand
          commentaire au-dessus de TaskRow. */}
      <div className="pl-0 md:pl-[46px] mt-2 flex flex-wrap items-center gap-2 relative">
        {task.contacts.map((c) => (
          <div
            key={c.contact_id}
            className="inline-flex items-center gap-1.5 border border-foreground px-2 py-0.5 text-[11px] text-foreground"
          >
            <Phone className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-medium">{c.role}</span> — {c.name}
            </span>
            <button
              type="button"
              onClick={() => onDetachContact(c.contact_id)}
              aria-label={`Retirer ${c.name}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={onOpenPicker}
          className="inline-flex items-center gap-1.5 border border-dashed border-muted-foreground px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground hover:border-foreground hover:text-foreground"
        >
          <Phone className="h-3 w-3" aria-hidden="true" />
          Contact
        </button>

        <button
          type="button"
          onClick={onToggleSuivi}
          className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Suivi{task.notes.length > 0 ? ` (${task.notes.length})` : ''}
          <ChevronDown className={cn('h-2.5 w-2.5 transition-transform', suiviOpen && 'rotate-180')} />
        </button>

        {showPicker && (
          <div className="absolute left-0 top-7 z-10 min-w-[220px] rounded-md border border-border bg-card p-2 shadow-lg">
            <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Choisir un contact (Services)
            </p>
            {pickerOptions.length === 0 ? (
              <p className="px-1 py-1 text-xs text-muted-foreground">Aucun contact disponible.</p>
            ) : (
              pickerOptions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onAttachContact(c)}
                  className="flex w-full items-center justify-between gap-2 border-b border-border px-1 py-1.5 text-left text-sm last:border-0 hover:bg-muted"
                >
                  <span>{c.name}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{c.role}</span>
                </button>
              ))
            )}
            <button
              type="button"
              onClick={onClosePicker}
              className="mt-1.5 px-1 text-[10px] uppercase tracking-[0.06em] text-muted-foreground hover:text-foreground"
            >
              Annuler
            </button>
          </div>
        )}
      </div>

      {suiviOpen && (
        <div className="pl-0 md:pl-[46px] mt-2 space-y-2 rounded-md border border-border bg-muted/40 p-3">
          {task.notes.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">Aucune note de suivi pour l&apos;instant.</p>
          ) : (
            task.notes.map((note) => {
              const authorName = note.profile ? `${note.profile.first_name} ${note.profile.last_name}`.trim() : null
              const canDelete = note.user_id === currentUserId || canEdit
              return (
                <p key={note.id} className="flex items-start justify-between gap-2 text-xs text-foreground/90">
                  <span>
                    <span className="text-muted-foreground">{formatNoteDate(note.created_at)}</span>
                    {authorName && <> — <span className="font-medium">{authorName}</span></>} :{' '}
                    {note.rdv_date && (
                      <span className="mr-1 font-semibold uppercase tracking-wide text-primary">
                        RDV {formatNoteDate(note.rdv_date)}
                      </span>
                    )}
                    {note.text}
                  </span>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => onDeleteNote(note.id)}
                      aria-label="Supprimer cette note"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </p>
              )
            })
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              type="text"
              value={draftText}
              onChange={(e) => onDraftTextChange(e.target.value)}
              placeholder="Ajouter une note de suivi…"
              onKeyDown={(e) => e.key === 'Enter' && onAddNote()}
              className="min-w-[180px] flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground"
            />
            <span className="text-[9px] uppercase tracking-wide text-muted-foreground">RDV (facult.)</span>
            <input
              type="date"
              value={draftDate}
              onChange={(e) => onDraftDateChange(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
            />
            <button type="button" onClick={onAddNote} className={actionPillClass}>
              Ajouter
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
