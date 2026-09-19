'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus } from 'lucide-react'
import { MONTH_OPTIONS, SEASON_OPTIONS, PERIOD_LABELS, TaskPeriod, isPeriodCurrent } from '@/lib/task-periods'

type Category = 'entretien' | 'reparation' | 'autre'
type Priority = 'low' | 'medium' | 'high'

export interface TaskItem {
  id: string
  title: string
  category: Category
  priority: Priority
  period: string | null
  completed: boolean
  authorName: string | null
}

const CATEGORY_LABEL: Record<Category, string> = {
  entretien: 'Entretien',
  reparation: 'Réparation',
  autre: 'Autre',
}

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

interface TasksBoardProps {
  initialTasks: TaskItem[]
  // Réservé aux admins côté base (policy "tasks_admin") : tout le monde
  // peut voir la liste, seul un admin peut cocher ou ajouter une tâche.
  canEdit: boolean
}

export function TasksBoard({ initialTasks, canEdit }: TasksBoardProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<Category>('entretien')
  const [priority, setPriority] = useState<Priority>('medium')
  const [period, setPeriod] = useState<TaskPeriod | ''>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const notDone = tasks.filter((t) => !t.completed)
  const done = tasks.filter((t) => t.completed)
  const thisMonth = notDone.filter((t) => isPeriodCurrent(t.period))
  const general = notDone.filter((t) => !isPeriodCurrent(t.period))

  const toggle = async (task: TaskItem) => {
    const nextCompleted = !task.completed
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: nextCompleted } : t)))
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, completed: nextCompleted }),
      })
      if (!res.ok) throw new Error()
    } catch {
      // on annule le changement optimiste si l'enregistrement échoue
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: task.completed } : t)))
      setError('Impossible de mettre à jour cette tâche.')
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
        body: JSON.stringify({ title: title.trim(), category, priority, period: period || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      setTasks((prev) => [
        { ...data.task, authorName: null },
        ...prev,
      ])
      setTitle('')
      setPriority('medium')
      setCategory('entretien')
      setPeriod('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’ajout')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {canEdit && (
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nouvelle tâche…"
            className="flex-1 min-w-[160px]"
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
              <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
            ))}
          </select>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as TaskPeriod | '')}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
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
          <Button type="button" onClick={addTask} disabled={saving || !title.trim()} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Ajouter
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {notDone.length === 0 && done.length === 0 && (
        <p className="text-muted-foreground text-sm">Aucune tâche pour le moment.</p>
      )}

      {thisMonth.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">À faire ce mois-ci</p>
          {thisMonth.map((task) => (
            <TaskRow key={task.id} task={task} canEdit={canEdit} onToggle={() => toggle(task)} />
          ))}
        </div>
      )}

      {general.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">À faire</p>
          {general.map((task) => (
            <TaskRow key={task.id} task={task} canEdit={canEdit} onToggle={() => toggle(task)} />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground pt-3">Terminées</p>
          {done.map((task) => (
            <TaskRow key={task.id} task={task} canEdit={canEdit} onToggle={() => toggle(task)} />
          ))}
        </div>
      )}
    </div>
  )
}

function TaskRow({ task, canEdit, onToggle }: { task: TaskItem; canEdit: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      <input
        type="checkbox"
        checked={task.completed}
        onChange={canEdit ? onToggle : undefined}
        disabled={!canEdit}
        className="h-4 w-4 rounded border-input accent-primary disabled:opacity-40"
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
          {task.title}
        </p>
        {task.authorName && (
          <p className="text-xs text-muted-foreground">Ajoutée par {task.authorName}</p>
        )}
      </div>
      {task.period && (
        <Badge variant="outline" className="text-xs shrink-0">
          {PERIOD_LABELS[task.period as keyof typeof PERIOD_LABELS] ?? task.period}
        </Badge>
      )}
      <Badge variant="outline" className="text-xs shrink-0">{CATEGORY_LABEL[task.category]}</Badge>
      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${PRIORITY_STYLE[task.priority]}`}>
        {PRIORITY_LABEL[task.priority]}
      </span>
    </div>
  )
}
