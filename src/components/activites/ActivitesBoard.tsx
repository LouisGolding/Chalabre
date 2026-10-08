'use client'

import { useMemo, useState } from 'react'
import { addDays, format, isAfter, isBefore, parseISO, startOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronDown, Pencil, Trash2, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { actionPillClass, cn, viewTogglePillClass } from '@/lib/utils'
import { LOCAL_EVENT_CATEGORIES, LOCAL_EVENT_CATEGORY_LABELS } from '@/lib/local-event-categories'
import type { LocalEvent } from '@/types'

// Composant client de l'onglet "Activités" -- aspect repris de
// RealisationsBoard.tsx (encadré de saisie en haut, cartes "card-canson",
// pastille actionPillClass pour les actions), seul onglet existant dont
// l'esthétique s'en rapproche le plus (demande de Nicolas le 08/10/2026).
//
// Étape 1 : coller un texte brut puis "Analyser" -> POST
// /api/local-events/extract (appel IA côté serveur) -> aperçu éditable
// (`drafts`, rien n'est encore en base). Étape 2 : relecture/correction
// ligne par ligne, puis "Enregistrer" (POST /api/local-events) ou
// "Ignorer" pour écarter une proposition. Les événements déjà enregistrés
// (`events`) sont groupés en Aujourd'hui / Demain / Cette semaine (repliée
// par défaut) / Passé (replié par défaut) -- choix de regroupement non
// revu en détail avec Nicolas, à ajuster si besoin :
//   - "Aujourd'hui"/"Demain" : l'événement couvre ce jour-là (du jour de
//     début à la fin, pour les événements sur plusieurs jours) ;
//   - "Cette semaine" : les événements démarrant après demain et dans les
//     7 jours à venir ;
//   - "Passé" : les événements déjà terminés.
type DraftEvent = {
  title: string
  event_date: string
  event_end_date: string | null
  event_time: string | null
  location: string | null
  category: string
}

export function ActivitesBoard({ initialEvents }: { initialEvents: LocalEvent[] }) {
  const [events, setEvents] = useState(initialEvents)
  const [pasteText, setPasteText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [drafts, setDrafts] = useState<DraftEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pastOpen, setPastOpen] = useState(false)
  const [weekOpen, setWeekOpen] = useState(false)

  const { todayList, tomorrowList, weekList, pastList } = useMemo(() => {
    const today = startOfDay(new Date())
    const tomorrow = addDays(today, 1)
    const weekEnd = addDays(today, 7)

    const coversDay = (ev: LocalEvent, day: Date) => {
      const start = startOfDay(parseISO(ev.event_date))
      const end = ev.event_end_date ? startOfDay(parseISO(ev.event_end_date)) : start
      return !isBefore(day, start) && !isAfter(day, end)
    }
    const isPast = (ev: LocalEvent) => {
      const end = startOfDay(parseISO(ev.event_end_date ?? ev.event_date))
      return isBefore(end, today)
    }

    const sorted = [...events].sort((a, b) => a.event_date.localeCompare(b.event_date))
    return {
      todayList: sorted.filter((ev) => coversDay(ev, today)),
      tomorrowList: sorted.filter((ev) => coversDay(ev, tomorrow)),
      weekList: sorted.filter(
        (ev) => isAfter(startOfDay(parseISO(ev.event_date)), tomorrow) && !isAfter(startOfDay(parseISO(ev.event_date)), weekEnd)
      ),
      pastList: sorted.filter(isPast).reverse(),
    }
  }, [events])

  const handleAnalyze = async () => {
    if (!pasteText.trim()) return
    setAnalyzing(true)
    setError(null)
    try {
      const res = await fetch('/api/local-events/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Erreur lors de l'analyse")
      if (data.events.length === 0) {
        setError("Aucun événement reconnu dans ce texte.")
      }
      setDrafts(data.events)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'analyse")
    } finally {
      setAnalyzing(false)
    }
  }

  const updateDraft = (index: number, patch: Partial<DraftEvent>) => {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }

  const discardDraft = (index: number) => {
    setDrafts((prev) => prev.filter((_, i) => i !== index))
  }

  const saveDraft = async (index: number) => {
    const draft = drafts[index]
    if (!draft.title.trim() || !draft.event_date) return
    const res = await fetch('/api/local-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...draft, source_text: pasteText.trim() || null }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? "Erreur lors de l'enregistrement")
      return
    }
    setEvents((prev) => [...prev, data.event])
    discardDraft(index)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cet événement ?')) return
    const res = await fetch(`/api/local-events?id=${id}`, { method: 'DELETE' })
    if (res.ok) setEvents((prev) => prev.filter((e) => e.id !== id))
  }

  const handleSave = async (id: string, patch: Partial<LocalEvent>) => {
    const res = await fetch('/api/local-events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    })
    if (!res.ok) return false
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
    return true
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-xl bg-card/60 backdrop-blur-sm p-4 ring-1 ring-foreground/10">
        <p className="text-sm md:text-base font-medium uppercase tracking-wide text-foreground">
          Coller un texte (affiche, programme, bulletin municipal...)
        </p>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Colle ici le texte brut listant un ou plusieurs événements..."
          rows={5}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none"
        />
        <div className="flex items-center justify-between gap-3">
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing || !pasteText.trim()}
            className={cn(actionPillClass, 'ml-auto')}
          >
            {analyzing ? 'Analyse...' : 'Analyser'}
          </button>
        </div>
      </div>

      {drafts.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-wide text-foreground">
            Propositions à relire ({drafts.length})
          </p>
          {drafts.map((draft, index) => (
            <DraftCard
              key={index}
              draft={draft}
              onChange={(patch) => updateDraft(index, patch)}
              onSave={() => saveDraft(index)}
              onDiscard={() => discardDraft(index)}
            />
          ))}
        </div>
      )}

      {/* Liste déjà enregistrée en 3 colonnes (précisé par Nicolas le
          07/10/2026) : Aujourd'hui à gauche, Demain au centre, Cette
          semaine à droite -- cette dernière repliée par défaut ("à
          dérouler"), à la différence des deux premières qui restent
          toujours visibles. Les 3 colonnes s'empilent verticalement en
          dessous du point de rupture md (une seule colonne sur mobile),
          même convention que le reste du site. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <EventColumn title="Aujourd'hui" events={todayList} onDelete={handleDelete} onSave={handleSave} />
        <EventColumn title="Demain" events={tomorrowList} onDelete={handleDelete} onSave={handleSave} />
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setWeekOpen((o) => !o)}
            aria-expanded={weekOpen}
            className="flex w-full items-center justify-between gap-2 text-left hover:opacity-80"
          >
            <p className="text-sm md:text-base font-medium uppercase tracking-wide text-foreground">
              Cette semaine ({weekList.length})
            </p>
            <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', weekOpen && 'rotate-180')} />
          </button>
          {weekOpen && <EventList events={weekList} onDelete={handleDelete} onSave={handleSave} emptyLabel="Rien de prévu." />}
        </div>
      </div>

      <CollapsibleSection
        title={`Événements passés (${pastList.length})`}
        open={pastOpen}
        onToggle={() => setPastOpen((o) => !o)}
      >
        <EventList events={pastList} onDelete={handleDelete} onSave={handleSave} />
      </CollapsibleSection>
    </div>
  )
}

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <Card className="py-0">
      <CardHeader>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex h-10 w-full items-center justify-between gap-2 text-left hover:opacity-80"
        >
          <CardTitle className="text-sm md:text-base uppercase tracking-wide">{title}</CardTitle>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
      </CardHeader>
      {open && <CardContent className="pb-4 space-y-3">{children}</CardContent>}
    </Card>
  )
}

function EventColumn({
  title,
  events,
  onDelete,
  onSave,
}: {
  title: string
  events: LocalEvent[]
  onDelete: (id: string) => void
  onSave: (id: string, patch: Partial<LocalEvent>) => Promise<boolean>
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm md:text-base font-medium uppercase tracking-wide text-foreground">{title}</p>
      <EventList events={events} onDelete={onDelete} onSave={onSave} emptyLabel="Rien de prévu." />
    </div>
  )
}

function EventList({
  events,
  onDelete,
  onSave,
  emptyLabel = 'Rien ici.',
}: {
  events: LocalEvent[]
  onDelete: (id: string) => void
  onSave: (id: string, patch: Partial<LocalEvent>) => Promise<boolean>
  emptyLabel?: string
}) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground/70">{emptyLabel}</p>
  }
  return (
    <div className="space-y-2">
      {events.map((ev) => (
        <EventCard key={ev.id} event={ev} onDelete={() => onDelete(ev.id)} onSave={(patch) => onSave(ev.id, patch)} />
      ))}
    </div>
  )
}

function EventCard({
  event,
  onDelete,
  onSave,
}: {
  event: LocalEvent
  onDelete: () => void
  onSave: (patch: Partial<LocalEvent>) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(event.title)
  const [eventDate, setEventDate] = useState(event.event_date)
  const [eventTime, setEventTime] = useState(event.event_time ?? '')
  const [location, setLocation] = useState(event.location ?? '')
  const [category, setCategory] = useState(event.category)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim() || !eventDate) return
    setSaving(true)
    try {
      const ok = await onSave({
        title: title.trim(),
        event_date: eventDate,
        event_time: eventTime.trim() || null,
        location: location.trim() || null,
        category,
      })
      if (ok) setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="card-canson space-y-2 rounded-lg p-3 ring-1 ring-foreground/10">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          <input
            type="text"
            value={eventTime}
            onChange={(e) => setEventTime(e.target.value)}
            placeholder="Horaire (ex. 20h30)"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Lieu"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <div className="flex flex-wrap gap-3">
          {LOCAL_EVENT_CATEGORIES.map((c) => (
            <button key={c.id} type="button" onClick={() => setCategory(c.id)} className={viewTogglePillClass(category === c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => setEditing(false)} className={actionPillClass}>
            Annuler
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className={actionPillClass}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card-canson flex items-start justify-between gap-3 rounded-lg p-3 ring-1 ring-foreground/10">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{event.title}</p>
        <p className="text-xs text-muted-foreground">
          {format(parseISO(event.event_date), 'EEEE d MMMM', { locale: fr })}
          {event.event_time ? ` · ${event.event_time}` : ''}
          {event.location ? ` · ${event.location}` : ''}
          {' · '}
          {LOCAL_EVENT_CATEGORY_LABELS[event.category] ?? event.category}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={() => setEditing(true)} aria-label="Modifier" className="text-muted-foreground hover:text-foreground">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={onDelete} aria-label="Supprimer" className="text-muted-foreground hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

function DraftCard({
  draft,
  onChange,
  onSave,
  onDiscard,
}: {
  draft: DraftEvent
  onChange: (patch: Partial<DraftEvent>) => void
  onSave: () => void
  onDiscard: () => void
}) {
  return (
    <div className="card-canson space-y-2 rounded-lg p-3 ring-1 ring-foreground/10">
      <div className="flex items-start gap-2">
        <input
          type="text"
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Titre"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <button type="button" onClick={onDiscard} aria-label="Ignorer cette proposition" className="mt-2 text-muted-foreground hover:text-destructive">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          type="date"
          value={draft.event_date}
          onChange={(e) => onChange({ event_date: e.target.value })}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
        <input
          type="text"
          value={draft.event_time ?? ''}
          onChange={(e) => onChange({ event_time: e.target.value || null })}
          placeholder="Horaire (ex. 20h30)"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <input
        type="text"
        value={draft.location ?? ''}
        onChange={(e) => onChange({ location: e.target.value || null })}
        placeholder="Lieu"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
      />
      <div className="flex flex-wrap gap-3">
        {LOCAL_EVENT_CATEGORIES.map((c) => (
          <button key={c.id} type="button" onClick={() => onChange({ category: c.id })} className={viewTogglePillClass(draft.category === c.id)}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-end">
        <button type="button" onClick={onSave} className={actionPillClass}>
          Enregistrer
        </button>
      </div>
    </div>
  )
}
