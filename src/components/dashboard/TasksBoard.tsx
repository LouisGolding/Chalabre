'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MONTH_OPTIONS, SEASON_OPTIONS, PERIOD_LABELS, TaskPeriod, isPeriodCurrent } from '@/lib/task-periods'

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
// - Commentaire optionnel proposé à la coche, uniquement pour les tâches
//   non récurrentes (donc jamais pour le jardin).
// - Tri au choix, par urgence ou par catégorie, appliqué aux 4 listes.

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
  comment: string | null
  authorName: string | null
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

const PRIORITY_STYLE: Record<Priority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
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
}

export function TasksBoard({ initialTasks, canEdit }: TasksBoardProps) {
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

  // Commentaire optionnel proposé juste après avoir coché une tâche non
  // récurrente (jamais pour le jardin) — voir toggle() plus bas.
  const [commentDraftId, setCommentDraftId] = useState<string | null>(null)
  const [commentDraftText, setCommentDraftText] = useState('')

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
    if (nextCompleted && !task.recurrence) {
      setCommentDraftId(task.id)
      setCommentDraftText('')
    } else if (commentDraftId === task.id) {
      setCommentDraftId(null)
    }
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

  const saveComment = async (taskId: string) => {
    const text = commentDraftText.trim()
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, comment: text || null } : t)))
    setCommentDraftId(null)
    setCommentDraftText('')
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, comment: text }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setError('Impossible d’enregistrer le commentaire.')
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
          comment: t.comment ?? null,
          authorName: null,
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
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setFormOpen((v) => !v)}
        role="button"
        tabIndex={0}
        aria-expanded={formOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setFormOpen((v) => !v)
          }
        }}
      >
        <CardTitle className="flex items-center justify-between gap-2">
          Entretien et réparations
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', formOpen && 'rotate-180')} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {canEdit && formOpen && (
          <div className="space-y-3 pb-4 border-b border-border" onClick={(e) => e.stopPropagation()}>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nouvelle tâche…"
              onKeyDown={(e) => e.key === 'Enter' && addTask()}
            />

            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Catégorie</p>
              <div className="flex flex-wrap gap-1.5">
                {SELECTABLE_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-colors',
                      category === c
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-input text-foreground hover:bg-muted'
                    )}
                  >
                    {CATEGORY_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Urgence</p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-colors',
                      priority === p
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-input text-foreground hover:bg-muted'
                    )}
                  >
                    {PRIORITY_LABEL[p]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Période</p>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as TaskPeriod | '')}
                className="h-8 rounded-full border border-input bg-background px-3 text-xs"
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
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Récurrence</p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(RECURRENCE_LABEL) as Recurrence[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRecurrence(r)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs transition-colors',
                        recurrence === r
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-input text-foreground hover:bg-muted'
                      )}
                    >
                      {RECURRENCE_LABEL[r]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              type="button"
              onClick={addTask}
              disabled={saving || !title.trim()}
              className="gap-1.5 bg-foreground text-background hover:bg-foreground/90"
            >
              <Plus className="h-4 w-4" />
              Ajouter
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {tasks.length === 0 && (
          <p className="text-muted-foreground text-sm">Aucune tâche pour le moment.</p>
        )}

        {tasks.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Trier par :</span>
            <button
              type="button"
              onClick={() => setSortMode('urgence')}
              className={cn('rounded-full border px-2.5 py-1 transition-colors', sortMode === 'urgence' ? 'border-foreground text-foreground' : 'border-input hover:bg-muted')}
            >
              Urgence
            </button>
            <button
              type="button"
              onClick={() => setSortMode('categorie')}
              className={cn('rounded-full border px-2.5 py-1 transition-colors', sortMode === 'categorie' ? 'border-foreground text-foreground' : 'border-input hover:bg-muted')}
            >
              Catégorie
            </button>
          </div>
        )}

        {thisMonth.length > 0 && (
          <TaskList
            title="À faire ce mois-ci"
            tasks={thisMonth}
            canEdit={canEdit}
            onToggle={toggle}
            onDelete={deleteTask}
            commentDraftId={commentDraftId}
            commentDraftText={commentDraftText}
            onCommentDraftChange={setCommentDraftText}
            onCommentSave={saveComment}
          />
        )}

        {general.length > 0 && (
          <TaskList
            title="À faire"
            tasks={general}
            canEdit={canEdit}
            onToggle={toggle}
            onDelete={deleteTask}
            commentDraftId={commentDraftId}
            commentDraftText={commentDraftText}
            onCommentDraftChange={setCommentDraftText}
            onCommentSave={saveComment}
          />
        )}

        {jardin.length > 0 && (
          <TaskList
            title="Jardin"
            tasks={jardin}
            canEdit={canEdit}
            onToggle={toggle}
            onDelete={deleteTask}
            commentDraftId={commentDraftId}
            commentDraftText={commentDraftText}
            onCommentDraftChange={setCommentDraftText}
            onCommentSave={saveComment}
          />
        )}

        {archives.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setArchivesOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', archivesOpen && 'rotate-180')} />
              Archives
            </button>
            {archivesOpen && (
              <TaskList
                title={null}
                tasks={archives}
                canEdit={canEdit}
                onToggle={toggle}
                onDelete={deleteTask}
                commentDraftId={commentDraftId}
                commentDraftText={commentDraftText}
                onCommentDraftChange={setCommentDraftText}
                onCommentSave={saveComment}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TaskList({
  title,
  tasks,
  canEdit,
  onToggle,
  onDelete,
  commentDraftId,
  commentDraftText,
  onCommentDraftChange,
  onCommentSave,
}: {
  title: string | null
  tasks: TaskItem[]
  canEdit: boolean
  onToggle: (task: TaskItem) => void
  onDelete: (id: string) => void
  commentDraftId: string | null
  commentDraftText: string
  onCommentDraftChange: (text: string) => void
  onCommentSave: (id: string) => void
}) {
  return (
    <div className="space-y-2">
      {title && <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>}
      {tasks.map((task) => (
        <div key={task.id}>
          <TaskRow task={task} canEdit={canEdit} onToggle={() => onToggle(task)} onDelete={() => onDelete(task.id)} />
          {commentDraftId === task.id && (
            <div className="flex items-center gap-2 pb-2 pl-7">
              <Input
                autoFocus
                value={commentDraftText}
                onChange={(e) => onCommentDraftChange(e.target.value)}
                placeholder="Commentaire (facultatif)…"
                onKeyDown={(e) => e.key === 'Enter' && onCommentSave(task.id)}
                className="flex-1"
              />
              <Button type="button" size="sm" onClick={() => onCommentSave(task.id)}>OK</Button>
            </div>
          )}
          {task.comment && commentDraftId !== task.id && (
            <p className="pb-2 pl-7 text-xs text-muted-foreground">« {task.comment} »</p>
          )}
        </div>
      ))}
    </div>
  )
}

// Ordre des colonnes demandé par Nicolas le 27/09/2026 : case à cocher,
// catégorie, tâche, période, urgence, puis la poubelle.
function TaskRow({ task, canEdit, onToggle, onDelete }: { task: TaskItem; canEdit: boolean; onToggle: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      <input
        type="checkbox"
        checked={task.completed}
        onChange={canEdit ? onToggle : undefined}
        disabled={!canEdit}
        className="h-4 w-4 shrink-0 rounded border-input accent-primary disabled:opacity-40"
      />
      <span className="shrink-0 text-xs text-muted-foreground">{CATEGORY_LABEL[task.category]}</span>
      <p className={`flex-1 min-w-0 truncate text-sm font-medium ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
        {task.title}
      </p>
      {task.period && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {PERIOD_LABELS[task.period as keyof typeof PERIOD_LABELS] ?? task.period}
        </span>
      )}
      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${PRIORITY_STYLE[task.priority]}`}>
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
  )
}
